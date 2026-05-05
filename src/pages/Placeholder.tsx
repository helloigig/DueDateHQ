export function Placeholder({ name }: { name: string }) {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-xl font-semibold text-ink-900">{name}</h1>
      <p className="mt-3 text-sm text-ink-500">
        This surface is out of scope for the MVP frontend pass. The dashboard,
        client detail, and announcement detail are the focused deliverables.
      </p>
    </div>
  );
}
