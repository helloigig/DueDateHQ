import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "../lib/api/client";

export function useImportHistory() {
  return trpc.imports.listHistory.useQuery();
}

export function useInvalidateImports() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [["imports"]] });
    qc.invalidateQueries({ queryKey: [["clients"]] });
    qc.invalidateQueries({ queryKey: [["deadlines"]] });
  };
}

export function useCommitImport() {
  const invalidate = useInvalidateImports();
  return trpc.imports.commit.useMutation({ onSuccess: invalidate });
}

export function useUndoImport() {
  const invalidate = useInvalidateImports();
  return trpc.imports.undo.useMutation({ onSuccess: invalidate });
}
