# Статус frontend v2

## Stage RC3 · 31.10.2026 · строгий flaky gate

RC2 `6820a65`/`release/2026-11-01-rc2` отправлен вstage. GitHub41213723148:
quality1162/Python10/build×3/audit/container PASS; E2E712PASS/1flaky/32skip,
деплой начал выполняться по зелёному job status. Native keyboard fix прошёл на
Linux; flaky относится к другому раздельному измерению той же строки команды:
avatar/badge axis diff55px, порог≤2. Это не чистый браузерный PASS.

RC3 правит только tests/CI/prose: вся геометрия строки/правого края/телефона
измеряется атомарно, после fonts.ready и со стабильностью двух кадров;
прежние пороги≤2/<1/≤1/x≥0/right≤375, count2 и Axe сохранены. Новое CI option
`--fail-on-flaky-tests` блокирует deployment даже при успешном retry.
Новый immutable tag будет `release/2026-11-01-rc3`; runtime/API/UI/budgets прежние.
Evidence/приёмка `artifacts/frontend-v2/stage-freeze-2026-10-31/CI-FIX2/`.
Actual stage deploy/health сверяется отдельно; production не менялся.

CI-FIX2 независимо принят: **TEST PASS / FUNCTIONAL PASS**; freshcheck1162,
Python10/YAML13, strict30/30за41sec,0retries/failed/flaky. NegativeCLIprobe:
firstFAIL/retryPASS→1flaky→exit1, hardblock подтверждён. Shard745exact.
731/731inputs unchanged sourcee9470d5f…; runtime/UI436 прежние. После фиксации
rc3 обязательны новый полный Linux CI и stage verification.

Первый actualautodeploy rc2 ужеуспешен: backend0d06d96b62b0, frontend6820a65,
image0d06d96b62b0-w6820a659;11/11stage checksPASS (exactSHA/image/clean/health/
APIhash/migrationchecksum/helper/services). Новыхмиграцийнет; smokeexit0.
Это подтверждает механизм автодеплоя отдельно от чистого browserPASS rc3.

## Stage RC · 31.10.2026 · локальные CI fixes приняты

Кандидат `3317d58` и immutable tag `release/2026-11-01-rc1` отправлены обычным
atomic push в stage/рабочую ветку. Repo flag включён после локального scoped PASS.
Первый GitHub run41203856188: quality1162/Python10, build×3/audit/container PASS;
E2E710PASS/2FAIL/1flaky/32skip, deployment SKIPPED. После первого CI stage оставался
на2f3dea1, backend0d06d96b62b0; production не менялся.

Следующий кандидат `release/2026-11-01-rc2`: только test/CI/prose fix.
CI-RC1-01 — сравнение Tab/Shift+Tab native unselected radio по отдельным labels
зависело от OS; проверка теперь сверяет независимую native fixture, один stop
группы и точный обратный порядок остальных элементов/групп.
CI-RC1-02 — WebKit layout race при двух раздельных измерениях кнопок команды;
одновременное измерение и web-first ожидание сохраняют прежний порог<1px.
Matrix разделена на2shards:745 случаев=373+372, overlap0, coverage union exact.
Runtime/API/budgets/UI S6 неизменны; независимый результат исправлений и новый
GitHub run фиксируются в `artifacts/frontend-v2/stage-freeze-2026-10-31/CI-FIX/`.

Независимый CI-FIX qa-r2: **TEST PASS / FUNCTIONAL PASS**,30/30за43.7sec,
30attempts,0retries/failed/flaky;731/731inputs unchanged sourceee5f69c4….
Check1162/Python10/YAML13/shardproof reused только по invariance; UI/runtime436
не менялись. Первый локальный repeat был BLOCKED из-за подтверждённого pmset сна
Mac (24pass/6flaky); его evidence сохранён. Чистый rerun выполнен с caffeinate.
Операционный следующий шаг после этого commit: atomic push stage/rc2, обязательный
полный GitHub CI обоих shards, затем автоматический deploy и live health/revision
verification. Результат deployment сверяется отдельно по GitHub SHA/RC tag;
frontend/mock PASS не подтверждает live user journey/email/Telegram/AI.

## Релизный freeze и stage autodeploy · 31.10.2026 · RC принят

По прямому поручению владельца S6 подтверждён: TEST/FUNCTIONAL frontend/mock
и desktop UI PASS; все 628 hashes совпали. Исходники, тесты и компактные
evidence сохранены commit `ee33540`. История `origin/stage` включена обычным
merge, без reset/stash/force push; принятые runtime/API/budgets сохранены.
Старый sandbox prototype заменён текущим v2; значимые adapter/axe/recovery
проверки перенесены, история остаётся в stage-parent. Независимый RC2:
**TEST PASS / FUNCTIONAL PASS**, RC1-COV-01 закрыт. Fresh check1162 unit и
sandbox30/30 (3browser,0retries/flaky); остальные683 E2E и32 штатныхskip,
build×3/audit/Python10 переиспользованы из полного RC1 только по hash invariance.
Runtime/API/build inputs436/436 совпадают с S6; новая UI-приёмка не заявляется.
RC3 меняет только этот итог, операционный порядок в docs и компактный handoff;
исходники/тесты/workflow/helper остаются побайтно RC2. Annotated tag:
`release/2026-11-01-rc1`. После фиксации — только точечные bugfixes.

GitHub staging environment и restricted Actions key подготовлены. Следующий
операционный шаг после этого commit: включить repo flag, push stage и дождаться
GitHub CI/deploy. Workflow требует quality/builds/e2e/container до деплоя точного
stage SHA; backend pinned0d06d96b62b0. Факт live deployment/health фиксируется
отдельно; на момент локальной приёмки UNVERIFIED. Production не меняется.
[Компактный handoff](evidence/stage-release/Codex-R1/handoff.md).
[Заморозка](CODE-FREEZE.md), [автодеплой](../staging-autodeploy.md),
артефакты `artifacts/frontend-v2/stage-freeze-2026-10-31/`.

## Codex · Настройки «Компания и график» · 31.10.2026 · S6 завершён

**US-M02-05/06: TEST PASS, FUNCTIONAL PASS frontend/mock, desktop UI PASS.**
По последнему поручению владельца tablet/mobile макеты не согласованы и неактуальны;
их redesign/UI-приёмка отложены, узкие размеры проверены только как регрессия.
Компания сверху1120×230, ниже точки320 и график776; сохранена оболочка C.
Сохранение компании/точки/недели, подтверждения, состояния, ошибки/повтор, валидация,
tenant/late-response guards, защита от двойной команды и потерянного графика работают.
Онбординг сохраняет свои правила; backend/API/Figma/lockfile/budgets не менялись.

Конечный **S6**:628inputs SHA `09cedd0b…9f674d`, HEAD `4e175e9`+dirty, все untracked
inputs учтены. Visual125 SHA `1b1639cf…b125253`, design69 SHA `70e1f08d…a607a`.
Check1159unit/98files, build×3/audit —0. Локальный stockCI=true профиль2workers/2retries:
707PASS/2прежнихskip,709attempts,0retries/failedAttempts/flaky, exit0.
JS905590/905600,CSS71811/72000,initial249375/304800, пороги прежние.
Capture17/51PNG; независимые short/story10/10, footer24/24, default/narrowconsumer14/14.
Все4desktopdialogs строго280/280,gap16. UiSheetDialog settingsForm defaultfalse,
новый ритм/grid толькодляdesktopsettings, остальныеconsumers/narrow прежние.

Независимый UI закрылV01–V05:22изменённыхPNG+5overlay просмотрены,29прежних
реально просмотренныхPNG переиспользованы только послеSHAравенства. Main+4dialogs
exact-frame,6старыхstateframes approvedpattern вновойсетке; точная новаягеометрия
этихсостоянийUNVERIFIED. Матрица33:11desktopPASS/22adaptiveDEFERRED.

ИсторическиеFAIL/traces сохранены: pollingtest изолирован отSSEresync безослабления
assertions; S5a WebKitlostsubmit не воспроизведён адресно5/5,serialPASS,текущийCIclean.
Его причина не установлена, не объявлена устранённой grid. Это остаточныйintermittentриск.
Параллельныйreleaseplan иSTATUS — mutableoutputs внеcomputationalsnapshot;
полныйformatcheck их не исключает. Чужие dirty/untracked/evidence сохранены.

Stage/revision/APIhash/миграции и реальные backend/delivery/nativeOS — UNVERIFIED.
Общий releasePASS не заявляется; следующий шаг — отдельный живойstageQA разрешённого
контура. Code inputs больше никто не пишет, browser/preview остановлен,4173свободен.
Commit/push/deploy/merge не выполнялись.
[Итоговый handoff, файлы, AC, команды и ограничения](evidence/settings-company/Codex-R1/handoff.md).
Artifacts: `artifacts/frontend-v2/settings-company/Codex-R1/S6/`.

## Codex · Песочница · 31.10.2026 · реализация готова, общий QA FAIL

Поручение владельца: песочница переписки в текущей концепции LidRadar,
localhost и stage; уточнение — production исключён. Добавлены `/sandbox`,
capability `sandbox: true` в session/menu, composer/templates/draft user+tenant,
реальные API команды с durable idempotency, сверка и переходы в Диалоги/Radar.
Локально — существующий `npm run dev:stage`; backend/API/Figma/lockfile неизменны.

S1 TEST FAIL/FUNCTIONAL BLOCKED: WebKit/mobile320 native-select overflow21px
и отсутствие detail3s; старый datepreset1440 intermittent не воспроизвёлся
в адресном повторе6/6. Все исторические S1 логи сохранены. S2 исправляет
локальный native select overflow, отдельный PROCESSING detail3s и гонку
старого чтения с подтверждённым новым сообщением (cancel + actor guard).
Root: target24/24 stock3browser, unit39/39; расширены recovery/actor/capability
и негативные проверки. Snapshot583 `c85a6d75…43e0a84`, HEAD `4e175e9` + dirty.
Inputs заморожены, ведущий владеет ими. S2 независимый check0/1143unit,
три build0 и audit0 (JS899800/905600, CSS69311/72000, initial249265/304800).
Два full E2E дали655PASS/32прежнихskip/1разный старый WebKitFAIL каждый:
integrations, затем notifications; sandbox24/24 оба разаPASS, integrations
адресно2/2PASS. Assertions/timeouts/retries прежние. Заключительный serial full workers1 тоже655PASS/32skip/1FAIL: старый mobile
notification-сценарий после клика не получил ссылку бота, POST не отправился.
WebKit desktop notifications/integrations в serialPASS. Причина кликов не
установлена; снижение параллелизма не решило весь сбой. Новых full не запускаем.
Каждый полный S2 run: sandbox24/24PASS; source583 и7 publicconfig сохранны.
Общий TESTFAIL, FUNCTIONALBLOCKED, независимый UI всех адаптивовUNVERIFIED;
основная сессия просмотрела8actual PNG только как spot-check. Живой stageUNVERIFIED.
Следующий шаг — отдельный разбор старых click failures, затем gates/FUNCTIONAL/UI.
[Handoff](evidence/sandbox/Codex-R1/handoff.md). Scope:
[evidence/sandbox/Codex-R1/scope.md](evidence/sandbox/Codex-R1/scope.md).
Artifacts: `artifacts/frontend-v2/sandbox/Codex-R1/S2/`.

## Codex · N-ML-01/02 и format/lint · 31.10.2026 · N320-S1 завершён

По новому поручению исправлены banner action row (wrap, max-width, mobile gap8)
и PeriodPicker (поля min160, перенос по доступному месту, прежние17/46).
ESLint исключает generated artifacts, исходники/тесты/tooling/scripts/config
остаются под правилами; добавлена проверка scope lint. Пять m02-step4 документов
отформатированы без изменения Markdown AST/смысла. Полные format:check/lint —0.

Root target: architecture/typecheck0, narrow-controls54/54 в трёх проектах
на9ширинах,81PNG+JSON. Первый run с ошибочным exacttext locator сохранён как
неуспешный, v2/v3 PASS; существующие assertions не ослаблялись.
Snapshot N320-S1:692 inputs SHA `0477899a…19dd80`, visual194 SHA `345c9818…b80e3c`.
Runtime/tests/config заморожены. Независимый TEST PASS: полный check0,
1121 unit, target54/full632+32 прежних skipped, три build/audit0.
FUNCTIONAL PASS:18/18 групп,5 consumers×3 browsers и pending/sent/rate/unavailable/
failure; strict0px overflow, keyboard/Enter-hide, lint-scope и MarkdownAST5/5.
JS879163/905600, CSS68886/72000, initial248910/304800; бюджеты прежние.
Source692/corevisual194/oldvisual598/protected580 неизменны. Независимый UI
просмотрел все81 новых PNG и15 QA-state PNG: **desktop/tablet/mobile PASS**,
N-ML-01/02 закрыты, новых findings нет. Supplemental35 также без изменений.
Backend/API/budgets/lockfile/Figma неизменны, stage не запускался.
[Scope](evidence/module-layout/Codex-R2/scope.md),
evidence `artifacts/frontend-v2/module-layout/Codex-R2/`.
[Итоговый handoff](evidence/module-layout/Codex-R2/handoff.md).
Прежние format/lint блокеры сняты; все автоматические final gates зелёные.
Перед выпуском остаётся отдельный живой stage QA; deploy/merge/push не выполнялись.

## Codex · Оболочка четырёх разделов · 31.10.2026 · ML-S2 завершён

По новому поручению владельца выбранная оболочка Radar расширена на диалоги
(список и деталь), аналитику, интеграции и все шесть вкладок настроек. Контекст
зависит от раздела, у настроек выделена шестерёнка и убран повтор контекста;
сохранены предупреждения недоступности realtime. Admin/access/onboarding и
plain-layout страницы остаются вне переноса. Backend/API/Figma/budgets неизменны.

Перед началом сверены 651/651 вход предыдущего US-M02-04 R4. ML-S1:
TEST/FUNCTIONAL frontend PASS, unit1121, E2E578/32 прежних skipped, target54,
три build/audit0, JS879144/905600. UI S1 UNVERIFIED: payments-state на кадрах
были ниже viewport; дефектов новой оболочки не найдено. Root доснял21/21
сценарий,69 PNG: targeted payments loading/error/empty, full-page и viewport
длинных списков, settings/integrations overlays/busy и older-message busy.

ML-S2 runtime/tests неизменны. Полный inventory исправлен:685 inputs теперь
включают также index/public/root configs и capture helpers (31 добавленный input,
дополнительные21 build/config файла git-clean и совпали с HEAD). Manifest SHA
`5baf3b24…afa8e8`, visual598 SHA `0823885c…12e70`; source archive без opaque env/auth
содержимого. TEST/FUNCTIONAL S2 PASS: свежие coverage1121, три build/audit0,
fullE2E578/32 прежних skipped; production106/106 побайтно равныS1. Supplemental
семантика PASS (21audit,6ожидаемыхmockwrites,0unexpected,112уникальныхUUID),
12 runtime probes переиспользованы по неизменным hashes. Независимый UI просмотрел
все 69 новых PNG и повторно использовал свой просмотр неизменных S1 кадров:
**desktop/tablet/mobile PASS**. Source685/visual598/protected580 неизменны.

Low N-ML-01: прежний email banner даёт0.578125px прозрачного padding за320,
текст/контролы видны, то же наRadar. Date320 обрезка года аналитики подтверждена
в восстановленнойR4 иML-S1: одинаковые width115/x37/168, body не менялся.
Оба прежних body-замечания вне переноса, доказательства сохранены.
Общий release gate остаётся FAIL по прежним5 format docs и lint artifacts;
source gates зелёные. Stage/nativeOS UNVERIFIED. Backend/API/budgets/lockfile/
Figma не менялись, commit/push/deploy/merge нет. Текущий перенос оболочки закрыт;
перед выпуском остаются внешние gates и живой stage. [Handoff](evidence/module-layout/Codex-R1/handoff.md).
[Scope и ML-01–14](evidence/module-layout/Codex-R1/scope.md),
артефакты `artifacts/frontend-v2/module-layout/Codex-R1/`.

## Codex · Radar и US-M02-04 завершены · 31.10.2026

Оба этапа выполнены последовательно по поручению владельца с сохранением
исходников и evidence Claude. **TEST / FUNCTIONAL целевого frontend/mock scope
PASS; UI desktop/tablet/mobile PASS** для обоих этапов. Backend/API/Figma,
бюджеты, lockfile и настройки агентов не менялись; commit/push/deploy/merge нет.

Radar S3b: manifest604 SHA `91fe0caa…5d4e1e`; coverage1120/1120, E2E497/32
прежних skipped, три build и audit:release exit0. Исправлено наложение сумм
на320/344; font20/28 только в узком контейнере,375/390 и выше прежние.
Добавлены проверки фокуса, viewport, bounds сумм и реального late-response A→B.
[Handoff Radar](evidence/radar-layout/Codex-R1/handoff.md),
артефакты `artifacts/frontend-v2/radar-layout/Codex-R1/`; исходный и финальный
снимки заархивированы. Два UI Low (titleellipsis320/footerwrap1023) сохранены.

US-M02-04 R4: manifest651 SHA `44990f23…f9fd044`; кнопка320 переносит подпись
внутри прежних46 px при17/20, G07/F03 сохраняют PNG в testInfo.outputPath с guard
до записи/проверкой реального PNG/attachments. Новые27 browser cases проверяют
9 ширин×3 проекта, enabled/invalid/saving/retry, bounds/спиннер/«Назад», стабильный
размер и PUT-only retry. Unit85/85, coverage1120/1120, targetE2E42/42,
fullE2E524 passed/32 прежних skipped, manager3/3, три build и audit:release —0.
JS878461/905600, initial248756/304800, CSS68893/72000; admin вне initial.
В двух output roots по24 новыхG07/F03PNG, все265 файлов первого сохранены;
у580 historical PNG неизменны SHA/mtime_ns/size до/между/после прогонов.

UI R4 просмотрел36 exact-frame пар и36 RU footer кадров, source651/visual416
неизменны. Radar после M2 CSS переснят:47/59 PNG побайтно равны S3b,12 изменённых
просмотрены, regressionPASS. N-R7-2/N-R7-6 остаются minor.
[Handoff US-M02-04](evidence/us-m02-04/Codex-R4/handoff.md),
артефакты `artifacts/frontend-v2/us-m02-04/Codex-R4/`.

Ограничения: общий release gate FAIL по формату5 внешних m02-step4 документов
и lint ignored artifacts. Source-scoped gates зелёные. Stage, nativeOSselect,
широкие manual nested-комбинации — UNVERIFIED; все24AC полностью не заявляются.
Следующий шаг перед выпуском — внешние gates и живые проверки разрешённого
stage-контура; текущие frontend-задачи закрыты без изменения backend.

## Radar · Перенос оболочки C · Claude-R1 · в приёмке · 30.10.2026

По [ТЗ](RADAR-LAYOUT-CLAUDE-TASK.md) реализована оболочка C только для маршрутов
`radar` и `risk` (`meta.shell = 'radar'`, новый `RadarShell`): desktop-колонка 240
с workspace внизу, шапка с контекстом/датой/именем/«Аккаунт →»/настройками/«Выйти»;
tablet/phone app bars 72/64, drawers 360/344 (`UiDialog size="drawer"`), компактная
phone-сводка и лента без переключателя вида; деталь риска во всех состояниях в той же
оболочке. Settings/Admin/прочие разделы — прежний AppShell. Снимок S1
`f5d308e9…3913` (манифест 564 файла, HEAD `4e175e9` + рабочее дерево).
Ведущий: typecheck/api/fsd/coverage/architecture/audit:release = 0; e2e матрица
493 passed + исправленный mobile-тест; бюджеты в норме (entry 67 736, CSS 68 374,
totalJs 878 237, initial 248 756). Внешнее: `format:check` — 5 чужих docs m02-step4,
`lint` — gitignored `artifacts/**` других прогонов. Evidence:
`artifacts/frontend-v2/radar-layout/Claude-R1/` (actual, reference 27 PNG + SHA-256,
compare, source-map, brief). S1: lidradar-qa TEST PASS, FUNCTIONAL PASS (17 AC; AC-10/11/12 mock, stage UNVERIFIED);
visual-review desktop/tablet/mobile PASS with notes (Medium T-1/M-1 — значения сводки не на одной
линии; Low D-1, T-2, M-3, T-3/M-2). После S1 исправлено (не заморожено, приёмка не повторена):
RadarSummary subgrid + подпись 18 px + строки 44/44/48 на desktop (карточка 138 = Figma),
двухстрочная шапка Radar с планшета, «Фильтры» bg-canvas, select workspace pr-8/truncate,
RiskWorkspace gap-4 на телефоне. Адресно: unit 16/16, typecheck 0, prettier 0; e2e не перезапущен.
G07/F03 контрольные копии: `Claude-R1/g07-control/`. Следующий шаг: кадры фокуса и viewport 320
в capture-спеке, полная пересъёмка, снимок S2, повтор QA (затронутые + final gates) и UI, handoff;
затем этап 2 US-M02-04 (текст поручения не получен — объём по краткой формулировке и Codex-R3).

## Radar · ТЗ переноса текущего layout в Claude Code · 30.10.2026

По поручению владельца подготовлено [ТЗ Claude](RADAR-LAYOUT-CLAUDE-TASK.md):
существующая оболочка C, desktop-header/logout, последние tablet/phone app bars,
drawers и компактная phone-лента, включая состояния детали риска. Live read-only
Figma подтвердил 23 канонических root IDs; source-map сохранён в
`artifacts/frontend-v2/radar-layout-task-2026-10-30/source-map.json`.
ТЗ содержит 17 критериев, точные ссылки, API/денежные ограничения, границы общего
AppShell и существующую схему Sonnet: ведущий → QA TEST/FUNCTIONAL → UI трёх
адаптивов. Доступ/Онбординг и чужие изменения сохраняются; backend/API/Figma
не менять, бюджеты не повышать. Это подготовка передачи, не запуск реализации.
Срез: `frontend/v2-implementation`, HEAD `4e175e914719f380dcadb05ccf28d34e9de08439`.
Runtime/tests/config не менялись, продуктовые проверки не запускались;
TEST/FUNCTIONAL/browser UI/stage этого переноса — NOT_RUN.
Следующий шаг — передать Claude стартовый промпт из раздела 10 ТЗ.

## Решение владельца · Фиксация макетов до релиза 01.11.2026

30.10.2026 зафиксированы макеты Доступа и Онбординга — до релиза их не править.
Radar также зафиксирован: крупные изменения запрещены, допустимы только
точечные исправления дефектов с сохранением структуры/навигации/дизайна.
[Правило и источники](DESIGN-FREEZE.md), baseline:
`evidence/design-freeze-2026-10-30/baseline.json`.
Ограничение учитывает общие Figma masters/styles/variables/tokens и имеет
приоритет над прежними планами доработки этих макетов. Guard добавлен в
AGENTS/CLAUDE, DESIGN, SOURCES, WORKFLOW и RELEASE-SCOPE; design-index содержит
машиночитаемый `releaseDesignFreeze`. До фактического выпуска разработку и QA
вести по текущим эталонам. Макеты/runtime/API/US и production не менялись;
новые TEST/FUNCTIONAL/UI/stage verdict не выдавались. Следующий шаг — реализация
и проверка согласованного объёма к релизу по существующим поручениям.

## Figma · Настройки / Администрирование · Оболочка C · Готово · 30.10.2026

По поручению владельца обновлены 285 full-shell frames: 132 настроек (44×3)
и 153 администрирования (51×3). Root IDs/размеры сохранены, сверены 285/285 хедеров.
Совпали 132 business subtree fingerprints настроек, 139 local-frame fingerprints
и 726 business hashes Admin. Независимый **CANVAS desktop/tablet/phone и menus
PASS** по двум разделам; реально просмотрены 10 новых PNG, findings0.
Settings: 6 вкладок/selector сохранены, appnav нейтрален, gear активен, workspace
снизу. Admin: 9 platform-разделов, роль/UTC, нижний return сохранены; 2 исходных
neutral menus и 18 selected overlays привязаны к соответствующим экранам.
Все 4 прежних drawer IDs сохранены. [Evidence](evidence/settings-admin-shell-rollout-2026-10-30.md),
артефакты `artifacts/frontend-v2/settings-admin-shell-rollout-2026-10-30/`.
Во время задачи тестовые/proposal sections Radar стали недоступны вне mutation
logs исполнителей: 4/4 оставшихся source fingerprints совпали; актуальные
canonical appbars `1048:9337` / `1048:9359` присутствуют. Их pointers обновлены
в design-index; исторические provenance IDs сохранены. До/после fingerprints
excluded Admin access/legacy fragments отдельно UNVERIFIED (только scope summary).
Runtime/API/US не менялись; TEST/FUNCTIONAL/browser UI/stage не запускались.
Figma-поручение закрыто, runtime и его интерактивность проверяются отдельно.

## Figma · Диалоги / Аналитика / Интеграции · Оболочка Radar C · 30.10.2026

По прямому поручению владельца оболочка C применена на 180 основных frames:
56 диалогов, 87 аналитики и 37 интеграций, включая desktop/tablet/phone и состояния.
Обновлены header/sidebar, workspace снизу и selected nav; добавлены 6 module
drawers с корректными menu/close reactions. Root IDs/размеры и локальные данные
сохранены. Совпали 143/143 content fingerprints диалогов/аналитики и 104/104
business fingerprints интеграций; интеграционная сверка 180/180 headers без findings.
Независимый **CANVAS desktop/tablet/phone и menus PASS** для трёх модулей:
реально просмотрены 16 новых PNG. Source Radar неизменен, 6/6 контрольных сумм
совпали после freeze. [Evidence](evidence/module-shell-rollout-2026-10-30.md),
артефакты `artifacts/frontend-v2/module-shell-rollout-2026-10-30/`.
Runtime/API/US не менялись; TEST/FUNCTIONAL/browser UI/stage не запускались.
Поручение по Figma закрыто; интерактивность/прокрутка/a11y остаются отдельной
проверкой при реализации. Legacy, локальные фрагменты без shell и отдельная
невыбранная проба аналитики сохранены.

## Figma · Radar · Оболочка C на основных макетах подтверждена · 30.10.2026

Владелец уточнил источник: страница `21:2`, обзор Adaptive C `1050:16001`.
Проверено, что выбранная оболочка уже применена на 9 desktop, 12 tablet/phone
экранах и двух navigation drawers после предыдущих переносов. Актуальны новый
хедер, workspace снизу, desktop «Выйти» после настроек, прозрачная tablet-ссылка
и отсутствие phone-переключателя вида. Повторные Figma-правки не потребовались.
Проверены 25 frames с двумя обзорными viewport; findings 0, независимый
**CANVAS desktop/tablet/phone PASS** по 6 PNG, 7/7 hashes совпали.
[Evidence](evidence/radar-layout-rollout-2026-10-30.md). Ранее предположенная
миграция на UI Kit/App Slots не относится к уточнённому поручению; её статус
этой проверкой не изменён. Runtime/API/US не менялись;
TEST/FUNCTIONAL/browser UI/stage не запускались.

## Figma · UI Kit · Простой лист компонентов · 30.10.2026

Каталог `1081:6620` перенесён на отдельную страницу `1093:8447` **UI Kit ·
Компоненты · На согласование**. Вместо 65 отдельных карточек — общая область
с названиями и состояниями. Сохранены прежние preview IDs и связи; показаны
104 связанных образца, новые мастера не создавались. Независимый **Canvas R4
PASS**, findings закрыты. [Evidence](evidence/ui-kit-components-simple-2026-10-30.md).
Layout и runtime не менялись; продуктовые тесты не запускались.
Статус — ожидает согласования владельцем, следующий шаг — пользовательский просмотр.

## Figma · UI Kit · Layout · На согласование · 30.10.2026

Создана отдельная страница `1072:14752` **UI Kit · На согласование** с разделами
00–05, правилами обновления, тремя семействами Guest/Onboarding/App и девятью
адаптивными Layout. App основан на выбранной оболочке Radar C. Каталог содержит
65 компонентных и 102 составных связанных образца; старые мастера не дублировались.
Проверены нативные Slots, наследование 9/9 и сохранность прежних 428 masters/sets
и девяти исходных макетов. Независимый **CANVAS DESIGN R3 — 9/9 PASS**,
осталось малое отличие текста desktop-степпера. [Evidence](evidence/ui-kit-layouts-draft-2026-10-30.md).
Статус владельца — **ожидает согласования**. Миграция рабочих экранов и внедрение
отложены до утверждения. Runtime/API/US не менялись; TEST/FUNCTIONAL/browser UI
продукта и stage не запускались. Следующий шаг — пользовательский просмотр.

## Figma · US-M10-01 · Комплексная привязка из онбординга · 30.10.2026

По поручению владельца следующей подготовлена US-M10-01 с личным блоком
четвёртого шага; настройки оставлены следующему пакету. На `User Stories
& Flows` создан путь `1065:11576`: 43 desktop-сцены в семи ветках A–G.
Карточка `691:4761` открывает путь. [Содержание и evidence](evidence/m10-01-onboarding-visual-path-2026-10-30.md).

Независимые **CONTENT PASS / CANVAS DESIGN PASS R3**; замечания закрыты,
14/14 hashes совпали. Снимок `3257f1a0…61b18cf5`, артефакты:
`artifacts/frontend-v2/m10-01-onboarding-scenarios-2026-10-30/`.
Макеты **на согласование**. Канонические US, API и runtime этой задачей
не менялись; продуктовые TEST/FUNCTIONAL/UI и stage не запускались.
Следующий этап — согласование, затем обновление историй по workflow.

## Figma · Radar · Уточнения компактной оболочки · 30.10.2026

По ссылкам владельца убран phone-переключатель «Список / Плитки» в двух исходных
лентах и обзорном viewport. Сортировка, фильтры и статусные вкладки сохранены.
«Аккаунт» на шести tablet-экранах и viewport приведён к desktop-виду:
текстовая ссылка без белой подложки/рамки. [Evidence](evidence/radar-adaptive-refinement-2026-10-30.md).
Просмотрены актуальные phone viewport и tablet header; runtime/US не менялись,
продуктовые тесты не запускались.

## Figma · US-M02-04/07 · Пользовательские пути на согласование · 30.10.2026

Подготовлены два следующих пути в стиле регистрации: US-M02-04 — 19 сцен
в ветках A/B/C, US-M02-07 — 5 сцен в ветках A/B. Редактируемые экраны,
краткие подписи и синие переходы находятся на `User Stories & Flows`:
`1050:9146` и `1050:20265`. Карточки `691:4080`/`691:4108` открывают пути.
[Карта, источники и evidence](evidence/m02-04-07-visual-paths-2026-10-30.md).

Независимая **CONTENT/CANVAS DESIGN PASS**: единственный P2 исправлен,
11/11 hashes R2 совпали. Снимок `82c6b65a…545cbd54`, артефакты:
`artifacts/frontend-v2/m02-04-07-scenarios-2026-10-30/`. Исходные эталоны
сохранены; новые пути ещё не согласованы владельцем. Канонические US,
runtime и API этой задачей не менялись; TEST/FUNCTIONAL/UI продукта
и stage не запускались. Текущая реализация 04 и её findings остаются
в области своих отдельных отчётов. Следующий этап — согласование макетов,
затем обновление историй по workflow.

## Figma · Radar · Desktop «Выйти» перенесено в хедер · 30.10.2026

По образцу владельца «Выйти» размещено после шестерёнки на 9 основных desktop
frames: серый текст без рамки, вертикальный разделитель слева. Пять существующих
кнопок перемещены с сохранением ID, четыре добавлены в хедеры ленты для единой
оболочки. Компактные адаптивы, тестовые варианты и контент рисков сохранены.
[Evidence](evidence/radar-desktop-logout-2026-10-30.md). Проверены порядок и
структура всех девяти frames, просмотрены два хедера и desktop-деталь.
Runtime/API и продуктовые тесты не менялись/не запускались.

## Figma · Radar · Переработаны tablet/phone меню и layout · 30.10.2026

По поручению владельца обновлены 14 компактных frames: 4 ленты, 8 состояний
детали, 2 меню. App bar 72 px на tablet / 64 px на phone объединил глобальные
действия; контекст и полная дата занимают одну строку. Меню получило строки
52 px / 17 px и отдельный нижний workspace. Phone-сводка и интервалы уплотнены,
все значения и бизнес-блоки сохранены. Desktop C и тестовые варианты не менялись.
[Карта и ограничения](evidence/radar-adaptive-rework-2026-10-30.md).

Добавлены редактируемые viewport `1050:16004` (834×1194) и `1050:16073` (390×844).
Структурная проверка 14 frames — без переполнений; независимый **CANVAS DESIGN
tablet/phone PASS** для 6 viewport/menu PNG. Замечание о сокращении даты закрыто,
контраст аккаунта доведён до 4.70:1; затронутые снимки повторно просмотрены.
Артефакты: `artifacts/frontend-v2/radar-adaptive-rework-2026-10-30/`.
Это Figma-дизайн: runtime/API/US не менялись, TEST/FUNCTIONAL/UI продукта и stage
не запускались; 320 px, увеличенный текст и интерактивность остаются UNVERIFIED.
Следующий шаг — пользовательский просмотр переработанных адаптивов.

## US-M04-01/02 · Истории синхронизированы с макетами · 30.10.2026

По прямому поручению владельца в `Lidradar/docs/user-stories/13-channels.md`
убрана обязательность бизнес-аккаунта/Premium. Подготовка бота, Secretary Mode,
выбор чатов, форма подключения и её состояния приведены к текущей Figma.
Добавлены 20 AC — REQUIRED_NOT_VERIFIED; US-M04-03–06 сохранены побайтно.
[Состав, источники и проверки](../proposals/us-m04-01-02-story-update.md).
Проверки документа exit 0; TEST/FUNCTIONAL/UI продукта не запускались.
Следующий шаг — 4, решение и границы реализации. Runtime/API/Figma не менялись.

## Figma · Radar · Оболочка C перенесена в основные макеты · 30.10.2026

По прямому поручению владельца выбранная оболочка C перенесена на 23 основных
frames: 9 desktop, 4 компактные ленты, 8 состояний детали, 2 drawer-меню.
Белая панель навигации, аккаунт/шестерёнка в хедере и workspace снизу применены
с сохранением канонических ID и контента. Telegram-карточка и подпись роли убраны;
существующие «К рискам», меню/закрытие и «Выйти» сохранены.
[Карта, результаты и ограничения](evidence/radar-shell-c-2026-10-30.md).

Структурная проверка всех 23 frames — 0 findings; независимый **CANVAS DESIGN
desktop/tablet/phone PASS** по 9 неизменным Figma PNG. Артефакты:
`artifacts/frontend-v2/radar-shell-promotion-2026-10-30/`. Тестовые варианты и
отдельное акцентное предложение сохранены. `design-index.json → radar.shellSelection`
фиксирует выбор, обновлены высоты документов адаптивной детали.
Это поставка Figma-дизайна: runtime/API и канонические US не менялись,
TEST/FUNCTIONAL/UI продукта и stage не запускались; G01 не повторялся.
Следующий шаг — реализация выбранной оболочки по отдельному поручению.

## Codex · Проверка закрытия US-M02-04 R7c · 30.10.2026

Независимо подтверждено закрытие F-01–03; целевой F-04 в UiSheetDialog
подтверждён code/unit и сверенным R7c browser/mutation evidence. Новый
адресный unit run **70/70 PASS**, exit 0. R7c **553/553** и отдельный снимок
**548/548** hashes совпали; runtime/tests не менялись.
[Отчёт и рекомендации по оставшимся решениям](evidence/us-m02-04/Codex-R2/review.md).

Новый read-only замер имеющегося dist: total JS **928 530 > 905 600 B**,
critical load **287 349 ≤ 304 800 B**; это не новая production-сборка.
Релиз не принят: B-01 и внешние format/lint gates остаются открытыми.
Новые browser/UI/stage проверки не запускались; полная AC-23 и nested overlays
имеют указанные в отчёте ограничения. Код/бюджеты/дизайн не правились.
UiDialog, bounded budget-analysis и copy остаются рекомендуемым следующим
объёмом, не новым автоматически согласованным поручением.

## US-M02-04 · Независимая проверка Claude R8 · Codex R3b · 30.10.2026

Проверены все шесть рекомендаций: адресные **TEST PASS / FUNCTIONAL PASS**.
Свежие 83/83 unit и 45/45 browser tests (Chromium/WebKit/mobile), manager-denial
probe 3/3. Полные 1108/1108 coverage и 476 passed / 32 прежних skipped из R8
переиспользованы по совпавшим inputs, не выдаются за новый полный запуск.
Свежая production-сборка: JS **870 190 ≤ 905 600 B**, initial **248 725 ≤ 304 800 B**;
лимиты, backend/API и код не менялись.

**UI: desktop PASS с minor / tablet PASS с minor / mobile FAIL.** На 320 px
надпись «Сохранить и продолжить» выходит за поверхность кнопки — UI-R3-01,
AC-22. Новые 55 captures и 15 narrow PNG проверены независимой UI ролью.
Нужны локальное исправление footer и регрессия границ текста; текущий запрос —
только review. Общий check exit 1 на форматировании шести внешних документов;
общего release PASS нет. Stage, native-select Arrow и широкий nested scope — UNVERIFIED.

HEAD `4e175e9`, R8d **556/556**, R3b **721/721** inputs и **138/138** новых UI
evidence неизменны. Параллельная design-freeze дельта документов учтена явно.
Новый AppShell sidebar/header отделён от эталонов onboarding.
[Отчёт, evidence, ограничения и побочный эффект G07 screenshot path](evidence/us-m02-04/Codex-R3/review.md).
Следующий шаг: исправить UI-R3-01 по отдельному поручению и повторить затронутые проверки.

## US-M02-04 · Шесть пунктов Codex-R2 · Claude R8 · 30.10.2026

- Итог: [handoff R8](evidence/us-m02-04/Claude-R8/handoff.md). Снимок R8d `06ccd129…0d93`
  (`artifacts/frontend-v2/us-m02-04/Claude-R8/manifest-R8d.sha256`).
- B-01 закрыт без изменения бюджетов: весь JS 928 529 → 870 190 B, критическая загрузка 287 348 → 248 725 B
  (`__VUE_OPTIONS_API__`, `tooling/vite/tree-shaking-fixes.ts`).
- UiDialog обходит Tab/Option+Tab по кругу (общий `keepTabInside`); подсказка phone-08 по макету
  (`BlockReason` + `blockReasonText`); тексты порогов US-M02-02; пункты 3–4 закреплены регрессиями.
- TEST PASS, FUNCTIONAL PASS (QA), UI ×3 PASS с замечаниями. `audit:release`, три build, `test:e2e` — 0;
  `check`/`lint` красные только внешне (чужие документы, `artifacts/**`). Stage — UNVERIFIED.
- Следующий шаг: решение владельца по коммиту R8 и оставшимся UI minor (N-R7-2, N-R7-6).

## US-M02-04 · F-04 и UI minor · Claude R7 · 30.10.2026

F-04 исправлен в общем `UiSheetDialog`: окно само обходит Tab и Option+Tab по кругу. UI-замечания
R5/R6 исправлены (ряд шагов, поля графика, окна точки, баннеры, phone-08), а также N-3 и
N-R7-1/3/4/5 по итогам приёмки. Снимок R7c — `3026ba59…218d`.

- **TEST PASS**: coverage 1095/1095; `test:e2e` 470 passed / 32 skipped / 0 failed; три build — exit 0.
- **FUNCTIONAL PASS** 24/24 AC.
- **UI**: desktop, tablet и mobile — PASS с замечаниями (minor N-R7-2/6/7).
- `audit:release` — **FAIL** только по бюджету всего JS (B-01, 928 529 > 905 600 B). Критическая
  загрузка снова в норме: отдельный модуль F-04 затягивал чанк `ui`, логика перенесена в компонент.
- `npm run check` красный только из-за 5 внешних `m02-step4-*.md`.
- Stage — UNVERIFIED.

[Handoff R7](evidence/us-m02-04/Claude-R7/handoff.md). Решения владельца: B-01, `UiDialog` (тот же
дефект фокуса), три сознательных отступления (серая кнопка до ввода, имя в шапке телефона,
подсказка phone-08), M-1. Правки не закоммичены.

## US-M02-04 · Исправление findings Codex-R1 · Claude R6 · 30.10.2026

F-01 (tenant команды POST/PATCH), F-02 (финальная сверка с желаемой неделей) и F-03 (состав
недели 1..7) исправлены, регрессии красные до и зелёные после. **TEST PASS** (Chromium, unit
64/64, coverage 1094/1094, typecheck/build exit 0); **FUNCTIONAL** — AC 01–22, 24 PASS, AC-23
Chromium PASS, WebKit/mobile **FAIL** из-за нового общего finding **F-04** (focus trap
`UiSheetDialog` в WebKit, есть и в настройках). **UI desktop/tablet/mobile — PASS с замечаниями**
(minor, не регресс). Релизные gates: три build PASS, `audit:release` **FAIL** (бюджет JS
926 601 > 905 600 B, HEAD 904 317 B), `test:e2e` FAIL только по F-04. `npm run check` красный
только из-за внешних файлов другого пакета (`m02-step4-*.md`, `design-index.json`) и git-ignored скриптов. Stage — UNVERIFIED.
Snapshot R6b `5e13d055…04261c9d`. [Handoff R6](evidence/us-m02-04/Claude-R6/handoff.md).
Следующий шаг — решения владельца по F-04 и бюджету JS. Правки не закоммичены.

## US-M02-01/02/03 · Макеты согласованы, истории обновлены · 30.10.2026

Владелец явно согласовал три визуальных пути: компания, первая точка/график,
услуги/источник — 25 desktop-сцен, 6 веток. В каноническом
`Lidradar/docs/user-stories/11-onboarding.md` обновлены US-M02-01/02/03:
39 критериев, предусловия, UI-тексты, ветки и связанные проверки.
[Согласование и состав правки](../proposals/us-m02-01-03-story-update.md),
[карта макетов и evidence](evidence/m02-visual-paths-2026-10-30.md).

Принят snapshot `483ca26f…ee00bba5` из
`artifacts/frontend-v2/m02-scenarios-2026-10-30/`; его CONTENT/CANVAS DESIGN — PASS.
US-M02-04–07 сохранены побайтно, включая принятое уточнение default 10:00–19:00
и POST → PUT. Статус реализации US-M02-04 определяется её отдельными отчётами;
согласование этих макетов не меняет их результатов. Новая редакция критериев —
**REQUIRED_NOT_VERIFIED**. Runtime, API и Figma
этой задачей не менялись, продуктовые тесты/stage не запускались.
Следующий этап — **4. Решение и границы реализации**. Артефакты документации:
`artifacts/frontend-v2/m02-story-update-2026-10-30/`.

## Codex · Независимая проверка US-M02-04 после Claude R5 · 30.10.2026

**FUNCTIONAL FAIL:** воспроизведены два существенных дефекта — POST/PATCH могут
уйти в новую организацию при смене контекста до dispatch; финальный GET с другой
неделей принимается за успех и заменяет желаемый draft. Ещё один краевой дефект:
валидатор допускает weekday 2..8. Это новые findings сверх minor из R5.
[Отчёт и воспроизведение](evidence/us-m02-04/Codex-R1/review.md).

Новые адресные unit **56/56 PASS**, typecheck exit 0; общий `npm run check`
exit 1 на форматировании трёх `m02-step4-*.md` другого пакета. По 24 AC:
20 PASS в проверенном mock/code scope, 3 FAIL (12/15/24), 1 UNVERIFIED (23,
полный keyboard/focus проход). Snapshot HEAD `3870d65` + dirty tree,
879/879 frozen inputs совпали до/после; runtime и тесты не менялись.
Новая UI-приёмка отложена до FUNCTIONAL PASS, stage/release UNVERIFIED.
Следующий шаг — исправление findings Claude и новые регрессии/снимок;
в рамках этой проверки исправления и пересылка в другую сессию не запускались.
Прежние результаты и приёмка minor R5 ниже сохранены как история своего объёма.

## US-M02-04 · Исправление шага 2 «Точки и графики» · R5 · 30.10.2026

**mock/frontend: TEST PASS, FUNCTIONAL PASS (24/24 AC); UI desktop/tablet/mobile — PASS с
замечаниями (minor).** Живой stage — BLOCKED/UNVERIFIED; релизные gates не запускались.
Существующий `/onboarding/location` переделан по [ТЗ](US-M02-04-CLAUDE-TASK.md): единый экран
точек и графика, модалки настроек, черновики по ID, POST → PUT default 10:00–19:00, повтор только
PUT, очередь сохранения всех недель со сверкой. Backend/OpenAPI/Figma не менялись.
[Handoff, команды, findings](evidence/us-m02-04/R5/handoff.md) (предыдущий раунд — [R4](evidence/us-m02-04/R4/handoff.md)). `npm run check` красный только
из-за чужих файлов (`evidence/m02-step4-*.md`, скрипты в `artifacts/`). Правки не закоммичены.
**Принято владельцем 30.10.2026** с 11 minor-замечаниями (перечень — в handoff R5).

## US-M01-03–08 · Макеты согласованы, истории обновлены · 30.10.2026

Владелец явно согласовал шесть визуальных путей на странице
`User Stories & Flows`: 47 desktop-сцен и 11 веток по эталону регистрации.
Канонические US-M01-03–08 в `Lidradar/docs/user-stories/10-access.md`
обновлены: 63 критерия, предусловия, ветки, UI-тексты и связанные регрессии.
US-M01-01/02 сохранены; все критерии новой редакции — **REQUIRED_NOT_VERIFIED**.
[Согласование и состав правки](../proposals/us-m01-03-08-story-update.md),
[карта макетов и evidence](evidence/m01-visual-paths-2026-10-30.md).

Согласован freeze `d3155fdc…57025e7` из
`artifacts/frontend-v2/m01-scenarios-2026-10-30/`; STRUCTURE/CONTENT/CANVAS DESIGN
для этого дизайн-артефакта — PASS. Имена «На согласование» в старом экспорте
сохранены как история до решения владельца. Нового adaptive/runtime PASS нет;
backend/frontend runtime, API и Figma не менялись, тесты продукта и stage
не запускались. Следующий этап — **4. Решение и границы реализации**.
Артефакты документации — `artifacts/frontend-v2/m01-story-update-2026-10-30/`.
G01 не повторялся.

## Codex R2 · US-M01-01/02 — проверено 29.10.2026

**Frontend/API: TEST PASS, FUNCTIONAL PASS; UI desktop/tablet/mobile PASS.**
Текущие изменения Claude сохранены, регистрация продолжена без переписывания.
[Итоговый отчёт](evidence/US-M01-01/codex-r2.md) описывает исправления R1,
пять дополнительных функциональных и четыре визуальных finding, все закрыты.

Финальный snapshot `5ebcb18f079df495fc9711601d1f06217b33cc3c42f820ce8642be1552f40085`,
541 input (HEAD `c9e676d` + tracked/untracked). Независимый Sol QA: `check`
1068 тестов; три builds и release audit exit0; полная browser matrix
446 PASS / 32 штатных SKIP / 0 FAIL. JS904317 ≤905600, CSS62848 ≤72000;
пороги/CI/browser coverage не ослаблялись. Capture90, compare1537 checks/0errors.
Terra приняла все три адаптива: exact frames и approved patterns указаны явно.
Артефакты и QA7/UI3: `artifacts/frontend-v2/us-m01-01/R2-codex-r3/`.
R1, промежуточные FAIL и прежние изображения сохранены отдельно.

Живой локальный frontend `http://127.0.0.1:5174` → актуальный backend-stage:
A/B зарегистрированы, нейтральный отказ на занятом адресе и повтор с тем же
приглашением проверены, logout и отказ использованного кода — PASS.
Два synthetic аккаунта example.test, израсходован первый предоставленный код;
коды/password/cookie в артефактах отсутствуют. Provenance среза живого прогона
и последующих адресных регрессий раскрыт в отчёте. **Доставка писем UNVERIFIED**:
реального тестового mailbox не было. Общий stage mode=open не менялся;
invite_only/employee path проверены детерминированно, backend race/mail-инициация
имеют отдельное сохранённое evidence выбранного backend revision.

G01 уже принят, повторять его не нужно. Текущее поручение регистрации выполнено
в пределах frontend/API; следующая независимая интеграционная проверка — доставка
в реальный разрешённый mailbox. Остальные frontend-сценарии — по отдельной очереди.

## Структура Codex для продолжения Claude — 29.10.2026

По поручению владельца добавлены [AGENTS.md](../../AGENTS.md), проектные
`.codex/config.toml` и пять ролей, [правила](CODEX-OPERATING-RULES.md),
[launcher/инструкция](CODEX.md), [стартовый запрос](CODEX-START.md) и
[шаблон brief](CODEX-TASK-BRIEF.md). Codex может продолжать реализацию;
старые записи ниже «Codex только принимает» — исторические.

Обычный цикл: Sol разрабатывает → Sol QA выполняет TEST/FUNCTIONAL → Terra
проверяет три адаптива. Независимые задачи: Sol worker / Luna explorer;
Astra — только явная консультация. Общая регистрация остаётся у одного автора.

База подготовки: HEAD `c9e676d` после `3844681`, ветка
`frontend/v2-implementation` и существующая незакоммиченная реализация.
Все 32 inputs checkpoint `44b0b3e6…8e037` совпали с рабочими файлами.
Runtime этим пакетом не изменён; R1 остаётся историческим FAIL, новые frontend
тесты/приёмка не заявляются. G01 принят 28.10.2026, повторять его не нужно.
Следующий шаг при продолжении — сверить актуальные hashes/findings R1 и адресно
воспроизвести оставшиеся дефекты по CODEX-START, сохраняя код и R1 evidence.
[Проверка конфигурации](evidence/codex-setup-2026-10-29.md): Bash/doctor,
TOML/model/effort, smoke режимов launcher, Prettier и diff-check — PASS.
Фактическая загрузка ролей в LLM-сессии и приёмка frontend — UNVERIFIED.

## Продолжение доступа —29.10.2026

Текущая реализация регистрации уже есть в незакоммиченных 32 файлах.
[Handoff/checkpoint](ACCESS-RESUME.md) сохраняет сделанное и исторический
R1 FAIL; не начинать экраны заново. ТЗ US-M01-02 и шесть конфигураций
согласованы, их запуск пользователь пока отложил.
[Правила моделей/среды](CLAUDE-OPERATING-RULES.md): Sonnet — код и штатные
проверки, Opus только консультирует; живое QA локального frontend через
dev:stage к актуальному backend-stage. Владелец выбрал три участника: разработчик + QA + UI.
Далее сохранены результаты прошлых этапов; они не заменяют актуальный snapshot.

## Текущий приоритет — стабильный backend, 27.10.2026

Реализация frontend и исправления — ответственность Claude. Codex выполняет
только приёмку: сверку, воспроизведение, проверки и замечания; runtime не исправляет.

Пользователь отложил расширения API 1–5 до большого обновления после релиза.
Релиз frontend выполняется по [RELEASE-SCOPE.md](RELEASE-SCOPE.md) поверх
существующего контракта. Новый ADR и backend-реализация этого пакета сейчас не нужны.
При расхождении старых записей ниже с RELEASE-SCOPE действует RELEASE-SCOPE.

Следующий этап Claude: закончить F01/F02 и предъявить G01, затем F03–F08
после пользовательской приёмки. Наша задача с пользователем — проверить предъявленный
результат и сформулировать замечания. Эта запись фиксирует область работ; код frontend
ею не изменён, выполнение критериев и приёмка G01 не заявляются.

## G01 принят пользователем — 28.10.2026; F03 начат

Решение владельца: «Принимаю G01, начинай F03». Принят срез `5a8bb84d3c2c6b19` (F01/F02: вход, Radar, деталь риска). Остаточные
ограничения G01 сохраняются (VoiceOver отложен, пиксельный эталон нижних секций детали на телефоне недоступен, реальный backend/Telegram/email не запускались).
Ход F03 — раздел «F03» ниже.

## F03 — Доступ и Онбординг (начат 28.10.2026)

Карта Access-кадров (72 одобренных id, 6 потоков × 3 устройства × 4 состояния): [evidence/F03/access-map.md](evidence/F03/access-map.md).
Эталоны сохраняются в `artifacts/frontend-v2/F03/reference/` (Figma `get_screenshot` с `maxDimension` = размер кадра; без него кадры > 1024 px приходят уменьшенными).
Нижние секции вложенных узлов внутри прокручиваемых документов по-прежнему возвращают заглушку 1×1 — только метаданные.

Порядок небольших сценариев (каждый: эталон → код → unit/e2e → сравнение → ревью):

| №   | Сценарий                                                                        | Stories              | Статус              |
| --- | ------------------------------------------------------------------------------- | -------------------- | ------------------- |
| S1  | Регистрация (desktop/tablet/phone × исходное/ошибка/отправка/загрузка)          | US-M01-01, 02, 04    | **закрыт**          |
| S2  | Восстановление пароля, новый пароль, ссылка восстановления, подтверждение почты | US-M01-05, 06        | **закрыт (28.10)**  |
| S3  | Приглашение, несколько организаций, нет права создать организацию               | US-M01-08, US-M02-07 | **в работе, ревью** |
| S4  | Онбординг: компания, точка и график, услуги, источник                           | US-M02-01…04         | **закрыт (28.10)**  |
| S5  | Возврат к незаконченной настройке, изменение настроек компании, несколько точек | US-M02-04…06         | **закрыт (29.10)**  |

### S1 — Регистрация

- Эталон: 12 кадров (462:5559/6402/6521/6648, 464:6792/6911/7031/7159, 464:8859/9435/9555/9683).
- Исходное и «Ошибка» уже были близки к макету; изменено: текст ошибки поля 14/20 (`UiField`), ошибка заменяет подсказку **только** у полей Access
  (`errorReplacesDescription`: код, пароль), «Отправка» — поля отключены, кнопка «Создаём аккаунт…» с доступным именем «Создать аккаунт»,
  «Первичная загрузка» — каркас формы (`RegisterForm loading`, `App.vue` показывает его на `/register`, как на `/login`), многоточие у отключённых полей (`UiInput`),
  цвет подписи каркаса `#6e6e73` (исправлено и в каркасе входа: раньше `#565b64`).
- Доступность: после неудачной отправки (поля были заблокированы) фокус возвращается к первому полю с ошибкой, у входа — к паролю
  (`features/auth-session/lib/focus-problem.ts`).
- Тесты: unit `register-form.test.ts` (отправка, каркас, ошибка вместо подсказки, 11-символьный пароль, адрес без @, имя 200/201, фокус),
  `primitives.test.ts` (UiField); e2e `tests/e2e/access.spec.ts` (регистрация: макет и пустой код, негативные проверки, ответы сервера, блокировка и её
  сохранение после перезагрузки, успех → `/onboarding/company`, повтор на свободный адрес с тем же кодом, ссылка из письма и axe; вход: фокус на пароле).
- Сравнение (`artifacts/cmd-compare-f03b.log`): 12 кадров 1,9–4,1 % (desktop 1,9–2,2; tablet 1,9–2,3; phone 3,1–4,1); подпись каркаса совпала пикселем.
- Команды (срез `754b5c048c3f397f`, 41 файл с новыми; хеш считается с intent-to-add, раньше новые файлы в хеш не попадали): `check` 0 (596 unit, statements 94,6 %),
  `build:dev/pre-prod/prod` 0, `audit:release` 0 (CSS 49778/52000), `format:check`/`typecheck`/`eslint` 0, Playwright chromium+webkit+mobile `--retries=0` 218 passed, 32 skipped, exit 0,
  `visual:capture`/`compare` 0. Логи `artifacts/cmd-*-f03c.log`, `artifacts/e2e-f03c.log`.
- Ревью: visual — FAIL по трём «Отправка» (нет многоточия) и сомнение по цвету подписи каркаса → исправлено (многоточие совпало, цвет `110,110,115` как в эталоне); functional — найдены
  потеря фокуса после ошибки (исправлено), замена подсказки ошибкой у всех форм (ограничено формами Access), слабый тест успеха, пробелы в e2e (закрыты); повторная проверка: PASS,
  замечания о тестах фокуса закрыты юнитом `focus-problem.test.ts` и e2e клиентской ошибки (после повторного ревью, агентом не просматривались).
  Низкий риск принят: при общих отказах сервера (5xx/429) фокус идёт на первое поле, ошибка озвучивается как `role=alert`.
- Принятый риск: короткая вспышка каркаса регистрации у уже авторизованного пользователя до завершения boot (как у входа).
- Не проверено: реальный backend (одноразовость кода, «занятый адрес не расходует код»), письмо подтверждения (шаг 5 US-M01-01), шапка после регистрации
  (имя, «Аккаунт», «Выйти» — относится к оболочке/онбордингу, S3–S4).

### S2 — Восстановление пароля, новый пароль, ссылка, подтверждение почты (закрыт)

**Срез:** полный diff от базы G01 `git diff 44fd9ae -- src tests tooling` = `2cf614d961e90761` (54 файла; `artifacts/slice-s2g.txt`; HEAD `4c83fa4` — ранее закоммиченная работа — плюс рабочее дерево).

- Эталоны: 48 кадров (forgot 462:5677…, reset 462:5767…, invalid 462:5880…, verify 462:5966…; × desktop/tablet/phone × исходное/ошибка/отправка/загрузка), экспорт
  `get_screenshot` с `maxDimension`; в `access-map.md` дубль «Новый пароль · Исходное» — 462:5880 на деле «недействительная ссылка».
- Страницы по макетам Access: общий `AuthCardHeader` (надпись, заголовок, пояснение; h1 фокусируем), `ResetLinkInvalid`, каркасы первой загрузки (`App.vue`, `skeletonPages`), «Отправка»
  («Отправляем…», «Меняем пароль…», «Открываем форму…» с прежними доступными именами), фокус после неудачи, hero до низа окна на планшете/телефоне (`max-lg:flex-1`).
- Решения владельца 28.10 по исходам сброса при любой сессии (реализованы и проверены): **(1)** `/auth/me` вернул действующую сессию — сессия и кэш сохраняются, страница показывает «Пароль изменён /
  Пароль по ссылке успешно изменён. В этом браузере вы вошли как <почта текущего аккаунта>.» и кнопки «Продолжить работу» / «Выйти и войти в другой аккаунт» (существующий выход, затем вход), без редиректа
  гостевого маршрута и без автовыхода; если в соседней вкладке вошёл другой пользователь — кэш прежнего очищается; **(2)** 401 — локальная сессия и кэш очищаются, вход с «Пароль изменён»;
  **(3)** перечитать сессию не удалось — успех сброса сохраняется, защитная локальная очистка, вход с отдельным текстом (`reset=local`, отзыв сервером не утверждается), повторный сброс не уходит;
  **(4)** нет ответа на сам сброс — «Результат неизвестен…» без утверждений об успехе и об отсутствии изменений. После смены состояния фокус на заголовке результата.
  Тексты: «Ссылка недействительна» для общего `RESET_TOKEN_INVALID`; «Загружаем форму восстановления…» вместо обещания проверки срока; «Сеансы восстанавливаемого аккаунта будут завершены. Для входа используйте новый пароль.»
- Отличия от Figma из-за данных API: красная надпись у отклонённой ссылки — «Восстановление доступа» (Figma «Ссылка истекла»: один код `RESET_TOKEN_INVALID`); «Проверяем ссылку…» на первой загрузке без токена.
  Состояние «Пароль изменён» при сессии — **нового кадра Figma нет** (собрано из примитивов Access; визуальная сверка с Figma невозможна, UNVERIFIED).
- Отличия от текстов stories (эффект сохранён): US-M01-06 шаг 1 «Забыли пароль?» → «Восстановить пароль»; шаг 3 «Придумайте новый пароль» → «Новый пароль». Запрос письма — только гостю (ADR 0058);
  вошедшему на странице недействительной ссылки вместо «Запросить новую ссылку» — «Настройки → Аккаунт» и «Продолжить работу».
- Тесты: unit `password-forms`, `account-links` (исходы 1–4, смена пользователя, выход без подтверждения, фокус, 429/5xx), `account-routes`; e2e `access.spec.ts` (63 теста на 3 проектах; исходы 1–4, кнопки, фокус).
- Команды (срез `2cf614d961e90761`, Node 24.19.0): `check` 0 (620 unit, statements 94,6 %), `build:dev/pre-prod/prod` 0, `audit:release` 0 (**CSS 50051/52000 — запас < 2 КБ**), `format:check`/`typecheck`/`eslint` 0,
  Playwright chromium+webkit+mobile `--retries=0`: **254 passed, 32 skipped**, exit 0; `visual:capture`/`compare` 0 (`artifacts/cmd-compare-s2g.log`).
- Визуально (48 пар S2): до обновления текстов 1,45–5,2 %; после — desktop/tablet в тех же пределах, на телефоне сдвиги ±21 px из-за переносов согласованных текстов (reset 10,5–10,8 %, reset-loading 16,2 %,
  invalid-loading 13,4 %), прочая геометрия совпадает. Все 12 планшетных пар «ошибка/отправка/загрузка» и desktop/phone обновлённых текстов просмотрены глазами; «Пароль изменён» — desktop/tablet/phone (без эталона).
- Ревью: visual — PASS (после правок спиннера и hero); functional (3 круга) — D1/D2 (сессия при сбросе), фокус, кэш при смене пользователя в соседней вкладке — исправлены, добавлены тесты (мутационно проверены).
  **Последние правки (кэш при смене пользователя, фокус на заголовке результата) агентом отдельно не просматривались** — покрыты unit и e2e.
- Правка приёмки 28.10: длинный адрес (63+`@example.test`, 76 симв.) в результате «Пароль изменён» переносится (`break-words` в `AuthCardHeader`), подпись «Выйти и войти в другой аккаунт» переносится в кнопке на 320 px; e2e на 320/390/834/1440 (нет прокрутки, текст и подписи внутри карточки/кнопок, фокус на h1), мутационно проверено; скриншоты `artifacts/frontend-v2/F03/actual/reset-long-email-{320,390,834,1440}.png`. CSS 50178/52000.
- Не проверено: реальная доставка писем, серверные пределы (3 письма/час) и реальный отзыв сессий сервером (только mock); поведение нескольких вкладок проверено unit-моделью, не браузером.

### S3 — Выбор рабочего пространства, приглашение, нет права создать организацию

**Срез:** полный diff от базы G01 `git diff 44fd9ae -- src tests tooling` = `1ce0518dedc829c0` (67 файлов; включает закрытый S2).

- Эталоны: 24 кадра — «Рабочие пространства» (Figma 477:8415, 477:9158, 479:12483/12542/12594, 479:15457/15498/15557/15609, 479:18081/18140/18192) и «Принять приглашение»
  (477:8455, 477:9262, 479:12879/12928/12982, 479:15959/16005/16054/16108, 479:18484/18533/18587); `artifacts/frontend-v2/F03/reference/{workspaces,invitation}-*.png`.
- Реализовано: шапка без панели (`PlainLayout`: бренд, имя, «Аккаунт», «Выйти» — вариант `plain` у `UiButton`), `UiPageIntro` (заголовок 28/32/40 и пояснение по центру), карточки пространств
  («Текущее» с галочкой, роль), состояния «Открываем пространство…» (переход на Radar ещё грузится), «Не удалось загрузить пространства» + «Повторить» (страница не загрузилась —
  перезагрузка страницы: не загрузившийся модуль браузер повторно не запрашивает; пространство исчезло из членств — членства перечитываются), каркас первой загрузки (`App.vue`, как у Access:
  шапка только с брендом, т.к. сессия ещё неизвестна). Форма приглашения: подсказка «43 символа. Скопируйте и вставьте код целиком.», блок «Код действует 7 дней / Используется один раз»,
  «Проверяем…» с прежним доступным именем, `404` — подпись под полем «Код недействителен или срок его действия истёк. Попросите владельца прислать новый.» (без серверного текста), прочие сбои — плашка
  с идентификатором запроса, введённый код не стирается; просторные отступы `UiField` (`roomy`). Каркас формы приглашения повторяет раскладку.
- Отличия от Figma из-за данных API: «Создать организацию» остаётся в подвале списка только при `canCreateOrganization` (в Figma ссылки нет; функция из ADR 0057 не удаляется); в каркасе
  первой загрузки нет имени/«Аккаунт»/«Выйти» (сессия неизвестна); в кадре «Ошибка» приглашения в Figma введён 26-символьный текст, у нас — допустимый 43-символьный код (короче код не отправляется);
  состояние «Вы в команде» после приёма кода — кадра Figma нет (UNVERIFIED относительно эталона). Состояния «Открываем…» и «Повторить» в Figma — переход на Radar; у нас выбор организации
  локальный, ошибка наступает при незагруженной странице.
- US-M01-08: список из двух организаций с ролями, Radar первой, смена в боковом меню (данные второй заменяют данные первой, разделы по роли), последняя организация после перезагрузки — e2e
  `tests/e2e/workspaces.spec.ts` (chromium, webkit, mobile). US-M02-07: `/onboarding/company` без права — «Организацию создают по приглашению платформы» без формы; `/settings/company` у менеджера —
  «Раздел недоступен» + «Вернуться в Radar» (mock). Визуальный перенос блока «нет права» относится к кадрам «Компания» (S4).
- Тесты: unit `accept-invitation` (7: 404 под полем, отправка, сбой сервера, каркас), `workspace-list` (4), `account-data-pages` (шапка PlainLayout, каркас без запроса `/admin/me`); e2e `workspaces.spec.ts` (8 × 3).
- Первое ревью (срез `dda03a16cb297c3f`): visual — расхождения шапки (зазоры), ритма под заголовком, 1 px отступов, зазора иконки ошибки и «ошибка заменяет подсказку» на десктопе приглашения → исправлено;
  functional — F1 (код принят, а перечитать членства не удалось → прежде показывалась обычная ошибка; теперь предупреждение «Приглашение принято, список пространств не обновился» + «Обновить список» без повторной
  отправки кода), F4 (фокус: после неудачи — в поле кода, после успеха — на заголовок «Вы в команде», после ошибки открытия — на «Повторить»; живая область `role=status` смонтирована всегда), F5 (`NavigationFailure`
  при выборе считается неудачей), F2/F6 (тесты: честные названия, коды `INVITATION_USED/EXPIRED/REVOKED`, фокус; мутации «убрать фокус», «убрать переход» роняют тесты) → исправлено.
- **Решение владельца (28.10: «шаг 5 оставь как есть»; S3 принят): поведение не меняется, шаг 5 не PASS.** Суть (F3): US-M01-08 шаг 5** («Выйдите и войдите снова в том же окне — сразу открывается последняя выбранная организация, без экрана выбора») **противоречит** существующему
  поведению `session-store.logout()`: выход стирает запомненную организацию (тест `session-store.test.ts` «выход очищает состояние и запомненный выбор»). Поведение не менялось; шаг 5 не проверен и не считается
  PASS. Нужно решить: запоминать выбор после выхода (по пользователю) или поправить story.
- Команды (срез `1ce0518dedc829c0`, Node 24.19.0): `check` 0 (634 unit, statements 94,6 %), `typecheck`/`lint`/`format:check` 0, `build:dev/pre-prod/prod` 0, `audit:release` 0
  (**CSS 51590/52000 — запас 410 Б; JS 843125/845600**), Playwright chromium+webkit+mobile `--retries=0`: **290 passed, 32 skipped**, exit 0 (`artifacts/e2e-s3e.log`; в одном промежуточном прогоне
  `аналитика: окно дат` на mobile упал, в одиночном запуске и в повторном полном прогоне зелёный — не связан с S3); `visual:capture`/`compare` 0 (`artifacts/cmd-*-s3e.log`).
- Второе ревью (срез `6f1d6b5059c77bea`): visual — пункты 1–5 закрыты, регрессий Access нет; замечания P2 (ссылка под карточкой приглашения на планшете на 9 px выше) и P3 (зазор «Аккаунт»/«Выйти» на телефоне) исправлены; остаются P3: галочка «Текущее» — иконка Material толще эталонной, рамка поля светлее. Functional — F1/F4/F5/F6 подтверждены; N1 (ложное предупреждение при новом коде), N2 (фокус на «Обновить список»), N5 (проверки фокуса в e2e) исправлены. **Эти последние правки агентами отдельно не просматривались** — покрыты unit (мутация N1 роняет тест) и e2e.
- Визуально (24 пары S3, последний прогон): workspaces desktop 0,8–1,0 %, tablet 1,1–1,4 %, phone 3,1–4,6 %; invitation desktop 1,1–1,8 %, tablet 1,5–2,6 %, phone 5,1–7,8 % (остаток — значение поля и другой текст кода).
- Не проверено: после «Повторить» (перезагрузка страницы) повторное открытие Radar в WebKit с имитацией сбоя через `route.abort` — запрос Radar после перезагрузки не уходит (подтверждено только в Chromium), реальный backend, VoiceOver. Окружение: оболочка могла стартовать на Node 20 — для команд использован Node 24.19.0 из `.nvmrc`.

### S4a — Мастер «Начало работы»: раскладка и шаг 1 «Компания» (**принят владельцем 28.10**)

**Срез:** `git diff 44fd9ae -- src tests tooling` = `ff5c61198221e4f1` (83 файла; включает закрытые S2, S3).

- Разбиение S4 на малые сценарии: **S4a** раскладка мастера + шаг 1 (US-M02-01); S4b шаг 2 «Точка и график» (US-M02-02); S4c шаг 3 «Услуги и цены»; S4d шаг 4 «Источник сообщений» + возврат/баннер (US-M02-03, 04).
  Шаги 2–4 пока рисуются прежним стилем внутри новой раскладки (в них остаётся собственная надпись «Шаг n из 4» — дубль с рядом шагов до их переноса).
- Эталоны: 12 кадров «Компания · Шаг 1» (477:7927, 479:10634/10753/10877, 479:13232/13348/13467/13591, 477:8822, 479:16160/16280/16405) — `artifacts/frontend-v2/F03/reference/company-*.png`;
  также 477:8024 (шаг 2, как образец ряда шагов с галочкой).
- Реализовано: виджет `AccountHeader` (шапка без панели; общий для PlainLayout и мастера), `OnboardingLayout` (шапка + ряд шагов + страница шага; право маршрута — «Раздел недоступен»), горизонтальный
  `OnboardingProgress` (4 обязательных шага: галочка / синий кружок / серый; «Шаг n из 4», на телефоне «· название»; необязательная привязка Telegram в ряд не входит), `UiPageIntro compact`,
  `UiField row` (подпись слева), страница «Компания»: строки «Название компании / Часовой пояс / Основная валюта», подсказки «Время в отчётах и событиях.» / «Для расчёта потенциала сделок и выручки.»,
  «Вы управляете действиями…», «Далее: Точка и график», кнопка «Создать компанию» (занятость «Создаём компанию…», имя для читалки сохраняется), «Вас пригласили в существующую компанию? Принять приглашение ›»,
  каркас первой загрузки (`App.vue`: `/onboarding/company`), ошибка «Введите название компании.» (с точкой, как в макете) и фокус на поле, замок отправки (одна организация), подписи поясов «Москва · UTC+3»
  (русские названия российских поясов + смещение из `Intl`; остальные — идентификатор; значение остаётся идентификатором IANA).
- Отличия от макета/stories (эффект сохранён): кнопка «Создать компанию» вместо «Продолжить» (story US-M02-01); поля пояса/валюты показывают подписи по справочнику приложения; в Figma на «Исходное» поле уже
  заполнено «Detail Lab», у нас оно пустое до ввода (в «Ошибке» пустое и без подсказки-образца — placeholder убран); у не-создателей (нет права, US-M02-07) вместо формы — прежняя плашка «Организацию создают
  по приглашению платформы» (кадра Figma нет, UNVERIFIED); «Вернуться к рабочим пространствам» добавлено в подвал при наличии членств (в Figma нет); каркас первой загрузки без имени/«Аккаунт»/«Выйти».
- **Бюджеты (28.10.2026 владелец поднял пределы: CSS 52000 → 72000, общий JS 845600 → 865600 байт, `bundle-budgets.json`; пороги входа/чанка/initialLoad не менялись).** До решения: S4a сначала превысил оба предела (CSS 53307/52000, JS 846698/845600). Сокращено без потери функций: линия ряда шагов одним элементом вместо `after:`,
  каркас кнопки — не кнопка, свёрнуты уникальные утилиты, удалены неиспользуемые глифы `check`/`refresh-dot` и иконки `notifications`/`arrow-forward` (~1,4 КБ JS), `space-y-1` и `font-normal!` убраны.
  **Итог: CSS 51978/52000 (запас 22 Б), JS 845045/845600 (запас 555 Б) — для S4b–S5 запаса практически нет:** каждый новый шаг придётся окупать удалением старого кода/стилей (перенесённые страницы
  заменяют прежние) либо решением владельца по пределам.
- Ревью (срез `785cc41bf3844676`): visual — ряд шагов был уже макета на 32 px (поля `main`), каркас формы ниже реальной, подвал ниже на 10 px → исправлено (`lg:px-0`, высота строк каркаса, `pt-6`); остаются P3: галочка «Текущее»/шага — иконка Material, поле на 1–3 px, подпись на телефоне 16 вместо 17 px, линия подвала на планшете 37–797 вместо 32–802 (1 px/5 px), в каркасе нет «Аккаунт»/«Выйти» (записано как согласуемое отличие). Functional — `maxlength=200` скрывал «Слишком длинное название» (убран; тест набором с клавиатуры), после `201` и сбоя `/auth/me` повтор создавал вторую организацию (теперь повторяется только перечитывание сессии; тест), `aria-current` на скрытой подписи шага (теперь на элементе списка, название и состояние — в `sr-only`; тест 390 px). **Правки после ревью агентами не пересматривались**; мутации (вернуть `maxlength`, убрать `created ??=`) роняют тесты.
- Тесты: unit `company-page` (10: строки и подсказки, пустое название + фокус, 200/201 символ, отправка/двойной submit/доступное имя, сбой сервера, каркас, подписи поясов), `onboarding-progress` (3),
  `account-data-pages` (шапка); e2e `onboarding.spec.ts` (6 × 3: экран и axe, пустое название, создание → шаг 2 с «выполнено», без горизонтальной прокрутки 320/390/834/1440).
- Команды (срез `ff5c61198221e4f1`, Node 24.19.0): `check` 0 (645 unit, statements 94,6 %), `typecheck`/`lint`/`format:check` 0, `build:dev/pre-prod/prod` 0, `audit:release` 0, Playwright
  chromium+webkit+mobile `--retries=0`: **314 passed, 32 skipped**, exit 0 (`artifacts/e2e-s4f.log`; в одном промежуточном полном прогоне 4 теста WebKit упали по таймауту и прошли в одиночном запуске и повторном
  полном прогоне — нагрузка, не S4a); `visual:capture`/`compare` 0 (`artifacts/cmd-*-s4f.log`).
- Визуально (12 пар «Компания»): desktop 2,0–3,2 %, tablet 2,8–4,5 %, phone 10,1–12,8 % (остаток — подпись 16 вместо 17 px на телефоне, на 1–3 px ниже строки, значение поля).

### S4b — Шаг 2 «Точка и график» (US-M02-02; **принят владельцем 28.10**)

**Срез:** `git diff 44fd9ae -- src tests tooling` = `9856fccf703269fc` (91 файл; включает закрытые S2, S3, S4a).

- Эталоны: 12 кадров (477:8024, 479:11001/11203/11409, 479:13034/13715/13917/14123, 477:8939, 479:16531/16753/16980) — `artifacts/frontend-v2/F03/reference/location-*.png`.
- Реализовано: страница по макету — заголовок «Когда вы отвечаете клиентам?» и пояснение, карточка «График точки · <название>» с подписью пояса «Москва · UTC+3» (`timeZoneLabel`), подсказка и «Применить ко всем рабочим дням»,
  семь строк дней (десктоп: компактные поля 80×34, планшет: 96×46, телефон: «с … до …» второй строкой), «Выходной», ошибка под днём «Время окончания должно быть позже начала.» (красные рамки, на десктопе справа) и фокус на первое поле с ошибкой,
  подвал «Настройки можно изменить позже в разделе «Настройки».» + «Назад» + «Далее: Услуги и цены» + «Сохранить и продолжить» («Сохраняем…», имя для читалки сохраняется), каркас загрузки точек (три размера; «Назад» доступна, кнопка шага серая и не кнопка).
  Поля времени остаются нативными `type=time` без значка выбора (на десктопе, как в макете).
- Решение по расхождению Figma и stories: тексты макета приоритетны — «Применить ко всем рабочим дням» (в story «…время понедельника…») и «Время окончания должно быть позже начала.» (в story «Открытие должно быть раньше закрытия»);
  тесты, e2e и настройки обновлены. Редактор графика общий с «Настройки → Компания и график»: там он тоже получил новый вид (дизайн настроек — S5).
- Без макета (UNVERIFIED): создание первой точки, если её ещё нет (в Figma точка уже есть) — прежняя карточка «Первая точка» с `LocationForm` внутри новой раскладки; каркас первой загрузки при холодном старте на `/onboarding/location`
  остаётся нейтральным спиннером (кадр «Первичная загрузка» — загрузка списка точек, он сделан).
- Тесты: unit `location-page` (6: карточка и подписи, каркас, ошибка + фокус, «Сохраняем…» и переход к шагу 3, «Назад», форма первой точки), `settings-forms`/`setup` обновлены, e2e `onboarding.spec` «шаг 2» (axe, ошибка границ, «Назад»);
  `responsive.spec` на 320 px потребовал `min-w-0` у групп времени. Мутация «убрать фокус на поле с ошибкой» роняет тест.
- Команды (срез `9856fccf703269fc`, Node 24.19.0): `check` 0 (656 unit), `lint`/`format:check` 0, `build:dev/pre-prod/prod` 0, `audit:release` 0 (CSS 53291/72000, JS 847430/865600), Playwright
  chromium+webkit+mobile `--retries=0`: **317 passed, 32 skipped**, exit 0 (`artifacts/e2e-s4j.log`); `visual:capture`/`compare` 0 (`artifacts/cmd-*-s4j.log`).
- Визуально (12 пар «Точка и график»): desktop 4,4–5,0 %, tablet 6,4–7,5 %, phone 10,2–13,4 % (остаток — высота строк на 1–3 px, шрифт и сглаживание времени).
- Ревью (срез `79b263ed56a0859a`): visual — время в полях по центру на планшете/телефоне, «Назад» с серой заливкой, ширина кнопки при «Сохраняем…» на телефоне, положение плашек каркаса, высота строк и строка «Выходной» → исправлено; functional — ошибка дня получила `id`/`role=alert` и `aria-describedby` у обоих полей, выбор точки блокируется на время сохранения, `?? false` у `save()`; добавлены тесты (равные времена, 00:00–23:59 и выходное воскресенье в теле PUT, семь рабочих дней, двойное нажатие, сбой 5xx на странице). Мутация `>=`→`>` в `validateWeek` роняет тест; «убрать `if (saving)`» не роняет — защита дублируется блокировкой кнопки (`loading`).
  **Правки после ревью агентами не пересматривались.** Не исправлено (P3/pre-existing): отмеченные дни при сохранении серые (нативный disabled) вместо синих в макете; квадратные нативные чекбоксы; черновик графика сбрасывается при смене точки/перечитывании списка (поведение прежнее, нужен отдельный диалог «потерять изменения?»); подписи шагов 12 px вместо 13 в двух кадрах.
- Регрессия «Настройки → Компания и график»: снимки общего редактора с ошибкой границ — `artifacts/frontend-v2/F03/actual/settings-company-{desktop,tablet,phone}.png` (эталонов нет; кадры настроек — S5).

### S4c — Шаг 3 «Услуги и цены» (US-M02-03; **принят владельцем 28.10**)

**Срез:** `git diff 44fd9ae -- src tests tooling` = `a76da4474695e9bd` (96 файлов; включает закрытые S2, S3, S4a, S4b).

- Эталоны: 12 кадров (477:8201, 479:11651/11797/11948, 479:14365/14508/14654/14805, 477:8562, 479:17244/17390/17541) — `artifacts/frontend-v2/F03/reference/services-*.png`.
- Реализовано: «Добавьте основные услуги» + пояснение, карточка «Каталог услуг» (название · «Все точки»/точка · цена; на телефоне столбцом), «Добавить услугу» (`ServiceForm wizard`: «Название услуги» + «Точка», «Цена от» / «Цена до» / «Валюта»,
  подсказка «Пустое поле — цена неизвестна.» ↔ ошибка «Цена «до» не может быть меньше цены «от».» в одной строке под рядом, красные рамки обеих цен, «Отмена» и «Добавить услугу» → «Добавляем…» с именем для читалки), блок «Диапазон не подменяет точную сумму»,
  подвал («Назад», «Далее: Источник сообщений», «Продолжить»), каркас загрузки обеих карточек (серая «Продолжить» — не кнопка). `UiButton outline`, `UiPageIntro measure`; в `UiSelect` пустое значение без подсказки читается как обычный пункт («Все точки» тёмным).
- Тексты макета приоритетнее story: «Цена «до» не может быть меньше цены «от».» заменила «Нижняя граница не может быть выше верхней» (общая схема: то же в диалоге услуги в настройках; тесты обновлены); подсказка про диапазон — «70 000 ₽» без кавычек.
  Форма в настройках (диалог) остаётся прежней раскладкой (`wizard=false`).
- Без макета (UNVERIFIED): пустой каталог («Услуг пока нет.») и сбой загрузки (плашка с повтором) — кадров нет; в кадре «Исходное»/«Ошибка» значение «Название услуги» в Figma — серый образец, у нас введённое значение.
- Тесты: unit `services-page` (7: каталог/форма/подсказки, ошибка цен с `aria-describedby`, `null`-цены и «Добавляем…», двойная отправка, каркас, «Назад»/«Продолжить», пустой каталог/сбой); e2e мастера обновлён («Назад» — кнопка).
- Команды (срез `a76da4474695e9bd`, Node 24.19.0): `check` 0 (667 unit), `lint`/`format:check` 0, `build:dev/pre-prod/prod` 0, `audit:release` 0 (CSS 54695/72000, JS 854010/865600), Playwright chromium+webkit+mobile `--retries=0`: **317 passed, 32 skipped**, exit 0
  (`artifacts/e2e-s4m.log`); `visual:capture`/`compare` 0 (`artifacts/cmd-*-s4m.log`).
- Визуально (12 пар): desktop 4,4–7,2 %, tablet 6,2–10,3 %, phone 8,6–23,0 % (максимум — каркас на телефоне: эталон — длинная лента с другой высотой блоков; остальное — сдвиги на 3–9 px и значение поля).
- Ревью (срез `379336867fb4b181`): visual — перенос пояснения (жёсткий на md+), ширина «Добавить услугу» при «Добавляем…» (`min-w-48`), размеры текста (`UiSelect` 17, подписи 13, имя услуги 16/medium), положение полос каркаса, зазор подвала, «Назад» белая — исправлено; functional — фокус после добавления/ошибки (на «Название услуги»), «Отмена» очищает форму и остаётся на шаге (раньше уводила на шаг 2), каркас, пока не пришли точки, постоянная живая область у подсказки/ошибки цен, тесты: три услуги подряд с обновлением каталога, «Отмена», сбой сервера, каркас по точкам (мутации «убрать `invalidateQueries`», «убрать фокус» роняют тесты).
  **Правки после ревью агентами не пересматривались.**
- Согласованные отличия (макет противоречит себе): «Добавить услугу» 164 px в «Исходном» desktop и 192 px в busy/tablet — взято 192 (стабильная ширина); «Отмена» при «Добавляем…» блеклая (disabled); ошибка цен в планшетном кадре — красная только «Цена до» с переносом, в десктопном — обе, взят десктопный вид; кадра «phone-error» с полной формой нет (эталон — верх ленты).
- Не проверено: фокус-кольцо `:focus-visible` на «Отмена»/outline-кнопке (нужен скриншот в браузере), промежуточные ширины, выбор точки в мастере (несколько точек) и неактивная точка (`locationId` принимается API — по docs, не проверено в mock).

### S4d — Шаг 4 «Источник сообщений» (экран и состояния; US-M02-03, 04; принят владельцем 28.10.2026)

**Срез:** `git diff 44fd9ae -- src tests tooling` = `f104d21bcb55eb68` (99 файлов; включает закрытые S2–S4c). Разбивка согласована владельцем 28.10: S4d — сам экран шага 4, S4e — диалоги «Подключить Telegram», «Подключение уведомлений», «Подробная инструкция» (кадры 479:18640…26379).

- Эталоны: 18 кадров — «Исходное» 477:8322 / 479:14968 / 477:8705, «Ошибка» 479:12111 / 15085 / 17705, «Проверяем» 479:12236 / 15210 / 17831, «Загрузка» 479:12361 / 15335 / 17957, «Бот подключён · уведомления отдельно» 479:23708 / 23824 / 23940,
  «Всё подключено» 479:24057 / 24150 / 24265 — `artifacts/frontend-v2/F03/reference/channel-*.png`.
- Реализовано: заголовок и пояснение по состояниям; карточка «Подключите Telegram» (знак, «Источник переписки», текст, «Подключить Telegram» / «Проверяем…» / «Повторить проверку» + «Не удалось проверить подключение»), каркас загрузки статуса,
  карточка «Telegram подключён» (имя подключения, «Слушает входящие» только у работающего подключения, «Управлять в «Интеграциях»»), недоступная карточка MAX («В работе»), строка «Уведомления в Telegram — личные, необязательно / подключены»,
  подсказки под карточками, подвал («Назад», «Подключу позже» / «Перейти в Radar»). Ряд шагов: галочка у шага 4 — только когда подключены и источник, и личные уведомления.
- Решения по макету и данным API: (1) блок «Что уже настроено» убран — статус в ряду шагов (в story US-M02-03 шаг 3 он есть); (2) вместо «@LidradarExample_bot» показывается имя подключения (в API нет имени бота);
  (3) при статусе не «Работает» бейдж и тексты честные («С перебоями», «Источник подключён, но работает не полностью…»), а не «слушает входящие»; (4) карточка MAX — статичная из макета (не подключаема, в API провайдера MAX нет);
  (5) «Уведомления в Telegram» открывает прежнюю карточку личной привязки в окне (дизайн окна — S4e); (6) «Подключить Telegram» открывает прежний диалог подключения (дизайн — S4e);
  (7) «Проверяем…» на кнопке — повторное чтение статуса/подключений (после подключения, возврата во вкладку, «Повторить проверку»).
- Тесты: unit `channel-page` (8: состояния, ошибка и повтор, подключён/с перебоями/всё подключено, окно уведомлений, «Назад»/«Подключу позже»), `onboarding-progress` (галочка шага «Источник»); e2e мастера и «Интеграции» обновлены под новый шаг.
- Команды (срез `f104d21bcb55eb68`, Node 24.19.0): `check` 0 (682 unit), `lint`/`format:check` 0, `build:dev/pre-prod/prod` 0, `audit:release` 0 (CSS 55334/72000, JS 859072/865600 — **запас JS 6,5 КБ**), Playwright chromium+webkit+mobile `--retries=0`: **320 passed, 32 skipped**, exit 0
  (`artifacts/e2e-s4p.log`); `visual:capture`/`compare` 0 (`artifacts/cmd-*-s4p.log`).
- Визуально (18 пар): desktop 2,2–3,7 %, tablet 3,0–5,3 %, phone 10,3–13,4 % (остаток — высоты блоков на 3–10 px, подписи и бейджи на 1–2 px).
- Ревью (срез `3487a9150f20f262`): functional — менеджер без права на интеграции и подключённый источник видел «требует внимания» (теперь нейтральный текст без утверждений о состоянии и без запроса подключений); сбой только чтения подключений при готовом источнике давал «Подключите» и «Подключён» одновременно (теперь «Telegram подключён» + строка «Не удалось проверить состояние» с повтором);
  «Проверяем…» мигало на каждом возврате во вкладку (теперь только после явного «Повторить проверку»; фон не трогает кнопку); повторное чтение после сбоя возвращало каркас (исправлено); e2e: фокус на заголовке после подключения, путь «Подключу позже» → баннер → «Продолжить настройку» → шаг 4; visual — каркас с галочками шагов 1–3,
  высоты карточек, ширина пояснения «Бот подключён…» (840), «Перейти в Radar» сверху на телефоне в «всё подключено», залитый зелёный колокольчик, знак MAX, размеры подписей и бейджей. **Правки после ревью агентами не пересматривались.**
- Отличия, оставленные намеренно: тексты «Всё подключено» на планшете и телефоне в Figma отличаются от десктопного («Бот подключён и слушает входящие… Личные уведомления в Telegram подключены.») — реализован десктопный на всех размерах; галочка шага 4 в «Всё подключено» на планшете/телефоне в Figma — цифра «4», на десктопе — галочка — реализована галочка (по десктопу и по смыслу «всё готово»);
  галочка шага 4 появляется только при подключённых источнике и личных уведомлениях (в макете «Бот подключён» — «4»), хотя сервер уже считает обязательные шаги выполненными; «Бот подключён… из выбранных чатов» — формулировка макета, в данных «выбранных чатов» нет; тон кнопки MAX и высота бейджа «В работе» различаются между кадрами макета — взято из «Исходного».

### S4e — Диалоги подключения: «Подключить Telegram», «Уведомления в Telegram», «Подробная инструкция» (US-M02-03; принят владельцем 28.10.2026)

**Срез:** `git diff 44fd9ae -- src tests tooling` = `ed47668d4c028b71` (включает закрытые S2–S4d).

- Эталоны (кадры 479:18640…26379): `telegram-{desktop,tablet,phone}[-error|-busy|-loading]`, `notify-…[-error|-busy|-loading|-linked]`, `instruction-desktop` (только десктоп) — `artifacts/frontend-v2/F03/reference/`.
- Реализовано: общий примитив `UiSheetDialog` (лист: знак, подзаголовок, прокрутка тела, нижняя панель с разделителем; на телефоне весь экран и кнопки столбцом, основное сверху; вложенные окна без второй подложки);
  `UiChannelMark` перенесён в `shared/ui`. «Подключить Telegram» — две колонки (форма и панель «Где взять токен бота» из пяти шагов), «Подключаем…», каркас точек при загрузке, отказ токена текстом макета под полем.
  «Уведомления в Telegram» — `TelegramNotifyDialog`: активная ссылка («Открыть бота», «Проверить привязку», «Ссылка действует ещё N минут»), «Проверяем…», «Ссылка больше не действует» + «Обновить ссылку», загрузка, «Уведомления успешно подключены» + «Готово», блок «Что не меняется».
  «Подробная инструкция» — 16 шагов с обезличенными скриншотами из макета (`features/connect-channel/guide`, 15 PNG и 16 SVG-затемнений ≈ 2,2 МБ), быстрые переходы, увеличение скриншота, «Вернуться к подключению»; окно грузится отдельным фрагментом (12,9 КБ JS).
- Решения и отличия от макета: (1) окно уведомлений при открытии само выпускает ссылку, если привязки нет (макет показывает активную ссылку сразу); дальше — только «Обновить ссылку»;
  (2) «Отключить» в окне нет (в макете нет); отключение осталось в карточке на страницах «Интеграции» и «Настройки» (`TelegramLinkCard` не менялась); (3) токен после отказа сервера очищается (в макете точки остаются) — токен не переживает отправку;
  (4) отказ токена показывается текстом макета только для `CHANNEL_CREDENTIALS_REJECTED`, остальные ошибки — прежним сообщением; (5) во время загрузки точек «Подключить» отключена (в макете активна); (6) «Секретарь»/«Business Mode»: тексты шагов — из макета (Secretary Mode);
  (7) после подключения остаётся прежний результат («Подключение создано», «Последний шаг в Telegram») с «Готово» в нижней панели; (8) «Подробная инструкция» скрывает окно подключения, пока открыта, форма и введённое сохраняются; высота окна 800 px и ширины 760/960/1120 — из макета.
- Тесты: unit `telegram-notify-dialog` (5), `telegram-instruction-dialog` (3), `integrations` (панель из пяти шагов, отказ токена под полем), `channel-page`; e2e мастера: панель, axe, открытие и возврат из инструкции с сохранением введённого.
- Команды (Node 24.19.0): `typecheck` 0, `eslint .` 0, `prettier --check` 0, `lint:fsd` 0, `test:architecture` 0, `test:coverage` 692 passed; Playwright chromium+webkit+mobile: **320 passed, 32 skipped**, exit 0;
  `visual:capture` 190 passed, `visual:compare` exit 0 (`artifacts/cmd-compare-s4e.log`).
- Визуально (28 пар, после ревью): desktop 2,8–4,9 % (инструкция 4,5 %), tablet 4,6–5,9 % (загрузка «Подключить» 9,2 %), phone 7,6–14,1 % (загрузка «Подключить» 16,9 % — скелет и неактивная кнопка, см. (5)).
- Ревью (срез `985c1b6e21894cfb`): visual FAIL → исправлено: ширины кнопок футера (Отмена 100, Подключить ≥196, «Отмена» не тускнеет при «Подключаем…»), заголовки секций 17/semibold, фон и радиус карточек (#f5f5f7, 20), позиция «Закрыть», отступ подписи ссылки, высота и положение окна инструкции, высота строки заголовка шага, нижняя панель инструкции, перенос чипов на телефоне, третья строка скелета.
  functional → исправлено: таймеры и опрос не запускаются после закрытия окна уведомлений (флаг в `use-telegram-link`; тест с мутацией), кнопка при непригодной ссылке — «Обновить ссылку», «Повторить» при сбое чтения статуса, выпуск по свежему статусу (не по кэшу), остаток срока без «16 минут» и NaN, токен не вызывает валидацию после очистки, окно не закрывается в окне проверки формы.
  Не исправлено: подложка кадров notify/phone зависит от фикстуры харнесса (фон шире эталона), у кадров tablet/phone инструкции эталона нет (UNVERIFIED); Escape во вложенных окнах, фокус после закрытия (D8) — не проверены тестами. **Правки после ревью агентами не пересматривались.**
- **Бюджет:** владелец поднял JS-лимит до 885600 (+20000, bundle-budgets.json, 28.10.2026); было `audit:bundle` — весь JavaScript **884443 / 865600 байт (+18843)**, остальные пороги в норме (CSS 58285/72000, вход 105020/110100, критическая загрузка 270274/304800). Рост — новые окна и 12,9 КБ текстов инструкции. Порог не менялся; нужно решение владельца (поднять лимит или сократить).

### S5 — Возврат к настройке, «Компания и график», несколько точек (US-M02-04, 05, 06; принят владельцем 29.10.2026 с перечисленными остатками)

**Срез:** `git diff 44fd9ae -- src tests tooling` = `062506b2c6c942ea` (включает закрытые S2–S4e). Дизайн настроек (Figma 523:54633) в `design-index.json` числится как «на согласовании» (`otherAreas`); владелец приказал начать S5, эталоны взяты из него.

- Эталоны: «Компания и график» 529:4216 (desktop), 593:7896 (tablet), 593:8692 (phone); состояния 562:5060 / 562:5284 / 562:5504 / 564:9310 / 568:7202 / 568:7423 (только desktop); окна «Добавить точку» 534:4297, «Изменить точку» 534:4255, «Изменить валюту и часовой пояс?» 534:5011, «Сохранить изменения графика?» 534:4996 (desktop — кадр окна 640 px; tablet 593:49519/49483, 594:15679/15663; phone 593:49948/49911, 594:15782/15765) — `artifacts/frontend-v2/F03/reference/settings-company-*`, `dialog-*`.
- Реализовано: страница v2 (`meta.v2`): контекст «Организация / Настройки», заголовок «Компания и график», вкладки (десктоп — шесть равных, активная плитка; планшет и телефон — «Раздел настроек» списком, общий `SettingsTabs` для всех вкладок), строка состояния («Изменения сохраняются отдельно…», «Загружаем данные…», «Повторить обновление» + «Параметры компании не обновлены»);
  карточка «Компания» (RUB · ₽, «Сохранить компанию» неактивна без правок), карточка «Точки» (порог и ожидание в рабочих минутах, «График ещё не сохранён», «Изменить точку»), «Точек пока нет» и «График появится после добавления точки», «График работы» (бейдж «Сохранён/Не сохранён», вид `settings` общего редактора: «Скопировать часы первого рабочего дня», строки 54 px), каркасы загрузки; пункт «Настройки» боковой колонки выбран на всех вкладках.
  Окна на `UiSheetDialog` (размер 640, подпись под заголовком в теле, кнопки поровну): «Добавить/Изменить точку» (`LocationForm variant="dialog"`), «Изменить валюту и часовой пояс?» («Оставить прежние» возвращает пояс и валюту), «Сохранить изменения графика?» (вместо `window.confirm` для смены точки и ухода со страницы; `beforeunload` прежний).
- US-M02-04: поведение уже обеспечено шагами 2–4 и баннером Radar; добавлен e2e «прервали на шаге 2 → баннер «Следующий шаг — точка и график» → «Продолжить настройку» → шаг 2, «Компания» остаётся пройденной» (3 браузера).
- Решения и отличия: (1) заголовок «Компания и график» вместо story «Настройки рабочего пространства»; окна «Добавить точку» вместо «Новая точка», «Изменить валюту и часовой пояс?» с одним текстом вместо перечня последствий по полям, кнопки «Оставить прежние»/«Сохранить изменения»/«К редактированию»/«Продолжить без сохранения»,
  подписи полей «Нет ответа, мин» и «Следующий шаг, мин» — тексты Figma (приоритет над stories, документировано); (2) «Сохранить компанию» в макете активна, в реализации неактивна без изменений (US-M02-05 шаг 3); (3) в макете нет выбора точки для графика при нескольких точках (US-M02-06) — оставлен список «Точка» в карточке графика; (4) кнопка копирования: на телефоне «Применить ко всем рабочим дням» и строка «Источник — первый рабочий день.», на планшете и десктопе «Скопировать часы первого рабочего дня» (как в кадрах);
  (5) строки сводки точки: «График: пн …» показывается, когда график сохранён (в макете такого кадра нет); (6) состояния «Обновление/Ошибка обновления/Загрузка/Нет точек/Сохраняем/Ошибка времени» проверены только на desktop (tablet/phone-эталоны состояний не скачивались); (7) подложки окон на планшете в эталоне нет (окно на пустом фоне), эталоны tablet окон не сравнивались; (8) боковая колонка в кадрах настроек отличается от утверждённой оболочки Radar (карточка «Источник Telegram», подпись «1 точка · Москва») — оболочку не менял, кроме выбранного пункта «Настройки».
- Тесты: unit `settings-forms` (17: окно точки, «Оставить прежние», подтверждение пояса/валюты), e2e настроек (окна, несохранённый график: «К редактированию» / «Продолжить без сохранения», axe, три браузера), `responsive` настроек (контраст бейджей исправлен), US-M02-04; хелперы вкладок для планшета и телефона.
- Команды (Node 24.19.0): `format:check` 0, `lint` 0, `lint:fsd` 0, `typecheck` 0, `test:architecture` 0, `test:coverage` 696 passed, Playwright `--retries=0`: **323 passed, 32 skipped**, exit 0 (на срезе до ревью один раз webkit «аналитика: окно дат» упал при полной параллельной нагрузке и 3 из 3 прошёл в одиночку — не связан с S5); `visual:capture` 217 passed, `visual:compare` 0 (`artifacts/cmd-compare-s5.log`).
- Визуально (26 пар, после ревью): desktop 2,9–5,8 % (окна 6,2–9,1 %), tablet 8,6 %, phone 14,2 % (окна 8,6–10,5 %); высоты кадров различаются на 6–220 px (сравнение до меньшей высоты).
- Ревью (срез `53ee49517483b0ab`): visual FAIL → исправлено: заголовок окон настроек 20 px, типографика пояснений и текста окон (16/semibold на планшете и телефоне, 14 на десктопе), боковые поля окон 17/24/32 px и отступ разделителя, поля страницы на планшете 24 px, подписи полей 16 px на планшете и телефоне, ширина «Сохранить график» на планшете, текст копирования на телефоне. Не исправлено: состояние «Ошибка времени» — в эталоне другой сценарий (ошибка у «Вторник», красное только «до», «Сохранить график» неактивна, текст «Вторник: …»), у реализации прежний текст и поле, общие с мастером; скелетоны светлее эталона; сводка точки и «Изменить точку» на 2–10 px выше.
  functional FAIL → исправлено: слушатель `beforeunload` снимается при уходе (e2e проверяет `defaultPrevented`, мутация ловится), вопрос о несохранённом графике закрывается при размонтировании страницы, фокус возвращается на список после отмены смены раздела и точки, пробел в конце названия не включает «Сохранить компанию»; e2e: порог 45 и «Активна»/«Неактивна», смена точки при несохранённом графике. Смена организации уходит с маршрута (`router.replace({ name: 'radar' })`), поэтому вопрос срабатывает штатно. Не покрыто тестами: ошибка сервера в окне подтверждения, повтор после «Оставить прежние», двойной клик «Добавить точку» на уровне окна, отказ менеджеру на `/settings/company`. **Правки после ревью агентами не пересматривались.**
- **Бюджет:** владелец 29.10 поднял JS-лимит до 905600 (+20000, bundle-budgets.json): JS 899661/905600, CSS 61267/72000.
- Ревью, второй круг (срез `c6c41117d78ff975`), владелец просил запустить ревьюеров: visual FAIL, functional FAIL (один средний дефект). Исправлено: ошибка дня снимается «Скопировать часы…» и снятием галочки; правка порога/названия точки не стирает несохранённый график (черновик сбрасывается только при смене точки или её графика); при уходе страницы редактор сообщает `dirty=false`; описания окон «Изменить точку» и «Изменить валюту…» полужирные на планшете и телефоне, тело окна несохранённого графика на десктопе тёмное; «Обновляем данные. Предыдущие значения остаются на экране.» с синим спиннером; «Сохраняем…» на кнопке графика; неактивная «Сохранить график» с ошибкой — белая с рамкой; скелетоны `bg-line!`; «Добавить точку» в пустой карточке 280 px; сводка точки 16 px на планшете. unit +1.
  Остаётся: в кадрах `refresh-error`/`refreshing` захват идёт через сохранение графика, поэтому в них видна плашка «График сохранён.» и кнопка в состоянии сохранения (в эталоне их нет; отдельного способа вызвать повторное чтение без сохранения в окружении нет); фон скелетонов (залитые поля вместо полос и «с/до»); «Выходной» и «Скопировать…» на планшете выровнены иначе; нативный `disabled` чекбоксов серый при сохранении; phone-кадры «Ошибка времени» и «Загрузка» не проверялись ревьюером.
- Ревью, третий круг (срез `13a883ca6bf8bf98`): functional **PASS** (три дефекта круга 2 закрыты, новых нет); visual FAIL по четырём кадрам. Исправлено после него: кнопка «Сохраняем…» остаётся синей, чекбоксы при сохранении бледные (не нативный `disabled`); «Ошибка обновления»/«Обновление» в харнесе вызываются без сохранения (время за срок свежести + `visibilitychange`, режимы ответов `ok/fail/hang`), плашки «График сохранён.» в кадрах больше нет; кадр снимается после `scrollTo(0,0)`; «Москва, UTC+3» в подзаголовке графика; сводка, пояснения и подзаголовок 16 px на телефоне и планшете; строка дня на телефоне выше; неактивная кнопка при ошибке бледнее. **Эти правки ревьюерами не пересматривались.**
  Остаётся: phone-кадр страницы 14 % (высота 2472 против 2690: отступы между блоками, раскладка строк дня), эталонов phone/tablet для состояний страницы нет (UNVERIFIED), подсказки «От 1 до 1 440…» в окне точки на телефоне, кнопка «Добавить точку» в пустой карточке на 8 px выше.
- Доработка после «не принимаю» (причины владелец не назвал): состояние «Ошибка времени» приведено к Figma 568:7423 — текст «Вторник: окончание рабочего дня должно быть позже начала.» слева, красным только поле «до», «Сохранить график» неактивна до правки поля (только вид `settings`; мастер не менялся; unit-тест); скелетоны темнее (#dedee3). Playwright `--retries=0`: 320–323 passed; при нагрузке машины (load average 19–35) webkit-тесты `workspace.spec` 4 раза падали по таймингу, с `--workers=2` все 41 прошли.

## G01 к повторной приёмке — 28.10.2026, второй круг (ветка `frontend/v2-implementation`, база 44fd9ae, правки не закоммичены)

G01 **не принят**; F03 не начат. Приёмка [REVIEW.md](/Users/aleksandrkisler/Documents/LidRadar_MVP_v1.1_package/design/g01-reacceptance-2026-10-28/REVIEW.md)
(срез `aa5518e2…`) выявила P1 и P2; оба исправлены.

**Зафиксированный срез:** хеш `git diff HEAD -- src tests tooling` = `5a8bb84d3c2c6b19` (28 файлов, `artifacts/slice-g01o.txt`).
Команды, скриншоты и ревью ниже относятся к нему, кроме отмеченного.

### P1 — команда смены этапа не меняет адресата

- Причина: `mutationFn` читал текущие id после асинхронной границы, `onMutate` защищал только перечитывание.
- Исправление (`use-change-stage.ts`): команда `{tenantId, riskId, opportunityId, stage}` фиксируется **синхронно** в `send()` (единственная точка входа; прямой
  `mutate` наружу не отдаётся); `mutationFn` и `onSettled` берут всё только из команды. Если организация уже сменилась, клиент API не отправит запись
  (несовпадение `X-Tenant-ID`) — запрос либо уходит строго в исходный контекст, либо блокируется до HTTP-записи.
- Регрессия (`change-stage.test.ts`, 20 тестов) проверяет URL, `X-Tenant-ID` и тело **на границе fetch**: нажатие в A и немедленное переключение на B → запрос
  строго в A; одновременная смена организации и сделки (без блокировки клиентом) → ничего не уходит в B, инвалидация только контекста A; то же **с реальным
  контекстом API** → клиент блокирует запись, форма B без ошибки/выбора/отправки; положительные: обычная отправка в A, выбор в B цел после позднего ответа A.
  Мутация (возврат прежнего хука) роняет оба сценария переключения.

### P2 — мобильный порядок Tab

- Воспроизведено по команде приёмки: 4 падения из 5. Причина: **тест**, не интерфейс. В WebKit/mobile событие смены ширины приходит асинхронно после
  `setViewportSize`, секции (Teleport) переезжают позже; тест начинал Tab-обход, пока раскладка была прежней (первый Tab «стоял на месте» или уходил в обвязку браузера).
- Эксперименты (mobile, без retries): слот + `toBeFocused` — **20/20**; только фокус страницы (`bringToFront` + `hasFocus`) + `toBeFocused` — 4 падения из 20;
  только `toBeFocused` — 5 из 10; ничего — 5 из 10. Решающий признак — **наблюдаемая готовность раскладки**: секции в ожидаемом контейнере (`data-slot="flat|left"` в `RiskWorkspace.vue`).
- В тесте нет пауз, retries, нового SKIP; проверки не ослаблены — наоборот, порядок колонок `L→R→L` теперь строго проверяется и в WebKit/mobile
  (раньше там сравнивалось само с собой). Прежнее WebKit-условие «минимум остановок > 3» осталось (WebKit не ставит Tab-фокус на кнопки).
- Результат: изолированный сценарий mobile ×10 (`--workers=1 --retries=0`) — **10/10**; на трёх проектах ×10 — **30/30**; матрица без retries — 191 passed.

### Статусы остальных пунктов (без изменений относительно прошлого круга)

Пункты 1–7, Tab, «Выйти», подвал, П2 («Оценка сигнала» 632 = 632), П3 (цвет вкладок), П5 (выбор этапа без автоповторов), фон бокового меню — сделаны; доказательства
в предыдущей редакции этого раздела и в тестах (`workspace.spec.ts`, `change-stage.test.ts`, `risk-feed.test.ts`, …). **VoiceOver — не проверено, проверка отложена** (решение владельца, не блокер).

### Команды (срез `5a8bb84d3c2c6b19`, Node 24.19.0)

| Команда                                                               | Код       | Результат                                 |
| --------------------------------------------------------------------- | --------- | ----------------------------------------- |
| `npm run check`                                                       | 0         | 586 unit, statements 94,6 %, lines 96,3 % |
| `build:dev` / `build:pre-prod` / `build:prod`                         | 0 / 0 / 0 | —                                         |
| `audit:release`                                                       | 0         | CSS 49740/52000                           |
| `format:check` / `typecheck` / `eslint`                               | 0 / 0 / 0 | —                                         |
| Tab-сценарий ×10 на chromium+webkit+mobile, `--workers=1 --retries=0` | 0         | 30 passed                                 |
| Tab-сценарий ×10 mobile, `--workers=1 --retries=0`                    | 0         | 10 passed                                 |
| Playwright chromium+webkit+mobile, `--retries=0`                      | 0         | 191 passed, 32 skipped (новых SKIP нет)   |
| `visual:capture` / `visual:compare`                                   | 0 / 0     | `artifacts/cmd-compare-g01o.log`          |

Логи: `artifacts/cmd-*-g01o.log`, `artifacts/e2e-g01o.log`. Реальный backend, Telegram, email, SSE/worker не запускались (только mock/frontend).

### Ревью (read-only агенты)

- Functional на срезе `2b5b1bca…`: **PASS по P1 и P2**, подтверждённых дефектов нет. Из рисков закрыты сразу: тавтология порядка колонок в WebKit (теперь строго `LRL`),
  открытый `mutate` в типе результата хука (убран), отсутствие теста с реальным контекстом API (добавлен). Эти три правки и итоговый срез агентом отдельно не просматривались
  (покрыты unit/e2e и командами выше). Interface (`src`) изменился только в `use-change-stage.ts` и `data-slot` у двух контейнеров; визуально не затронут — кадры пересняты.

### Остаток и UNVERIFIED (явно)

- **UNVERIFIED:** VoiceOver (отложено); пиксельный эталон нижних секций детали на телефоне (экспорт Figma возвращает заглушки).
- **Не выполнялось:** стенд, реальный backend, Telegram, email, SSE/worker.
- **Пропуски:** 32 теста Playwright (стендовые проекты; Tab-проверки на кнопках пропускаются в WebKit/mobile).
- Принятые низкие риски: слот-маркер проверяет одну секцию (остальные переезжают в том же рендере Vue); WebKit проверяет только поля форм.
- Согласованные отличия от Figma и геометрия — как в предыдущей редакции (подписи по API, «Выйти», подвал без числа, `#565b64`, тексты и подсказки).

## ТЕКУЩЕЕ СОСТОЯНИЕ — после PILOT-ACCEPTANCE-TASK (27.10.2026, ветка `frontend/v2-implementation`, не закоммичено)

Цель — «готов к пользовательской приёмке G01»; **G01 не принят**, F03 не начат. Всё ниже, кроме
подраздела «Исторически», — актуально; записи ниже по документу — исторические и не
противоречат этой секции только в части, явно не заменённой ею.

| Исправлено                                                                                                                                                          | Проверено                                                                                                                                             | Ограничение                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Адаптив детали tablet/phone: порядок блоков, hero, шапка «Меню» 80 px, отступы p-5 на телефоне; sidebar без `mt-auto`                                               | Tablet: 9/9 блоков по геометрии ±1 px; phone: 7/9 в допуске, hero −20 px (короткая подпись), Оценка −8 px (содержимое). Видимые viewport: 5.0 %/8.6 % | Низ деталей tablet/phone без пикселей (эталон обрезан); различия содержимого перечислены в acceptance-mapping                                    |
| MEDIUM: токены #f2f2f5/#6e6e73                                                                                                                                      | unit/e2e                                                                                                                                              | —                                                                                                                                                |
| Время: «Срок по правилу»/«Риск обнаружен», без «Ожидание» и таймера; имя точки в детали                                                                             | unit: NO_RESPONSE, FOLLOW_UP, future/null, закрытый                                                                                                   | Рабочее ожидание/порог в контракте отсутствуют                                                                                                   |
| Статус-вкладки без чисел (`active` / `status=OPEN` / `status=ACKNOWLEDGED`), URL, ключи, cursor, пустая вкладка                                                     | unit (запрос, ключи, парсер), e2e (запросы, reload, фильтры, сводка без status)                                                                       | Back из детали, смена организации и вкладки на телефоне отдельно не проверялись                                                                  |
| «N точек», бейдж Telegram по `liveConnections` (только `location.manage`, кэш 5 мин)                                                                                | e2e на chromium/webkit/mobile                                                                                                                         | Повторные запросы статуса возможны по сверке потока сигналов (общее поведение приложения); `liveConnections` не гарантирует исправность          |
| Harness: clock, единый dataset, ожидания без sleep; `compare.mjs` падает на пропаже кадра/эталона, ширине, фрагменте, высоте; окна и geometry                       | 10 unit на guardrails; `visual:capture` 16/16                                                                                                         | Ленты tablet/phone 7–13 % (не разобраны); list-tablet высота Δ4 px (композиция выровнена, вертикальный ритм — только цифрой); login-footer 6.8 % |
| CSS: `source(none)`+`src`+`index.html` (53220 → 49320 B); `format:check` (figma-reference.html отформатирован, `.claude/settings.local.json` исключён точным путём) | `format:check` 0                                                                                                                                      | `audit:bundle` **PASS 49320/52000**: владелец поднял бюджет CSS с 41000 до 52000 B (27.10.2026), обоснование — в `bundle-budgets.json`           |

Ревью 27.10 (два круга, read-only агенты). **Первый круг** нашёл: шапку Radar, строки list-tablet, подпись суммы, плашку потока, счётчик вкладки, aria-describedby, устаревший бейдж — исправлено (см. «Исправления после ревью» в acceptance-mapping).
**Повторный круг, visual:** шапка Radar tablet PASS, phone PASS (сдвиг бургера ≈6 px — минор); список tablet — композиция PASS, геометрия FAIL (карточка 183 против 205 px); после этого выровнены отступы и правая колонка, высота страницы 3388 против 3384 (Δ4), **повторно агентом не просматривалась**; «Открыть переписку» и подпись «Внешний переход недоступен…» (в Figma «Нет ссылки на диалог…») — отличия от эталона, **нужно решение владельца**; доступное имя кнопки проверено e2e, не визуально.
**Повторный круг, functional:** блокеров нет; порядок фокуса при `max-lg:contents/order` (WCAG 2.4.3) **не исправлен** — нужен ручной Tab-проход на 390/820 px и, вероятно, рендер блоков в порядке экрана; индикация потока: красная точка, имя кнопки и sr-only `role=status` только на Radar (на других v2-страницах нет). Добавлены тесты на живую область, счётчик вкладки, имя кнопки. Тест «Telegram в меню» не ловит снятие `staleTime` 5 мин, 15-секундный таймер сверки теоретически может дать флейк.
Финальные правки после ревью (отступы list-tablet, live-регион, тесты, бюджет CSS, конфиг Playwright) повторно агентами **не проверялись**.
Открыто: ленты tablet/phone 7–13 %, login-footer 6.8 %, hero phone −20 px и Оценка −8 px.

Команды (Node 24.19.0, финальный код): `npm run check` 0 (551 unit, statements 94.59 %, lines 96.29 %); `build:dev` 0;
`build:pre-prod` 0; `build:prod` 0; `audit:release` — см. ниже; Playwright `chromium+webkit+mobile`
**175 passed**, exit 0. **Firefox исключён из тестирования и приёмки решением владельца (27.10.2026)**:
проект удалён из `playwright.config.ts` (браузер в этой среде всё равно не запускался: `Could not find profile folder`).
Бюджет CSS поднят владельцем с 41000 до 52000 B (сборка 49320 B), обоснование — `bundle-budgets.json`.
Stand и реальный backend/Telegram не запускались. Артефакты: `artifacts/frontend-v2/{F01,F02}/{reference,actual,diff}`,
`diff-summary.txt`; логи — `artifacts/e2e-final.log`, `artifacts/cmd-*.log`.

Порядок ручного просмотра G01: login (desktop, phone) → Radar (плитки, список, tablet/phone) → вкладки
и фильтры → деталь (desktop, tablet, phone) → «Взять в работу» → «К рискам» / reload.
Решения и карта приёмки: [DEPENDENCIES](DEPENDENCIES.md), [acceptance-mapping](evidence/F02/acceptance-mapping.md).

## Исторически: проверка Codex — 27.10.2026 (заменена секцией выше)

G01 не принят. Новое поручение: [PILOT-ACCEPTANCE-TASK.md](PILOT-ACCEPTANCE-TASK.md).
Независимый результат: [audit](evidence/pilot-audit-2026-10-27.md).
Найдены исходные адаптивы детали и MEDIUM; прежние блокеры ниже пересмотрены.
537 unit + 5 Chromium smoke PASS; CSS/format FAIL; другие браузеры не установлены.
Следующий шаг — выполнить актуальное задание. Нижеследующие записи — история предыдущих запусков.

Дата подготовки: 26.10.2026. Реализация интерфейса ещё не начата.
Исходный frontend HEAD: f26c0d954d25dee1d88d363d2d31b8b12bf3ceae (main).
На момент начала настройки рабочее дерево было чистым.

## Подготовлено

- Основная сессия Sonnet; два read-only reviewer Sonnet; expert Opus по запросу.
- CLAUDE.md, WORKFLOW, источники user stories, компактный индекс Figma.
- Remote Figma MCP конфигурация без credentials; подключение ещё не проверено.
- Локальный launcher с выбором Node из .nvmrc и поиском Claude CLI/Desktop bundle.

## Известно

- Node 24.19.0 установлен; обычный shell по умолчанию использует 20.19.0.
- Claude Code 2.1.308 найден внутри Desktop bundle и отвечает на --version.
- CLI auth status: loggedIn=false. Пользователю нужен интерактивный вход либо
  запуск через уже авторизованную вкладку Code приложения Claude.
- Access/Onboarding ledger approved. Radar review502/503/510/515 отклонены.
- Текущий runtime использует Roboto Flex/M3; целевой дизайн — Inter.
- Для акцентной карточки 632:8092 нет отдельного выбора; базовый detail 199:11280.

## Следующее

Войти в Claude, подключить Figma и запустить START.md. F00: baseline checks,
выбор/экспорт узлов и task brief. Далее F01/F02, затем G01 пользовательская приёмка.
Приложение и его тесты при настройке агентов не изменялись; frontend baseline
checks ещё не запускались. Конфигурация не доказывает готовность интерфейса.

## Проверки настройки

- Claude Code 2.1.308: `plugin validate .claude/agents` — PASS.
- `bash -n scripts/claude-frontend.sh` — PASS.
- `bash scripts/claude-frontend.sh doctor` — PASS для окружения и конфигурации;
  CLI authentication отсутствует, Figma OAuth ещё не проверен.
- Форматирование новых Markdown/JSON проверено установленным Prettier.

## Исторически: реализация пилота F01/F02 (26.10.2026; цифры CSS, MEDIUM, «Ожидание», вкладки и адаптив детали заменены секцией «ТЕКУЩЕЕ СОСТОЯНИЕ»)

G01 **ещё не принят**. Figma MCP авторизован. Исправление индекса (Codex): мобильный вход —
**464:8980**, а 464:8859 — регистрация; блокера «нет мобильного входа» больше нет (история —
в `evidence/F01/source-map.md` и `login-phone-reference-correction.md`).

Эвиденс и воспроизведение: `npm run visual:capture` → `npm run visual:compare`
(`tooling/visual/`, результат в `artifacts/frontend-v2/`, игнорируется git, не стирается
`playwright test`). Source-map: `evidence/F00|F01|F02/source-map.md`. Реальные
API/дизайн-зависимости и конфликты: `DEPENDENCIES.md`.

### F00 — baseline (Node 24.19.0, HEAD f26c0d9)

`format:check` FAIL (существовал: `public/figma-reference.html`, `.claude/settings.local.json`);
остальное зелёное; `audit:bundle` FAIL на HEAD (CSS 41913 B при бюджете 41000).

### F01 — Доступ (mock/frontend)

Login desktop/tablet и **login phone 464:8980 со всеми состояниями**: исходное, ошибка
(464:9085, 390×1258), отправка (464:9205), первичная загрузка (464:9319 — каркас на `/login`
до завершения boot). Совпали full-page высоты 1154/1258 и геометрия; остаток 2.4–2.9 % —
антиалиасинг. Доработано: `UiAlert` (радиус 10, рамка /20, заголовок #b42318), «Входим…» с
сохранением имени «Войти», disabled полей (opacity 70), каркас загрузки.
Register phone — 3.1 %; register desktop/tablet и forgot/reset/verify — кадры не выбраны.

### F02 — Radar и деталь риска (mock/frontend)

Radar desktop: ряды карточек y=490/866/1242/1618 как в Figma; плитки 4.9 %, список 4.1 %
(в первые 1000 px). Планшет/телефон (кандидаты 630:*, явного утверждения нет): 8–12 % —
отличия сводки/подписей, статус-вкладок нет. Деталь desktop 6.1 % (первые 1000 px),
доведены формы «Работа по риску» (подписи, placeholder, disabled до выбора, подсказки),
«Этап сделки» («Новый этап», «Изменить этап», строка последнего перехода), «Оценка сигнала»
(две колонки, копия Figma, подтверждение), «История» (обнаружение, этапы, действия, счётчик),
hero (длительность ожидания, дата), disabled «Открыть в Telegram» с пояснением, «Закрыть
риск…». Закрыты замечания ревью: `>` в списке, Radar активен на странице риска, фокус кнопки
обновления, resize textarea, пометка неудачного обновления сводки, запоминание вида ленты,
объявление блокировки входа один раз, имя точки в подписи карточки.

### Расхождения со stories (требуют отметки владельца)

- US-M01-03: заголовок «Вход в LidRadar» вместо «Войдите в своё рабочее пространство».
- US-M07-03 шаг 4: на карточке ленты нет видимых «Ожидание с», «Обнаружен», «Открыть в
  Telegram» (в Figma карточки их нет; данные — для скринридера, ссылка — в детали).
- US-M07-04: нет блока «Статус»; статус — чип, «В работе с» — строка карточки ситуации.
- Деньги: подписи контракта сохранены вместо «Потенциал сделок под риском/Возвращённая выручка».

### CSS-бюджет (не скрыт)

HEAD 41913 B → теперь 53220 B (+11307 B, +27 %); бюджет 41000 B не менялся. Измерение:
правила 36.3 KB, `@media/@container` 8.2 KB, `@supports` (fallback color-mix) 5.3 KB, `@property`
3.0 KB; около 96 произвольных utility (~7 KB). Замена `h-[46px]` на токен не дала выигрыша.
Рост — поверхность переноса (оболочка, лента, деталь, формы, адаптивы), дубликатов не найдено.
**Нужно решение владельца:** обосновать новый бюджет (≈54 KB) либо вынести повторяющиеся
карточные паттерны в `@layer components`. До решения audit:bundle считается FAIL.

### Ревью после доработки (read-only агенты, 27.10.2026)

- Visual, login phone 464:8980 + error/busy/loading: **PASS** (видимые 844 px); нижний блок
  full-page ниже 844 — UNVERIFIED (эталон Figma 844 px; высоты 1154/1258 сходятся с метаданными).
- Functional нашёл: не импортированный `UiButton` в детали (отключённая кнопка Telegram не
  рендерилась) — **исправлено**, добавлен unit; stand-спека со старыми локаторами —
  **исправлена**; сортировка истории по `Date.parse`, дата при событиях в разных днях,
  состояние «срок ответа не наступил» вместо ложного «менее минуты» — **исправлены**.
- Открыто (решение/зависимость): disabled-до-выбора против US-M08-02/04 шаг 2; заметка
  действия отсутствует в `RadarAction`; тексты stories этапов/форм заменены копией Figma —
  всё в `DEPENDENCIES.md`. Фокус после отправки формы (поля disabled) — не менялся,
  требует проверки в реальном браузере со скринридером.
- Visual по детали (итоговое ревью, только desktop): «Переписка» и отступ истории — PASS;
  после отчёта подправлены «К рискам», сумма в подвале плитки, интервал в «Потенциале сделки»
  и подсказка «Оценки сигнала» (повторно агентом не просматривались). Высота документа 1806
  против 1807. Планшет/телефон детали — UNVERIFIED (нет эталона).

### Проверки конца этапа (Node 24.19.0, без реального backend)

`typecheck` 0; `lint` 0; `lint:fsd` 0; `api:check` 0; `test:coverage` 0 (537 тестов, thresholds
ок); `test:architecture` 0; `build:pre-prod` 0; `playwright --project=chromium` 0 (101);
`format:check` 1 и `audit:bundle` 1 — существующие/описанные выше. Не запускались:
firefox/webkit/mobile (нет браузеров), реальный backend/Telegram.

### Следующий шаг

Ревью (visual: login-phone и исправленные части F02; functional: новый diff) → G01 владельцу.
До приёмки F03 не начинать.
