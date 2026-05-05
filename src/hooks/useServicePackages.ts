import { trpc } from "../lib/api/client";

export function useServicePackages() {
  return trpc.servicePackages.list.useQuery();
}
