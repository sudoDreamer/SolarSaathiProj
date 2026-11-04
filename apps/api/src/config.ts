import { config } from 'dotenv';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
config({ path: '.env.development', quiet: true } as Parameters<typeof config>[0]);
config();
const schema = z.object({
  LOCAL_MODE: z.enum(['true', 'false']).default('true'),
  DATA_DRIVER: z.enum(['json', 'mongo']).default('json'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().url().default('http://127.0.0.1:5173'),
  MONGODB_URI: z
    .string()
    .default('mongodb://127.0.0.1:27017/solarsaathi_dev?directConnection=true'),
  OTP_MODE: z.enum(['console', 'sms']).default('console'),
  JWT_ACCESS_SECRET: z.string().optional(),
  OTP_PEPPER: z.string().optional(),
  FIELD_ENCRYPTION_KEY: z.string().optional(),
  SEED_ADMIN_MOBILE_E164: z.string().default('+919999999991'),
  SEED_ANALYST_MOBILE_E164: z.string().default('+919999999992'),
});
export type Config = z.infer<typeof schema> & {
  JWT_ACCESS_SECRET: string;
  OTP_PEPPER: string;
  FIELD_ENCRYPTION_KEY: string;
};
export async function loadConfig(): Promise<Config> {
  const env = schema.parse(process.env);
  if (env.LOCAL_MODE !== 'true' || process.env.NODE_ENV === 'production') {
    throw new Error(
      'This local-first build is not production-qualified. LOCAL_MODE=true and non-production NODE_ENV are required. SMS/cloud drivers require implementation before deployment.',
    );
  }
  if (env.OTP_MODE !== 'console')
    throw new Error('Only the local console OTP driver is implemented.');
  await mkdir('.local', { recursive: true });
  let secrets: Record<string, string>;
  try {
    secrets = JSON.parse(await readFile('.local/secrets.json', 'utf8')) as Record<string, string>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    secrets = {
      JWT_ACCESS_SECRET: randomBytes(48).toString('base64url'),
      OTP_PEPPER: randomBytes(48).toString('base64url'),
      FIELD_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
    };
    await writeFile('.local/secrets.json', JSON.stringify(secrets), { mode: 0o600 });
  }
  const result = {
    ...env,
    JWT_ACCESS_SECRET: env.JWT_ACCESS_SECRET || secrets.JWT_ACCESS_SECRET,
    OTP_PEPPER: env.OTP_PEPPER || secrets.OTP_PEPPER,
    FIELD_ENCRYPTION_KEY: env.FIELD_ENCRYPTION_KEY || secrets.FIELD_ENCRYPTION_KEY,
  };
  if (
    result.JWT_ACCESS_SECRET.length < 32 ||
    result.OTP_PEPPER.length < 32 ||
    !/^[a-f0-9]{64}$/i.test(result.FIELD_ENCRYPTION_KEY)
  )
    throw new Error(
      'Secrets must have at least 32 characters; FIELD_ENCRYPTION_KEY must be 64 hex characters.',
    );
  return result;
}
