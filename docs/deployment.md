# CI, контейнер и выпуск

## GitHub Actions

`.github/workflows/ci.yml` запускает quality gate, сборки трёх сред, E2E на четырёх browser-профилях и Docker smoke. Настройте branch protection: обязательны quality, builds, e2e, container; запретите merge при провале. Для другой CI переносите те же команды.

Dependabot проверяет npm, Actions и Docker. Зависимости npm закреплены точными версиями и lockfile. Docker base images и Actions сейчас закреплены тегами; для контролируемой поставки замените на проверенные digest/commit SHA и настройте их обновление. `npm audit` используйте при обновлениях и перед релизом; не применяйте `--force` автоматически.

## Docker

```sh
docker compose up --build -d
# http://127.0.0.1:8080
APP_MODE=preprod docker compose up --build -d
# остановка
 docker compose down
```

Multi-stage build, непривилегированный Nginx на 8080, read-only filesystem, tmpfs /tmp, dropped capabilities, healthcheck. nginx.conf задаёт SPA fallback и кеширование: assets год, HTML без долгого кеша. Dotfiles закрыты. `/api` по умолчанию 503. Настройте reverse proxy к реальному backend; DNS-имя upstream должно разрешаться внутри контейнера.

TLS и HSTS настройте на ingress. Для внешнего API добавьте его точный origin в CSP connect-src и CORS backend. Для CDN/шрифтов/аналитики явно обновляйте CSP. Не расширяйте script-src до unsafe-inline ради устранения ошибок.

## Dev → pre-prod → prod

1. PR: обязательные проверки из CI.
2. Merge: собрать артефакт из фиксированного commit, сохранить commit SHA и версию lockfile в релизной записи.
3. Pre-prod: передать адрес backend на этапе сборки, развернуть в отдельной среде, прогнать smoke и ручную приёмку.
4. Prod: выпуск того же commit с prod-конфигурацией после approval в CI environment; сохранить предыдущий образ/артефакт для rollback.
5. После выпуска: healthcheck, загрузка страницы, API, ошибки браузера; при деградации вернуть предыдущий артефакт вместе с его конфигурацией.

Автоматический деплой намеренно не привязан к облаку: сервер, registry, домены и способ доступа не указаны. Настройте защищённые GitHub Environments `pre-prod` и `prod`, environment-scoped secrets, отдельную учётную запись с минимальными правами; затем добавьте deployment job под свою инфраструктуру. Текущий CI ничего не публикует.

## Перед реальным prod

- Отключить demo-mode, подключить и протестировать backend и серверное сохранение.
- Настроить auth/CSRF, обработку сессий и права; не хранить долгоживущие токены в localStorage.
- Подключить сбор ошибок и метрик по требованиям проекта; не отправлять персональные данные автоматически.
- Настроить домен, HTTPS, CSP, API и timeouts.
- Проверить браузеры целевой аудитории: target es2022 и Tailwind v4 рассчитаны на современные браузеры.
- Проверить rollback и доступ к логам. Не публиковать source maps; если нужны error-tracking maps, загружать приватно.
