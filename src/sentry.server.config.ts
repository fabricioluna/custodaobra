import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/monitoring/sentry";

Sentry.init({
  ...sentryOptions,
  // Os erros tratados (IA, Meta, banco) já vão para console.error com um
  // prefixo ("[whatsapp]", "[ia]", "[cron]"...); viram eventos no Sentry,
  // limpos pelo `scrubEvent` (só o prefixo e um resumo sem dados pessoais).
  integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
});
