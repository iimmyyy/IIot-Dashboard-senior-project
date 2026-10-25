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
      <PageHeading
        eyebrow="THE STORY BEHIND THE READINGS"
        title="Temperature Trends"
        description="Explore how temperatures change throughout an experiment."
      />
      <TrendPanel full initialId={experiment} />
      <p className="page-note">
        All temperatures use Celsius (°C). Dates and times are displayed in
        Bangkok time (ICT, UTC+7). CSV files also preserve UTC timestamps.
      </p>
    </>
  );
}
