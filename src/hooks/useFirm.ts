import { useRemoteSession } from "./useSession";

export function useFirm() {
  const { data, isLoading, error } = useRemoteSession();
  return {
    firm: data?.firm ?? null,
    isLoading,
    error,
  };
}
