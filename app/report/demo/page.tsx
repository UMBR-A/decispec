import { ProofReportView } from "../../../components/ProofReportView";

export default async function DemoReportPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const params = await searchParams;
  return <ProofReportView corrected={params.state === "corrected"} generatedAt={new Date().toISOString()} />;
}
