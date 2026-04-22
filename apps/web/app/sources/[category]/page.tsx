import { notFound } from "next/navigation";

import { SourceBrowserPage } from "@/components/source-browser-page";

export default function SourcesCategoryPage({ params }: { params: { category: string } }) {
  if (!["providers", "crm", "products"].includes(params.category)) {
    notFound();
  }

  return <SourceBrowserPage category={params.category} />;
}
