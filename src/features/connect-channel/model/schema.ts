/** Форма подключения Telegram: токен обязателен и проверяется до отправки. */
import * as v from 'valibot'
import { BOT_TOKEN_PATTERN } from '@/entities/integration'

export const connectChannelSchema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('Введите название подключения'),
    v.maxLength(200, 'Слишком длинное название'),
  ),
  locationId: v.string(),
  botToken: v.pipe(
    v.string(),
    v.trim(),
    v.regex(
      BOT_TOKEN_PATTERN,
      'Токен бота имеет вид «123456789:AAH…» — скопируйте его из BotFather',
    ),
  ),
})

export type ConnectChannelValues = v.InferOutput<typeof connectChannelSchema>
