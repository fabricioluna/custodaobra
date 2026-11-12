"use server";

import { redirect } from "next/navigation";

import { orgPath } from "@/components/layout/nav";
import { APP_NAME } from "@/config/app";
import { requireOrg } from "@/features/organizations/queries";
import { canManageOrg } from "@/features/projects/queries";
import {
  AsaasError,
  createCustomer,
  createSubscription,
  deleteSubscription,
  isAsaasConfigured,
  findCustomerByReference,
  listOpenPayments,
} from "@/lib/billing/asaas";
import { firstDueDate } from "@/lib/billing/checkout";
import { createClient } from "@/lib/supabase/server";

import { billingCopy } from "./copy";
import { getBillingSubscription } from "./queries";
import { parseCheckoutForm } from "./schemas";

const errors = billingCopy.errors;

type CustomerInput = { name?: string; document?: string; email?: string };

type Field = "planCode" | "name" | "document" | "email";
export type BillingFormState =
  | { status: "idle" }
  | {
      status: "error";
      message?: string;
      fieldErrors?: Partial<Record<Field, string>>;
    };

function providerMessage(error: unknown): string {
  return error instanceof AsaasError && error.status === 400
    ? errors.rejected(error.description)
    : errors.failed;
}

/**
 * Assina (ou troca de plano) pelo Asaas e leva a pessoa para a fatura, onde
 * ela escolhe Pix, boleto ou cartão. Dono ou admin. O plano só muda quando o
 * webhook confirmar o pagamento.
 */
export async function startCheckout(
  orgSlug: string,
  _prev: BillingFormState,
  formData: FormData,
): Promise<BillingFormState> {
  const org = await requireOrg(orgSlug);
  if (!(await canManageOrg(org.id))) {
    return { status: "error", message: errors.noPermission };
  }
  if (!isAsaasConfigured()) {
    return { status: "error", message: errors.unavailable };
  }

  const subscription = await getBillingSubscription(org.id);
  if (!subscription) return { status: "error", message: errors.failed };
  const needsCustomer = !subscription.provider_customer_id;
  const parsed = parseCheckoutForm(formData, needsCustomer);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<Field, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as Field;
      fieldErrors[field] ??= issue.message;
    }
    return { status: "error", fieldErrors };
  }

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("plans")
    .select("code, name, price_cents_month")
    .eq("code", parsed.data.planCode)
    .eq("active", true)
    .gt("price_cents_month", 0)
    .maybeSingle();
  if (!plan) {
    return { status: "error", fieldErrors: { planCode: errors.plan } };
  }

  const previousId = subscription.provider_subscription_id;
  const changing = Boolean(previousId);
  let invoiceUrl: string | null = null;
  try {
    const customerId =
      subscription.provider_customer_id ??
      (await ensureCustomer(org.id, parsed.data as CustomerInput));

    let subscriptionId = previousId;
    if (!previousId || subscription.provider_plan_code !== plan.code) {
      // Assinatura nova (primeira vez ou troca de plano). Na troca, a nova
      // começa no fim do período já pago e a antiga sai depois de gravada.
      const createdId = await createSubscription({
        customer: customerId,
        value: plan.price_cents_month / 100,
        nextDueDate: firstDueDate(subscription, org.timezone),
        description: billingCopy.subscribe.providerDescription(
          plan.name,
          APP_NAME,
        ),
        externalReference: org.id,
      });
      const { error } = await supabase.rpc("billing_set_subscription", {
        p_org_id: org.id,
        p_subscription_id: createdId,
        p_plan_code: plan.code,
        p_previous_subscription_id: previousId ?? undefined,
      });
      if (error) {
        // Outra aba trocou antes, ou o banco falhou: desfaz a que criou.
        await removeSubscription(createdId);
        throw error;
      }
      if (previousId) await removeSubscription(previousId);
      subscriptionId = createdId;
    }

    const open = await listOpenPayments(subscriptionId!);
    invoiceUrl = open[0]?.invoiceUrl ?? null;
  } catch (error) {
    console.error("[cobrança] falha ao assinar", error);
    return { status: "error", message: providerMessage(error) };
  }

  // A primeira cobrança pode demorar um instante para existir no Asaas.
  redirect(
    invoiceUrl ??
      `${orgPath(org.slug, "configuracoes", "plano")}?assinatura=${changing ? "alterada" : "criada"}`,
  );
}

/**
 * Cliente do Asaas da conta: reaproveita um criado numa tentativa anterior
 * (pela referência) antes de criar outro, e guarda na conta.
 */
async function ensureCustomer(
  orgId: string,
  data: CustomerInput,
): Promise<string> {
  let customerId = await findCustomerByReference(orgId);
  if (!customerId) {
    if (!data.name || !data.document || !data.email) {
      throw new Error("dados do cliente ausentes");
    }
    customerId = await createCustomer({
      name: data.name,
      cpfCnpj: data.document,
      email: data.email,
      externalReference: orgId,
    });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("billing_set_customer", {
    p_org_id: orgId,
    p_customer_id: customerId,
  });
  if (error) throw error;
  return customerId;
}

/** Remove uma assinatura no Asaas (já removida conta como feito). */
async function removeSubscription(id: string): Promise<void> {
  try {
    await deleteSubscription(id);
  } catch (error) {
    if (error instanceof AsaasError && error.status === 404) return;
    // Fica cobrando se ninguém olhar: vai para o Sentry com o id.
    console.error("[cobrança] assinatura não removida no Asaas", id, error);
  }
}

/** Cancela a assinatura no Asaas; a conta vale até o fim do período pago. */
export async function cancelSubscription(
  orgSlug: string,
  _prev: BillingFormState,
  formData: FormData,
): Promise<BillingFormState> {
  const org = await requireOrg(orgSlug);
  if (!(await canManageOrg(org.id))) {
    return { status: "error", message: errors.noPermission };
  }
  if (formData.get("confirm") !== "on") {
    return { status: "error", message: errors.confirm };
  }

  const subscription = await getBillingSubscription(org.id);
  const subscriptionId = subscription?.provider_subscription_id;
  // Sem assinatura no Asaas não há o que cancelar (nem o teste grátis).
  if (!subscriptionId) redirect(orgPath(org.slug, "configuracoes", "plano"));
  try {
    await deleteSubscription(subscriptionId).catch((error: unknown) => {
      // Já removida no Asaas: segue para marcar aqui.
      if (!(error instanceof AsaasError && error.status === 404)) {
        throw error;
      }
    });
    const supabase = await createClient();
    const { error } = await supabase.rpc("billing_mark_cancelled", {
      p_org_id: org.id,
    });
    if (error) throw error;
  } catch (error) {
    console.error("[cobrança] falha ao cancelar", error);
    return { status: "error", message: providerMessage(error) };
  }
  redirect(orgPath(org.slug, "configuracoes", "plano"));
}
