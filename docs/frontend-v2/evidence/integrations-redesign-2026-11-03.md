# Интеграции · US-M04-01–06 · 03.11.2026

Реализован редизайн интеграций по утверждённым R1+R2: страница, источники,
состояния и действия, связанные окна и три адаптива. Основные изменения —
US-M04-01/02/04/05; ограничения уникальности и прав US-M04-03/06 сохранены.
Поручение: `prompts/integrations-redesign-2026-11-03.md`.

Текущий delivery candidate **integrations-r6** включает последний точечный
фикс скругления Tablet02–08. Независимые TEST/FUNCTIONAL PASS относятся кR5
в локальном frontend/mock-контуре. После новых полных Figma-экспортов UI R5:
desktopPASS/mobilePASS/tabletFAIL только по этомуradius. R6исправление прошло
typecheck/scopedESLint2files0; дополнительная functional/visual/E2Eприёмка
по новому поручению владельца не выполнялась. ИсторическийFAIL не заменялсяPASS.

Владелец разрешил commit/push и штатную stage-доставку с техническим подтверждением
работающей версии. Этот отчёт не объявляет функциональную готовность или отсутствие
регрессий. Полная регрессия/общая приёмка frontend **DEFERRED до завершения frontend**.
Дополнительные stage Smoke/регрессии/пользовательские сценарии **NOT RUN**;
обязательные automaticCIgates сохраняются.

## Реализация

| Story     | Результат frontend                                                                                                                                    |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-M04-01 | Сохранены пять коротких и 16 подробных шагов, увеличение изображений, возврат к форме с черновиком и управление фокусом                               |
| US-M04-02 | Оболочка C, источники и справка, Telegram, недоступный MAX, компактные личные уведомления; loading/empty/first-error/refresh/error и адресные повторы |
| US-M04-03 | Прежняя обработка 409 и уникальность бота; API и серверные правила не менялись                                                                        |
| US-M04-04 | Разделены статус источника, сохранённое чтение, REMOTE/LOCAL и реальная доставка; CheckError не подменяет статус, SourceError основан на health       |
| US-M04-05 | Подтверждение, отмена, локальное отключение, DELETE503, повтор, неизвестный результат, сохранение истории в объяснении; безопасный возврат фокуса     |
| US-M04-06 | Менеджеру недоступны source queries, команды и навигация; прямой URL показывает собственное недоступное состояние; личные уведомления независимы      |

Используются существующие tenant-scoped GET list, POST connect, GET health,
POST health/check, DELETE connection и существующая личная привязка Telegram.
Новых endpoints, API fields, generated types, бизнес-правил и ролей нет.
GET checkedAt обозначает время чтения; POST REMOTE учитывает health, а не
только успешный HTTP-код. Даже REMOTE+ACTIVE не объявляет доставку сообщения.

Команды захватывают tenant, connection, user и права, блокируют двойную отправку,
игнорируют поздний результат после смены контекста/unmount. Ответ проверки
публикуется в правильный cache, более ранние GET отменяются. Refresh error
сохраняет последние данные. TEST/IMPORT/GENERIC_WEBHOOK не превращаются в Telegram.

Write-only token формы больше не помещается в TanStack mutation variables/cache:
команда использует приватное состояние и существующий API client. После любой
отправки, закрытия или смены контекста token очищается. Просмотр инструкции
сохраняет черновик формы. Ответ 201 ERROR не выдаётся за активное подключение.

Для интеграций включена адаптивная инструкция: desktop сохраняет macOS guide,
tablet следует утверждённой композиции с временными macOS кадрами и iPhone
шагом 15, mobile содержит 16 согласованных iPhone шагов. Новые изображения
загружаются по требованию. Четыре перехода по этапам, увеличение, прокрутка,
возврат в форму и черновик сохранены. Default adaptive=false оставляет прежний
контент для других consumers. Локальный возврат фокуса после nextTick устраняет
подтверждённый порядок Reka unmount: закрывающееся окно отправляет autofocus,
пока вызывающая форма/инструкция ещё concealed. Shared primitives не менялись.

Если timezone организации ещё не получен, реальные timestamps не форматируются
как неподписанный UTC: показано «Часовой пояс не загружен», null остаётся «Ещё
не было». Ошибка организации имеет отдельный повтор без перечитывания источников;
уже известный timezone сохраняется при ошибке фонового обновления.

Для интеграций используются локальные баннеры, бейджи, SVG и стили. Цвета
muted/link в этой странице адаптированы существующими secondary/text-link:
исходный muted на утверждённом canvas #EFF1F5 дал axe contrast 4.48:1. Проверка
не ослаблялась. Общие UiDialog, UiSheetDialog, токены и стили других модулей
не менялись. Shared ShellLayout делегирует только integrations denied view
самой странице; RadarShell только для интеграций скрывает mobile date и читает
ту же list query для «Загружаем…»/«Данные не получены» без нового endpoint.

## Основные файлы

- Страница и композиция: `src/pages/integrations/ui/IntegrationsPage.vue`,
  `src/widgets/integrations-list/ui/IntegrationsList.vue`, `IntegrationCard.vue`,
  `IntegrationBanner.vue`, `IntegrationNotifications.vue` и локальные SVG.
- Команды: `src/features/check-channel-health/model/use-check-channel-health.ts`,
  `src/features/disconnect-channel/model/use-disconnect-channel.ts`,
  `src/features/connect-channel/model/use-connect-channel.ts`.
- Подключение и инструкция: `src/features/connect-channel/ui/ConnectChannelDialog.vue`,
  `TelegramInstructionDialog.vue`, `GuideAdaptiveIllustration.vue`,
  `GuideTabletIllustration.vue`, `model/mobile-guide-steps.ts`, `guide-mobile/`.
- Узкие integration route guards/индикация: `src/app/layouts/ShellLayout.vue`,
  `src/widgets/app-shell/ui/RadarShell.vue`.
- Выделенный E2E: `tests/e2e/integrations.spec.ts`; в `module-shell.spec.ts` и
  `workspace.spec.ts` изменены только связанные интеграционные проверки.
  Точные unit paths перечислены в командах ниже; полный состав — changed-files-r5.json.

## Ограничения контракта и живой проверки

1. В ChannelConnection нет username бота. Выводятся реальное имя подключения
   и provider; username не извлекается из токена и не запрашивается напрямую
   у Telegram. Часть AC-M04-02-08 с username — **API-LIMITED**.
2. DELETE503 именно отключения подтверждает локальное отключение, но не удаление
   настройки Telegram. Известный клиенту результат хранится только в памяти
   session/user/tenant/connection, переживает remount, сбрасывается при смене
   контекста и полном reload. Это не серверный признак и не storage.
3. DELETE204 означает также «уже отключено». После повторного DELETE204 маркер
   и текст неопределённости сохраняются; удалённое завершение AC-M04-05-05 —
   **API-LIMITED**. Для такой гарантии нужен отдельный серверный признак/результат
   удалённого удаления; backend этой задачей не расширялся.
4. Первое/новое Telegram-сообщение, остановка приёма после отключения за минуту,
   фактическая сохранность истории и reconnect в прежний диалог — **UNVERIFIED
   live**. Моки не закрывают эти шаги и серверную cross-account уникальность.
5. Реальные credentials не читались, общие источники/данные/лимиты не менялись.
   Stage revision/API hash/миграция не проверялись: stage QA не проводился.

## Снимок и evidence

Delivery candidate `integrations-r6`:734 inputs, manifest SHA
`7727ef2cf0ac1113ac36b370b630f65efa68ced6de606d1602dbfb2733efd033`.
От R5 изменены только radius metadata/renderer и форматирование двух prompt
Markdown. Три committed документа аналитики имеют только форматирование таблиц
для устранения известного сбоя обязательного stage CI; содержимое сверено.
Новых ручных функциональных/визуальных/E2E/smoke/регрессионных прогонов нет.
Ниже — последний независимый локальный QA снимок R5 и его evidence.

- Ветка `frontend/v2-implementation`, HEAD `d4a30aeafbde93a2b4e2a3eaf03921eedfaa5747`.
  Аналитика сохранена как готовая база; её тесты не запускались.
- Snapshot **integrations-r5**,734 inputs, manifest SHA-256
  `62bd44ec2745c9cfbc658ee703093b298292d3fcf73d38afdbfd4194feb5aab7`.
- Корень artifacts: `artifacts/frontend-v2/integrations-redesign-2026-11-03/`.
  `manifest-r5.json`, `changed-files-r5.json`, `static-files-r5-affected.json`.
- QA до/после TEST и FUNCTIONAL:734/734 hashes совпали, drift/missing/unlisted0.
  `qa-r5/report.md`, `commands.json`, `inheritance.json`, `diff-verification.json`,
  `ac-coverage.json` (45 строк), `snapshot-after-functional.json`.
- `browser-r9/`:180 новых PNG/117 metadata:63core×2,48baseguide (16×3),
  6mobileTop.10R4metadata/20PNG NoPermission/stress/timezone наследуются в
  исходном `browser-r8/` с original R4 labels/SHA, без копирования в новый снимок.
- `qa-r5/browser-ledger.json`, `inherited-browser-ledger.json`, `asset-ledger.json`,
  `guide-proof-ledger.json`, `guide-top-proof-ledger.json`, `overlay-ledger.json`.
- `references-r2.json`:64 текущих exact-frame/approved-pattern Figma PNG,
  SHA `285c5044167dbf9be86f2c5498d69dc024c0d86e730d927da21612239e0eadc1`.
- `assets-r3.json`:36assets (15localSVG+21instructionassets), SHA
  `0bdc74c4e918d8cd4fb95bcde41e79cef1d4733876198b414eb1e503a755ead6`.
  67runtime asset paths совпали с frozen source hashes, Inter загружен.

Figma areas403:3265/403:3266, файл jN8Hhzn6ObIAEi7FoY9kPu, согласованиеR1+R2
от01.11. Figma использовалась только для чтения. Старый formal fingerprint
основной области изменился после документированной синхронизации цвета ссылок
и дополнительного invariant drift; ложный freshness PASS старому hash не присвоен.
Получены текущие PNG exact approved nodes, старые exports/evidence сохранены.
Окна взяты из канонически связанных Onboarding patterns; подтверждение следует
existing UiSheetDialog640/fullmobile pattern с текстом про отключение источника.

First-frame инструкции всех3адаптивов и DesktopAll16 имеют Figma PNG.
Первоначальный вложенный экспорт tablet/mobile steps2–16 сохранял ancestor
clipping. Это ограничение устранено без правок canvas: native exportAsync с
useAbsoluteBounds:true/contentsOnly:true дал32полных approved step PNG.
`references-guide-full-bounds-r5.json`:16Tablet+16Mobile,32/32PNG валидны,
SHA `86dd7a27493101dc0a9c377f5a9ebe1290c412505a9ea47953120ee5f0e1129a`.
Original bytes не редактировались; provenance/exact node IDs сохранены рядом.
На том же frozenR5 выполняется дополнительное независимое визуальное сравнение;
initial UI desktopPASS/T-MUNVERIFIED исторически сохранён отдельно.

## Адресные команды и результаты

Node24.19.0, Playwright1.63.0, Chromium153.0.8010.12, ru-RU, DPR1, Inter,
clock2026-10-25T11:30Z, orgEurope/Moscow. Viewports1440×1000/834×1194/390×844,
stress320/600/768/1024/1280. Это Chromium contexts, не реальные устройства.

Точный новый R5 набор:

```sh
npm run test:unit -- tests/unit/features/telegram-instruction-dialog.test.ts tests/unit/features/integration-instruction-adaptives.test.ts tests/unit/widgets/integration-widgets.test.ts
npm run typecheck
E2E_BASE_URL=http://127.0.0.1:4173 INTEGRATIONS_ARTIFACT_DIR=artifacts/frontend-v2/integrations-redesign-2026-11-03/browser-r9 INTEGRATIONS_SNAPSHOT=integrations-r5 npx --no-install playwright test tests/e2e/integrations.spec.ts --project=chromium --grep 'состояния и browser evidence' --workers=1 --trace=off
```

Перед E2E выполнена та же команда с `--list`: ровно3адаптива. Exact argv/env,
output/html paths и exit codes — qa-r5/commands.json и *.command.json.

| Проверка                                                 | Exit / результат    |
| -------------------------------------------------------- | ------------------- |
| R5 unit,3 точных specs                                   | 0;30/30 PASS        |
| R5 typecheck                                             | 0                   |
| R5 ESLint --max-warnings0 / Prettier --check exact4files | 0 /0                |
| R5 git diff --check                                      | 0                   |
| R5 exactE2E --list → тот же run                          | 0 /0;3/3 PASS,23.9s |
| Исторический R3 exact8unit specs                         | 0;89/89 PASS        |
| Исторический R4 filtered3spec E2E                        | 0;15/15 PASS,31.8s  |
| R4 отдельный FUNCTIONAL focus proof cancel/204/503       | 0;3/3 PASS          |

**Наследование явно отделено от новых запусков:**59 unit/23static изR3,
12E2E изR4 (7dedicated+4shell+1workspace). Модельные/guard/test bodies не менялись;
обратная реконструкция трёх runtime файлов дала точныеR4SHA. Новый bounded diff
касается только overlay источника и Refreshing typography;30unit/3matrix повторены.
Общий объём доказательств —89unit/15E2E, но новым запускомR5 являются30/3.
Полный R4 набор выбирался точными paths integrations.spec.ts/workspace.spec.ts/
module-shell.spec.ts, projectchromium, grep '[Ии]нтеграции', --workers1/--traceoff.

FUNCTIONAL отдельно послеTEST: подтверждены singleoverlay source/form/zoom,
Escape/close/Tab trap/return focus/draft на3адаптивах, тот же request gate и
aria Refreshing; pixel accuracy переданаUI. Disconnect activeElement после
cancel — «Отключить» без DELETE, после204/503 — «Инструкция» с1DELETE проверен
наR4 в1440×1000 и наследован по точному unchanged confirmation diff. Новый
mobile/crossbrowser disconnect focus этим отдельным прогоном не заявляется.

Полные npm check/coverage/unit/E2E/stand/browser suites, audit/release builds
не запускались. CI/assertions/skips/thresholds/budgets/baselines не ослаблялись.
Backend/API/generated/lockfile/production не менялись. Commit/push/stage delivery отдельно разрешены новым поручением владельца;
их факты фиксируются в отдельном delivery report. Production не разрешён. Исходный untracked prompt и прежняя evidence сохранены.

## История исправлений и следующий шаг

R1 TEST78unit/14E2E прошёл; F-INT-01 unknown timezone выявлен дополнительно.
R2 закрыл его4pageunit+E2E. UI R1/R2 findings исправлены вR3: Empty CTA,
loading skeleton, inlinefeedback/LOCAL, адаптивная инструкция. NextTick focus
restore закрывает доказанный Reka unmount/concealed порядок для формы и zoom.
Capture Checking ждёт конечные CSS transitions, mobile — появления16 async
иллюстраций перед strict image readiness; assertions сохранены.

R3 scoped ESLint выявил отсутствие default нового returnFocus prop; R4 исправил
его одной строкой, TEST/FUNCTIONAL PASS. UI R4 нашёл2оставшихся дефекта:
прямой source guide безoverlay и caption Refreshing. R5 включает overlay только
при прямом открытии; nested form/zoom сохраняютодинparentoverlay, shared
primitives не меняются. Caption теперь12/18, spinner16blue. LongNames icon
finding снят после сверки sourceitems-center; его код не менялся.

История R1–R4, manifests, worker/QA logs, неудачные developmentruns идиагностика
сохранены. R4 actualview report с attribution: ui-r4-report-root.md.
Полный supplementary UI R5 закрыл нехватку offscroll evidence:32approvedrefs
просмотрены,desktop/mobilePASS,tabletFAILтолькоradius02–08. RootвнёсR6fix
native12px=>16.292при706px толькона2–8;соседиsquare. Поlatestuserноваяmanual
functional/visual/E2Eприёмкане запускалась. Провереныtypecheck/scopedlint2files.
Следующий шаг — штатныйstageCI/deploy/technicalrevisionproof;егоотчётв
artifacts/frontend-v2/integrations-stage-delivery-2026-11-03/.
Общая приёмка приложения остаётся отдельным этапом после завершения frontend;
локальный PASS не является релизным PASS.
