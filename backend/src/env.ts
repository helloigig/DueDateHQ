import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.string().default("*"),
  // Optional in dev: when missing, emails.send logs + skips Resend but
  // still flips the draft to `sent` so the UI advances. Production
  // sets this via `fly secrets set RESEND_API_KEY=…`.
  RESEND_API_KEY: z.string().optional(),
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
