import { TrendPanel } from "@/components/charts/trend-panel";
import { PageHeading } from "@/components/ui/shared";
export const metadata = { title: "Temperature Trends" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ experiment?: string }>;
}) {
  const { experiment } = await searchParams;
  return (
    <>
      <PageHeading title="Temperature Trends" />
      <TrendPanel full initialId={experiment} />
    </>
  );
}
