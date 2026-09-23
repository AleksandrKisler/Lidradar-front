# LidRadar Web

Веб-клиент LidRadar: Vue 3, TypeScript, Vite, Tailwind CSS v4, Reka UI, Pinia, TanStack Query. Архитектура — Feature-Sliced Design. Backend и контракт API живут в отдельном репозитории (`Lidradar`, каталог `backend/`, файл `docs/api/openapi.yaml`); сюда контракт копируется снимком и превращается в типы.

## Быстрый старт

```sh
nvm install
nvm use
npm ci
npm run dev
```

Приложение открывается на http://127.0.0.1:5173 и проксирует `/api` на учебный стенд backend `http://127.0.0.1:8081`. Стенд поднимается из репозитория backend командой `make frontend-up` (описание, учётные записи и файл с паролем — в его `docs/runbooks/frontend-development.md`). Пароль стенда не попадает в этот репозиторий, скриншоты и логи.

Node закреплён в `.nvmrc`; `engine-strict` не даст поставить зависимости другой версией.

## Команды

| Команда                     | Назначение                                                                    |
| --------------------------- | ----------------------------------------------------------------------------- |
| `npm run dev`               | Локальная разработка с HMR и proxy `/api` → стенд                             |
| `npm run build:prod`        | Проверка типов и production-сборка без source maps                            |
| `npm run build:pre-prod`    | Та же сборка с настройками pre-prod                                           |
| `npm run preview`           | Раздача готового `dist` на 4173 (не production-сервер)                        |
| `npm run check`             | Полный quality gate: формат, ESLint, Steiger, контракт, типы, тесты, покрытие |
| `npm run test:unit`         | Vitest однократно                                                             |
| `npm run test:coverage`     | Vitest с порогами покрытия, отчёт `coverage/index.html`                       |
| `npm run test:e2e`          | Playwright на собранном pre-prod с мок-API                                    |
| `npm run api:sync`          | Скопировать `openapi.yaml` из репозитория backend в `contracts/`              |
| `npm run api:generate`      | Перегенерировать `src/shared/api/generated/schema.d.ts`                       |
| `npm run api:check`         | Убедиться, что сгенерированные типы соответствуют снимку контракта            |
| `npm run lint` / `lint:fsd` | ESLint с локальным правилом FSD / Steiger                                     |
| `npm run format`            | Prettier                                                                      |

Перед первым E2E: `npx playwright install` (в Linux CI — `--with-deps`).

## Что уже есть

- **Транспорт**: типизированный клиент `openapi-fetch` по сгенерированной схеме, единый `ApiError`, обязательный `X-Tenant-ID` у tenant-scoped операций, `X-Request-ID`, таймаут, запрет машинных путей; поток сигналов `/events` через streaming `fetch` с backoff и полной ресинхронизацией после разрыва.
- **Сессия**: HttpOnly cookie backend, хранилище Pinia только для `/auth/me`, выбор организации с проверкой членства, guard-ы маршрутов, обработка истечения сессии без цикла обновлений.
- **Экраны**: вход, регистрация, выбор рабочего пространства, создание организации, оболочка с навигацией по правам, Radar (сводка и лента активных рисков с фильтрами и постраничной загрузкой), карточка риска (`/risks/:riskId`: причина, контекст переписки и сделки, рекомендация, история, команды «взять в работу» и «закрыть», запись действий и исходов с ключом идемпотентности), подтверждение оплаты с атрибуцией «возвращённая / обычная / неизвестна», вердикт по сигналу (подтвердился / ложное срабатывание с причиной и предупреждением о каскаде), realtime-обновления по SSE с честным индикатором состояния потока, диалоги (список с поиском и фильтром «с риском», переписка только для чтения с подгрузкой ранних сообщений), онбординг с возобновлением по серверному статусу (компания → точка и график → услуги → источник) и настройки владельца (компания, точки, недельный график, каталог услуг), интеграции источников (Telegram-бот и webhook с одноразовыми секретами, живая проверка связи, отключение), уведомления (личная привязка Telegram по одноразовой ссылке с ограниченной проверкой статуса, настройки по пяти типам риска с полным `PUT`, тихими часами через полночь и сбросом к значению по умолчанию; доступны владельцу и менеджеру), команда (участники с защитой последнего владельца, смена роли и отзыв доступа с подтверждением, одноразовые коды приглашений и их приём сеансом без организации).
- **Качество**: строгий TypeScript, ESLint + Steiger для FSD, Vitest с порогами покрытия, Playwright с axe, CI-конвейер и контейнер Nginx.

Дальнейшие блоки (аналитика, приватность, админка) добавляются по той же схеме; их порядок и требования описаны в `docs/front-end/` репозитория backend.

## Структура

```text
src/
  app/            # вход, провайдеры (Pinia, Query, контекст API), маршруты и guard-ы, layouts, тема
  pages/          # login, register, workspaces, onboarding, radar, risk, conversations, integrations, settings, not-found
  widgets/        # app-shell, radar-summary, risk-feed, risk-workspace, conversation-list, conversation-thread, onboarding-progress, integrations-list
  features/       # auth-session, select-workspace, create-organization, risk-commands, record-action, record-outcome, confirm-revenue, risk-feedback, edit-organization, manage-locations, edit-business-hours, manage-services, connect-channel, disconnect-channel, check-channel-health
  entities/       # session, organization, location, service, integration, risk, revenue, conversation
  shared/
    api/          # generated/ (типы контракта), client/ (клиент, ошибки, контекст, ключи)
    config/       # проверка VITE_* при старте
    lib/          # деньги, даты, путь возврата, сигналы отмены, UUID
    ui/           # Ui* примитивы
contracts/        # снимок openapi.yaml и его источник
scripts/          # синхронизация и проверка контракта
tests/            # unit/ (Vitest) и e2e/ (Playwright)
tooling/eslint/   # локальное правило FSD и его тесты
deploy/           # Nginx
docs/             # архитектура, окружения, тесты, выпуск, результаты проверки
```

## Документация

- [Архитектура](docs/architecture.md)
- [Окружения, стенд и контракт API](docs/environments.md)
- [Тесты и quality gates](docs/testing.md)
- [CI, контейнер и выпуск](docs/deployment.md)
- [Результаты проверки](docs/validation.md)
