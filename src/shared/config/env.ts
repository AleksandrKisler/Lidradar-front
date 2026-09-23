/**
 * Публичная конфигурация приложения.
 *
 * Vite встраивает переменные `VITE_*` в сборку, поэтому здесь не может быть
 * секретов. Схема проверяется один раз при старте: неверная конфигурация
 * останавливает приложение сразу, а не подменяется значением по умолчанию.
 */
import * as v from 'valibot'

/** Допустимые значения окружения; влияют только на служебные подписи. */
export const APP_ENVIRONMENTS = ['dev', 'pre-prod', 'prod'] as const

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number]

const originPattern = /^https?:\/\/[^/?#]+$/

const schema = v.object({
  VITE_APP_ENV: v.picklist(APP_ENVIRONMENTS, 'VITE_APP_ENV должен быть dev, pre-prod или prod'),
  /**
   * Источник API без завершающего слэша, например `https://api.example.com`.
   * Пустая строка означает тот же origin, что и у приложения: пути OpenAPI
   * (`/api/v1/...`) подставляются к нему без изменений.
   */
  VITE_API_ORIGIN: v.optional(
    v.pipe(
      v.string(),
      v.check(
        (value) => value === '' || originPattern.test(value),
        'VITE_API_ORIGIN должен быть пустым или абсолютным http(s)-origin без пути',
      ),
    ),
    '',
  ),
})

export type Env = v.InferOutput<typeof schema>

/**
 * Проверяет произвольный объект переменных окружения и возвращает
 * типизированную конфигурацию. Бросает ошибку с перечнем нарушений.
 */
export function parseEnv(input: unknown): Env {
  const result = v.safeParse(schema, input)
  if (!result.success) {
    const issues = result.issues.map((issue) => issue.message).join('; ')
    throw new Error(`Некорректная конфигурация приложения: ${issues}`)
  }
  return result.output
}

/** Проверенная конфигурация текущей сборки. */
export const env: Env = parseEnv(import.meta.env)
