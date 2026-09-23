# CI, контейнер и выпуск

## GitHub Actions

`.github/workflows/ci.yml` запускает quality gate (`npm run check`), сборки трёх сред, E2E на четырёх browser-профилях и smoke контейнера. Настройте branch protection: обязательны quality, builds, e2e, container. Для другой CI переносите те же команды.

`npm run check` включает `npm run api:check`: если снимок контракта в `contracts/openapi.yaml` обновили без перегенерации типов (или правили `generated/` вручную), конвейер остановится. Порядок обновления контракта — в [environments.md](environments.md).

Dependabot проверяет npm, Actions и Docker. Зависимости закреплены точными версиями и lockfile. `npm audit` выполняйте при обновлениях и перед релизом; `--force` не применяйте автоматически.

## Docker

```sh
docker compose up --build -d
# http://127.0.0.1:8080
APP_MODE=preprod docker compose up --build -d
docker compose down
```

Multi-stage build, непривилегированный Nginx на 8080, read-only filesystem, tmpfs `/tmp`, dropped capabilities, healthcheck. `deploy/nginx.conf` задаёт SPA fallback и кеширование (assets — год, HTML — без кеша), закрывает dotfiles и отдаёт `/api` как 503, пока не настроен `proxy_pass` к backend.

Для работы сессии `/api` должен обслуживаться с того же origin, что и приложение: cookie `lidradar_session` HttpOnly, и клиент отправляет её с `credentials: 'include'`. Если backend вынесен на другой origin, задайте `VITE_API_ORIGIN` при сборке, добавьте origin в CSP `connect-src` и включите на backend CORS с credentials для точного origin приложения.

TLS и HSTS настраиваются на ingress. Для CDN, шрифтов или аналитики явно обновляйте CSP; не расширяйте `script-src` до `unsafe-inline`. Шрифт Inter поставляется из `public/fonts`, внешних источников у приложения нет.

## Dev → pre-prod → prod

1. PR: обязательные проверки CI; при изменении контракта — синхронизация снимка и перегенерация типов в том же PR.
2. Merge: собрать артефакт из фиксированного commit; в релизной записи сохранить commit SHA, версию lockfile и `backendCommit` из `contracts/source.json` — так видно, с какой версией API совместима сборка.
3. Pre-prod: передать `VITE_API_ORIGIN` (если нужен), развернуть в отдельной среде вместе с совместимым backend, прогнать smoke и ручную приёмку.
4. Prod: выпуск того же commit с prod-конфигурацией после approval в CI environment; сохранить предыдущий образ для rollback.
5. После выпуска: healthcheck, загрузка страницы, `/api/v1/auth/me` через ingress, ошибки браузера; при деградации вернуть предыдущий артефакт вместе с его конфигурацией.

Автоматический деплой намеренно не привязан к облаку. Настройте защищённые GitHub Environments `pre-prod` и `prod`, environment-scoped secrets и отдельную учётную запись с минимальными правами; затем добавьте deployment job под свою инфраструктуру. Текущий CI ничего не публикует.

## Перед реальным prod

- Настроить `proxy_pass` `/api` на backend и проверить cookie сессии, выход и истечение сессии через ingress.
- Убедиться, что backend выпущен с тем же или совместимым контрактом (`contracts/source.json`).
- Подключить сбор ошибок и метрик по требованиям проекта; `traceId` из `ApiError` — ключ для сопоставления с логами backend. Персональные данные автоматически не отправлять.
- Настроить домен, HTTPS, CSP и таймауты ingress не короче клиентского (15 с).
- Проверить браузеры целевой аудитории: target es2022 и Tailwind v4 рассчитаны на современные браузеры.
- Проверить rollback и доступ к логам. Source maps prod не публикуются; при необходимости загружать их приватно в систему сбора ошибок.
