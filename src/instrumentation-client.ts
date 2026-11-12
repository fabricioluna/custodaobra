import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/monitoring/sentry";

// Sem Session Replay: gravaria a tela com valores e nomes (LGPD) e pesa no
// celular.
Sentry.init(sentryOptions);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
