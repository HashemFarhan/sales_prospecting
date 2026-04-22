import { ProviderDetailPage } from "@/components/provider-detail-page";

export default function ProviderPage({ params }: { params: { id: string } }) {
  return <ProviderDetailPage providerId={params.id} />;
}
