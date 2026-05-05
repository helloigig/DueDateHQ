import { PageContainer } from "../components/ui/PageContainer";
import { PageHeader } from "../components/ui/PageHeader";

export function Placeholder({ name }: { name: string }) {
  return (
    <PageContainer>
      <PageHeader title={name} />
      <p className="text-sm text-ink-500">
        This surface is out of scope for the MVP frontend pass. The dashboard,
        client detail, and announcement detail are the focused deliverables.
      </p>
    </PageContainer>
  );
}
