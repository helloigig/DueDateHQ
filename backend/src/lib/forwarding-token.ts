/**
 * Per-task forwarding email local part. Format:
 *   <client-firstname>-<short-token>
 * The token is the first 6 hex chars of the deadline id, ensuring
 * uniqueness across the firm without exposing the full UUID.
 */
export function forwardingTokenFor(
  clientName: string,
  deadlineId: string,
): string {
  const slug = clientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
  const token = deadlineId.replace(/-/g, "").slice(0, 6);
  return `${slug || "client"}-${token}`;
}
