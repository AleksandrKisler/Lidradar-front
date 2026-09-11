# Vue FSD Starter

Vue 3 + TypeScript + Vite + Reka UI + Tailwind CSS v4. Переносимый шаблон с примером интерфейса LidRadar, тестами и конфигурациями окружений. Это основа проекта, а не готовая CRM: backend и постоянное хранение не входят в поставку.

## Быстрый старт

```sh
nvm install
nvm use
npm ci
npm run dev
```

Открыть http://127.0.0.1:5173. Используйте npm и сохранённый `package-lock.json`. Node указан в `.nvmrc`; рекомендуемая версия для команды и CI — одна и та же.

По умолчанию **все окружения работают в демо-режиме**. Никаких реальных запросов или сохранения статуса: изменения сбрасываются при обновлении. Это позволяет запустить шаблон без backend. Перед реальным запуском отключите демо и реализуйте API по [инструкции](docs/environments.md).

## Команды

| Команда                  | Назначение                                                  |
| ------------------------ | ----------------------------------------------------------- |
| `npm run dev`            | Локальная разработка, HMR, `.env.development`               |
| `npm run dev:pre-prod`   | Dev-сервер с настройками pre-prod; это не production-сборка |
| `npm run build:dev`      | Сборка с dev-настройками и sourcemaps                       |
| `npm run build:pre-prod` | Оптимизированная pre-prod-сборка                            |
| `npm run build:prod`     | Оптимизированная prod-сборка, без sourcemaps                |
| `npm run preview`        | Проверка готового dist, не production-сервер                |
| `npm run check`          | Форматирование, ESLint, FSD, типы, тесты и coverage         |
| `npm run test`           | Vitest в watch-режиме                                       |
| `npm run test:unit`      | Однократный запуск Vitest                                   |
| `npm run test:coverage`  | Покрытие бизнес-логики, отчёт coverage/index.html           |
| `npm run test:e2e`       | Браузерные тесты собранного pre-prod                        |
| `npm run test:e2e:ui`    | Интерактивная отладка Playwright                            |
| `npm run format`         | Форматировать исходники и конфигурации                      |

Перед первым E2E: `npx playwright install` (Linux CI: `npx playwright install --with-deps`).

## Структура

```text
src/
  app/                         # точка входа, Router, глобальная тема
    router/
    styles/
  pages/                       # композиция страниц и маршрутов
    radar/ui/
    not-found/ui/
  widgets/                     # самостоятельные блоки страницы
    risk-workspace/ui/
  features/                    # пользовательские действия
    acknowledge-risk/ui/
  entities/                    # предметные сущности и их API
    risk/{api,model}/
  shared/                      # независимые от предметной области модули
    api/                       # HTTP-клиент и ошибки
    config/                    # валидация публичных переменных
    ui/                        # общие визуальные примитивы
    lib/                       # место для общих утилит
public/                        # файлы, копируемые без преобразований
tests/                        # ниже отдельные unit и e2e
  unit/
  e2e/
deploy/                        # Nginx и инструкция по размещению
.github/workflows/             # CI
.vscode/                       # рекомендуемые расширения и форматирование
tooling/eslint/                # дополнительный контроль FSD и тесты правила
docs/                          # архитектура, окружения, тесты, выпуск
```

Внешние импорты идут через `index.ts`; внутри слайса — относительные пути. Полные правила в [architecture.md](docs/architecture.md).

## Что настроить в первую очередь

1. Название приложения в `package.json`, `index.html`, `src/app/App.vue`.
2. Цвета и типографику в `src/app/styles/main.css`: Tailwind v4 использует `@theme`.
3. Backend: переменные окружений и `src/entities/risk/api/get-risk.ts`.
4. Авторизацию, политику сессий, CSRF и права на сервере; frontend не является границей доступа.
5. Домены, TLS, API-прокси и CSP в ingress/Nginx.
6. Репозиторий и защищённые окружения вашей CI/CD-системы.

## Документация

- [Архитектура и расширение](docs/architecture.md)
- [Dev / pre-prod / prod и API](docs/environments.md)
- [Тесты и quality gates](docs/testing.md)
- [Docker, CI и выпуск](docs/deployment.md)
- [Результаты проверки шаблона](docs/validation.md)

## Первичные источники

- [Vue + TypeScript](https://vuejs.org/guide/typescript/overview.html)
- [FSD](https://feature-sliced.design/docs/reference/layers)
- [Reka UI](https://reka-ui.com/docs/overview/introduction)
- [Tailwind + Vite](https://tailwindcss.com/docs/installation/using-vite)
- [Vite modes](https://vite.dev/guide/env-and-mode)
- [Vitest](https://vitest.dev/guide/)
- [Playwright](https://playwright.dev/docs/intro)
