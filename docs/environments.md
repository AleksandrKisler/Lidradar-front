# Окружения, стенд и контракт API

| Среда    | Vite mode   | Файл             | Сборка                 |
| -------- | ----------- | ---------------- | ---------------------- |
| dev      | development | .env.development | npm run build:dev      |
| pre-prod | preprod     | .env.preprod     | npm run build:pre-prod |
| prod     | production  | .env.production  | npm run build:prod     |

Vite mode и NODE_ENV — разные вещи: `vite build --mode preprod` остаётся production-оптимизированной сборкой.

## Переменные

- `VITE_APP_ENV` — строго `dev`, `pre-prod` или `prod`.
- `VITE_API_ORIGIN` — origin API без пути (`https://api.example.com`) либо пустая строка: запросы идут на тот же origin, что и приложение. Значение с путём, схемой `javascript:` или относительный адрес отклоняются при старте.
- `DEV_API_TARGET` — адрес backend для proxy dev-сервера (по умолчанию `http://127.0.0.1:8081`). Без префикса `VITE_`, в сборку не попадает.

`src/shared/config/env.ts` проверяет переменные valibot-схемой при загрузке модуля; при ошибке приложение не стартует и печатает список проблем. Любые `VITE_*` публичны: секретов во frontend нет и быть не может.

Личные настройки — в `.env.development.local` (исключён из Git). Приоритет Vite: переменные процесса > `.env.[mode].local` > `.env.[mode]` > `.env.local` > `.env`.

## Сессия и origin

Backend выдаёт сессию в HttpOnly cookie `lidradar_session` и ждёт заголовок `X-Tenant-ID` у tenant-scoped запросов. Клиент всегда отправляет `credentials: 'include'`.

- В разработке cookie работает благодаря proxy: браузер видит только `127.0.0.1:5173`.
- В контейнере и на стенде `/api` должен проксироваться ingress/Nginx на backend с того же origin (`deploy/nginx.conf` пока отвечает 503 — замените на `proxy_pass`). Тогда `VITE_API_ORIGIN` остаётся пустым.
- Если API на другом origin, задайте `VITE_API_ORIGIN`, включите на backend CORS с `credentials` для точного origin приложения (`LIDRADAR_ALLOWED_ORIGINS`) и добавьте origin в CSP `connect-src`.

## Учебный стенд backend

Стенд описан в репозитории backend: `docs/runbooks/frontend-development.md`. Кратко:

```sh
# в репозитории backend
make frontend-up      # Postgres, миграции, фикстуры, API на :8081
make frontend-down
```

Три учётные записи (`empty@`, `small@`, `large@lidradar.test`) покрывают пользователя без организаций, небольшую и большую организацию. Пароль лежит в файле `runtime/frontend/password.txt` того репозитория с правами `0600`; не копируйте его в код, тесты, скриншоты и логи. Схема стенда закреплена константой `SchemaVersion` в `backend/internal/devdata`.

## Контракт API

Источник истины — `docs/api/openapi.yaml` в репозитории backend. Порядок обновления:

```sh
LIDRADAR_BACKEND_DIR=../Lidradar npm run api:sync   # копирует снимок и записывает commit в contracts/source.json
npm run api:generate                                # обновляет src/shared/api/generated/schema.d.ts
npm run typecheck                                   # показывает, где интерфейс разошёлся с контрактом
```

`npm run api:check` (часть `npm run check`) регенерирует типы во временный файл и сравнивает с зафиксированными: ручные правки в `generated/` и устаревшие типы не пройдут CI. Сгенерированный файл исключён из ESLint и Prettier.

## Изменение конфигурации после сборки

Переменные встраиваются во время `vite build`: готовому контейнеру новые `VITE_*` ничего не изменят, нужна пересборка. Для одного образа во всех средах понадобится runtime-конфигурация с валидацией до монтирования — это отдельный контракт поставки. Приложение рассчитано на корень домена; для подкаталога настройте `base` в Vite и fallback веб-сервера.
