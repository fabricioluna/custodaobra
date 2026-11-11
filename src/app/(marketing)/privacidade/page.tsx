import type { Metadata } from "next";

import { LegalPage } from "@/features/marketing/components/legal-page";
import { privacyPolicy } from "@/features/marketing/legal";

export const metadata: Metadata = { title: privacyPolicy.title };

export default function PrivacyPage() {
  return <LegalPage document={privacyPolicy} />;
}
