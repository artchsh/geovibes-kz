import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  APP_ORIGIN: z.string().url(),
  MOBILE_ORIGINS: z.string().transform((value, context) => {
    const origins = value.split(",").map((origin) => origin.trim()).filter(Boolean);
    if (origins.some((origin) => origin === "*" || !URL.canParse(origin))) {
      context.addIssue({
        code: "custom",
        message: "MOBILE_ORIGINS must contain exact valid origins and cannot use a wildcard",
      });
      return z.NEVER;
    }
    return [...new Set(origins)];
  }),
  TRUSTED_PROXY_SECRET: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().min(32).optional(),
  ),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  MEDIA_ROOT: z.string().min(1).default("./storage"),
  MAX_UPLOAD_BYTES: z.coerce.number().int().min(1).default(10_485_760),
});

export type AppEnv = z.infer<typeof envSchema>;

export const parseEnv = (input: Record<string, string | undefined>): AppEnv =>
  envSchema.parse(input);

export const env = parseEnv(process.env);