import type { Metadata } from "next";

import { LegalPage } from "@/features/marketing/components/legal-page";
import { termsOfUse } from "@/features/marketing/legal";

export const metadata: Metadata = { title: termsOfUse.title };

export default function TermsPage() {
  return <LegalPage document={termsOfUse} />;
}
