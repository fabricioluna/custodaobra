import { describe, expect, it } from "vitest";

import { authCopy } from "@/features/auth/copy";
import { authErrorMessage } from "@/features/auth/errors";

const { errors } = authCopy;

describe("authErrorMessage", () => {
  it("traduz os erros do Supabase Auth", () => {
    expect(authErrorMessage({ code: "invalid_credentials", status: 400 })).toBe(
      errors.wrongPassword,
    );
    expect(authErrorMessage({ code: "weak_password", status: 422 })).toBe(
      errors.weakPassword,
    );
    expect(authErrorMessage({ code: "same_password", status: 422 })).toBe(
      errors.samePassword,
    );
    expect(authErrorMessage({ code: "user_already_exists" })).toBe(
      errors.accountExists,
    );
    expect(authErrorMessage({ code: "otp_expired", status: 403 })).toBe(
      errors.wrongCode,
    );
  });

  it("limite de pedidos vira 'espere um minuto'", () => {
    expect(authErrorMessage({ status: 429 })).toBe(errors.rateLimited);
    expect(authErrorMessage({ code: "over_email_send_rate_limit" })).toBe(
      errors.rateLimited,
    );
  });

  it("erro desconhecido usa a mensagem da tela", () => {
    expect(authErrorMessage({ code: "algo_novo" }, errors.wrongCode)).toBe(
      errors.wrongCode,
    );
    expect(authErrorMessage({ code: "algo_novo" })).toBe(errors.generic);
  });
});
