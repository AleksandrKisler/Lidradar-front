# Песочница переписки · handoff 31.10.2026

Реализация готова; общий TEST gate S2 — **FAIL**, независимый FUNCTIONAL —
**BLOCKED**, независимый UI desktop/tablet/mobile — **UNVERIFIED**.
Поручение владельца: текущие цвета и концепция LidRadar, stage и localhost,
**production исключён**. Scope — frontend/mock части US-M17-01–07 (SB-01–06),
а не полный живой прогон AI. [Критерии](scope.md), [manifest](manifest.md).

## Поведение и запуск

`npm run dev:stage` → `http://127.0.0.1:5173/sandbox` после входа в тестовую
организацию. Существующая `.env.stage.local` найдена; её содержимое не выводилось.
Localhost использует существующий stage proxy, локальный backend не нужен.
Песочница появляется в меню только при серверном `sandbox: true` и праве
`conversation.read`; без флага прямой адрес не вызывает sandbox API.

Экран использует Inter, синий brand, белые cards и существующие UI-примитивы.
Доступны квалифицированные шаблоны, точка/имя, редактирование состава переписки,
паузы/давность, сохранение черновика user+tenant, отправка и продолжение переписки,
реальные статусы/найденные риски и переходы в Radar/Диалоги.
Неизвестный результат сохраняет исходную пару key/body, в том числе после reload.
Выбранная PROCESSING переписка опрашивается отдельным GET/3сек; позднее старое
чтение не откатывает подтверждённое сообщение. Серверные лимиты прежние.

## Файлы текущего поручения

- `src/pages/sandbox/index.ts`, `api/sandbox-api.ts`, `model/use-sandbox.ts`,
  `ui/SandboxPage.vue` — новый раздел, typed API, состояние/команды и UI.
- `src/entities/session/model/session-store.ts` — capability из `/auth/me`,
  сброс при выходе/потере сессии.
- `src/app/router/routes.ts`, `src/widgets/app-shell/model/navigation.ts`,
  `src/widgets/app-shell/ui/RadarNav.vue`, `SidebarNav.vue` — маршрут и меню.
- `tests/e2e/sandbox.spec.ts`, `tests/unit/pages/sandbox.test.ts`,
  новые проверки в `tests/unit/entities/session-store.test.ts`.
- `README.md`, `docs/frontend-v2/STATUS.md`, эта папка evidence.

Остальные dirty/untracked исходники предыдущей работы не откатывались.
Backend/ADR/API/generated, package-lock, бюджеты и Figma не менялись;
commit/push/merge/deploy не выполнялись.

## Проверки и evidence

Node24.19.0, HEAD4e175e9 + dirty; S2 inventory583 SHA `c85a6d75…43e0a84`.
Все полные hashes и архив без секретных env — в manifest. Ещё7 tracked публичных
конфигураций dotenv/npm отдельно сверены с HEAD; все совпали.

Root: адресные unit39/39 и stock browser matrix24/24, exit0. QA S2:
`npm run check`0 (1143unit, FSD/architecture, format/lint/API/typecheck),
`build:dev`/`build:pre-prod`/`build:prod`/`audit:release` —0.
Coverage: statements94.58%, branches86.98%, functions96.31%, lines96.74%.
JS899800/905600, CSS69311/72000, initial249265/304800; бюджеты прежние.

S1 FAIL сохранён: QA-SB01 native select overflow21px WebKit/mobile320,
QA-SB02 отсутствие detail3s. Оба исправлены и закрыты адресными проверками
на S2, assertions0overflow сохранены. Новые тесты проверяют sendunknown/reload,
точный интервал, user/tenant late-response, capability loss, ограничения и
conflict/expired, отмену старого чтения после успешного сообщения.

Первые два полных S2 E2E: каждый655PASS/32прежнихskip/1FAIL; разные старые
WebKit сценарии integrations и notifications. Интеграции адресно2/2PASS и во
втором fullPASS. Assertions/timeouts/retries не менялись. Заключительный
serial full workers1 тоже exit1:655PASS/32skip/1FAIL в прежнем mobile-сценарии
уведомлений — после клика не появилась ссылка «Открыть бота», POST выпуска
ссылки отсутствовал в trace. WebKit desktop интеграции и уведомления в serial
прошли. Гипотеза, что достаточно снизить параллелизм, не подтвердилась.
Новых full без нового основания не запускать; причину старых кликов не считаем
доказанной и чужой runtime/тесты ради зелёного результата не меняем.

В каждом полном S2 прогоне новые sandbox24/24 — PASS. Все три full FAIL
сохранены. Общий TEST — **FAIL**, FUNCTIONAL — **BLOCKED** по предпосылке TEST,
независимый UI desktop/tablet/mobile — **UNVERIFIED** (не запускался). Основная
сессия просмотрела8actual Chromium draft/result PNG на1440/834/390/320 из
`qa/full-serial-results` без явных визуальных потерь; это spot-check, а не
независимая Figma UI-приёмка. Финальный QA: `S2/qa/report-final.md`.

Артефакты: `artifacts/frontend-v2/sandbox/Codex-R1/S2/`, QA логи/commands/PNG
в `qa/`. S1 и все неуспешные S2 попытки сохранены в отдельных output roots.

## Ограничения

Живой stage, AI pipeline/наступление и закрытие реальных рисков — UNVERIFIED.
Новый exact Figma frame для sandbox v2 не создавался; визуальная оценка возможна
по approved patterns текущих tokens/primitives/оболочки C. Доступ, онбординг,
Radar body и их макеты не менялись. Draft абсолютное время и расширенная
AI-диагностика не заявляются закрытыми шагами полного US-M17.

## Следующий шаг

Разобрать воспроизводимость прежних WebKit/mobile click failures настроек и
интеграций отдельной ограниченной задачей по сохранённым trace/network evidence.
После исправления/нового доказательства — новый snapshot и соответствующие gates,
затем независимые FUNCTIONAL и UI. Для выпуска отдельно требуется живой stage QA.
Песочницу можно открыть локально через указанную команду; deploy не выполнялся.
