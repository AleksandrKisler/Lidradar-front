/**
 * Схема формы подключения. Секреты проверяются только по формату контракта и
 * никуда не сохраняются: для Telegram токен обязателен, для webhook секрет
 * необязателен — без него сервер выпустит свой и покажет один раз.
 */
import * as v from 'valibot'
import {
  BOT_TOKEN_PATTERN,
  CONNECTABLE_PROVIDERS,
  WEBHOOK_SECRET_MAX_LENGTH,
  WEBHOOK_SECRET_MIN_LENGTH,
} from '@/entities/integration'

export const connectChannelSchema = v.pipe(
  v.object({
    provider: v.pipe(
      v.string(),
      v.check(
        (value) => (CONNECTABLE_PROVIDERS as readonly string[]).includes(value),
        'Выберите источник',
      ),
    ),
    name: v.pipe(
      v.string(),
      v.trim(),
      v.nonEmpty('Введите название подключения'),
      v.maxLength(200, 'Слишком длинное название'),
    ),
    locationId: v.string(),
    botToken: v.pipe(v.string(), v.trim()),
    webhookSecret: v.pipe(v.string(), v.trim()),
  }),
  v.forward(
    v.check(
      (values) =>
        values.provider !== 'CONNECTED_BUSINESS_BOT' || BOT_TOKEN_PATTERN.test(values.botToken),
      'Токен бота имеет вид «123456789:AAH…» — скопируйте его из BotFather',
    ),
    ['botToken'],
  ),
  v.forward(
    v.check(
      (values) =>
        values.provider !== 'GENERIC_WEBHOOK' ||
        values.webhookSecret === '' ||
        (values.webhookSecret.length >= WEBHOOK_SECRET_MIN_LENGTH &&
          values.webhookSecret.length <= WEBHOOK_SECRET_MAX_LENGTH),
      `Секрет — от ${WEBHOOK_SECRET_MIN_LENGTH} до ${WEBHOOK_SECRET_MAX_LENGTH} символов или пусто`,
    ),
    ['webhookSecret'],
  ),
)

export type ConnectChannelValues = v.InferOutput<typeof connectChannelSchema>
