import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { type AuthedUser, verifyJwt } from "../auth/supabase.js";

export type Context = {
  user: AuthedUser | null;
};

export async function createContext({
  req,
}: FetchCreateContextFnOptions): Promise<Context> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  const user = token ? await verifyJwt(token) : null;
  return { user };
}
