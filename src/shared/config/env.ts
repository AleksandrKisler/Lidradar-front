import { z } from 'zod'
const schema = z.object({
  VITE_APP_ENV: z.enum(['dev', 'pre-prod', 'prod']),
  VITE_API_BASE_URL: z
    .string()
    .refine(
      (value) => (value.startsWith('/') && !value.startsWith('//')) || /^https?:\/\//.test(value),
      'Use /api or an HTTP(S) URL',
    ),
  VITE_DEMO_MODE: z.enum(['true', 'false']).transform((value) => value === 'true'),
})
// Не используем z.coerce.boolean(): строка "false" иначе становится true.
export function parseEnv(input: unknown) {
  return schema.parse(input)
}
export const env = parseEnv(import.meta.env)
