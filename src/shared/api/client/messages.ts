/**
 * Безопасные подписи ошибок для интерфейса.
 *
 * Серверное `message` не выводится напрямую: оно может измениться, быть на
 * другом языке или содержать технические детали. Текст выбирается по коду,
 * а для неизвестного кода — по классу HTTP-статуса.
 */
import { ApiError, CLIENT_ERROR_CODES } from './api-error'

export interface ApiErrorDescription {
  /** Короткий заголовок состояния. */
  title: string
  /** Что произошло и что можно сделать дальше. */
  description: string
}

const byCode: Record<string, ApiErrorDescription> = {
  INVALID_ARGUMENT: {
    title: 'Данные не приняты',
    description: 'Проверьте заполненные поля и повторите отправку.',
  },
  TENANT_REQUIRED: {
    title: 'Организация не выбрана',
    description: 'Выберите рабочее пространство и повторите действие.',
  },
  INVALID_TENANT: {
    title: 'Организация не выбрана',
    description: 'Выберите рабочее пространство и повторите действие.',
  },
  UNAUTHENTICATED: {
    title: 'Сессия завершена',
    description: 'Войдите снова, чтобы продолжить работу.',
  },
  INVALID_CREDENTIALS: {
    title: 'Не удалось войти',
    description: 'Проверьте электронную почту и пароль.',
  },
  FORBIDDEN: {
    title: 'Раздел недоступен',
    description:
      'У вашей роли нет доступа к этому действию. Обратитесь к владельцу рабочего пространства.',
  },
  ORIGIN_NOT_ALLOWED: {
    title: 'Запрос отклонён',
    description: 'Приложение открыто с неразрешённого адреса. Обратитесь к администратору.',
  },
  NOT_FOUND: {
    title: 'Не найдено',
    description: 'Объект отсутствует или недоступен в этой организации.',
  },
  ROUTE_NOT_FOUND: {
    title: 'Не найдено',
    description: 'Запрошенный адрес не существует.',
  },
  CONFLICT: {
    title: 'Конфликт данных',
    description: 'Состояние изменилось. Обновите данные и примите решение заново.',
  },
  EMAIL_ALREADY_REGISTERED: {
    title: 'Электронная почта уже используется',
    description: 'Войдите с этим адресом или используйте другой.',
  },
  INVALID_STAGE_TRANSITION: {
    title: 'Переход невозможен',
    description: 'Этап сделки изменился. Обновите данные и выберите допустимый переход.',
  },
  IDEMPOTENCY_CONFLICT: {
    title: 'Повтор с другим содержимым',
    description: 'Эта отправка уже выполнена с другими данными. Обновите форму и отправьте заново.',
  },
  RECOVERED_ALREADY_ATTRIBUTED: {
    title: 'Возвращённая выручка уже учтена',
    description:
      'У этой сделки уже есть подтверждение с типом «возвращённая». Дополнительные оплаты подтверждаются как обычные.',
  },
  LAST_OWNER: {
    title: 'Последний владелец',
    description: 'В организации должен остаться хотя бы один активный владелец.',
  },
  MEMBER_DISABLED: {
    title: 'Доступ участника отозван',
    description: 'Роль отозванного участника изменить нельзя. Пригласите его заново.',
  },
  INVITATION_EXPIRED: {
    title: 'Срок приглашения истёк',
    description: 'Попросите владельца выпустить новый код.',
  },
  INVITATION_REVOKED: {
    title: 'Приглашение отозвано',
    description: 'Попросите владельца выпустить новый код.',
  },
  INVITATION_USED: {
    title: 'Приглашение уже использовано',
    description: 'Код действует один раз. Попросите владельца выпустить новый.',
  },
  ALREADY_MEMBER: {
    title: 'Вы уже участник',
    description: 'Эта организация уже доступна в списке ваших рабочих пространств.',
  },
  PAYLOAD_TOO_LARGE: {
    title: 'Слишком большой запрос',
    description: 'Сократите объём данных и повторите отправку.',
  },
  RATE_LIMITED: {
    title: 'Слишком много попыток',
    description: 'Подождите указанное время и повторите попытку.',
  },
  SERVICE_NOT_READY: {
    title: 'Сервис недоступен',
    description: 'Сервер ещё не готов принимать запросы. Повторите попытку позже.',
  },
  CONNECTOR_UNAVAILABLE: {
    title: 'Подключение недоступно',
    description: 'Внешний сервис не настроен или временно недоступен.',
  },
  UNAVAILABLE: {
    title: 'Обновления временно недоступны',
    description: 'Поток сигналов не работает. Данные обновляются по запросу.',
  },
  INTERNAL_ERROR: {
    title: 'Внутренняя ошибка сервера',
    description:
      'Повторите попытку. Если ошибка повторяется, сообщите идентификатор из технических деталей.',
  },
  [CLIENT_ERROR_CODES.network]: {
    title: 'Нет связи с сервером',
    description: 'Проверьте подключение к интернету и повторите попытку. Данные не изменены.',
  },
  [CLIENT_ERROR_CODES.malformed]: {
    title: 'Неожиданный ответ сервера',
    description: 'Ответ не удалось разобрать. Повторите попытку позже.',
  },
  [CLIENT_ERROR_CODES.tenantRequired]: {
    title: 'Организация не выбрана',
    description: 'Выберите рабочее пространство и повторите действие.',
  },
  [CLIENT_ERROR_CODES.tenantMismatch]: {
    title: 'Организация изменилась',
    description: 'Данные запрошены для другой организации. Обновите страницу.',
  },
}

function byStatus(status: number): ApiErrorDescription {
  if (status === 0) return byCode[CLIENT_ERROR_CODES.network]!
  if (status === 401) return byCode.UNAUTHENTICATED!
  if (status === 403) return byCode.FORBIDDEN!
  if (status === 404) return byCode.NOT_FOUND!
  if (status === 429) return byCode.RATE_LIMITED!
  if (status >= 500) {
    return {
      title: 'Сервер временно недоступен',
      description: 'Повторите попытку через несколько секунд.',
    }
  }
  return { title: 'Запрос не выполнен', description: 'Проверьте данные и повторите попытку.' }
}

/** Подпись состояния для любой ошибки, включая неизвестные. */
export function describeError(error: unknown): ApiErrorDescription {
  if (error instanceof ApiError) {
    const known = byCode[error.code]
    if (known) return known
    return byStatus(error.httpStatus)
  }
  return {
    title: 'Что-то пошло не так',
    description: 'Повторите попытку. Если ошибка повторяется, обновите страницу.',
  }
}
