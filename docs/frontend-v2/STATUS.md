# Статус frontend v2

## Codex · Аналитика · передача в stage · 03.11.2026

После завершения US-M13-01–04 владелец отдельно поручил commit и push в
`stage` без новых тестов и без smoke на stage. К передаче подготовлены
исходники, тесты и связанная документация макетов/согласования. Принятый
снимок `analytics-r7`:625/625 inputs сохранены без расхождений; его TEST,
FUNCTIONAL и UI результаты ниже остаются результатами локального mock-контура.
Новые проверки приложения и stage smoke не запускались. Штатный GitHub CI
при push остаётся без изменений; факт push определяется историей `origin/stage`,
автодеплой и живую stage-приёмку этот отчёт не подтверждает. Полная регрессия
и общая приёмка frontend по-прежнему отложены. Production не затрагивается.

## Codex · Аналитика · реализация и адресная проверка · 03.11.2026

US-M13-01–04: реализованы три вкладки «Обзор», «Риски и качество», «Оплаты».
Общий период с draft/applied и URL, точные decimal-суммы, дневной ряд/диалог,
независимые query families, precision ΣTP/(ΣTP+ΣFP), cursor append/retry/reset,
переходы и возврат в журнал с фокусом/scroll. Backend/OpenAPI/Figma/production
не изменялись. Dirty docs/evidence предыдущей работы сохранены.

Рабочая ветка `frontend/v2-implementation`, HEAD
`2187d5085373865a99c8428c9a14c687134d686f`. Все write sets workers переданы root.
Последний принятый функционально снимок `analytics-r6`:
`artifacts/frontend-v2/analytics-implementation-2026-11-03/manifest-r6.json`
(621 input). QA TEST/FUNCTIONAL PASS:50unit/39filteredE2E/static0, drift0.
UI R6 desktop/tablet/mobile FAIL: loading заменял композицию крупными
прямоугольниками, error — красной вложенной карточкой вместо нейтральной.
Оба прежних R5 findings (длинная сумма и D1) визуально CLOSED.
Evidence: qa-r6/report.md, ui-r6/report.md, неизменяемый browser-r6/78PNG.
Референсы S01/S04/L00/E03/LM1 добавлены в approved-reference-images-r7.json
(37точныхэкспортов). Исходные design evidence/exports Claude неизменны.

Текущий freeze `analytics-r7`, manifest-r7.json:625inputs. Worker передал
владение AnalyticsLoading.vue и analytics-loading.test.ts root. Новый pure UI
сохраняет структуруS01/L00,5вариантов, staticlabels ималыеskeleton безdummydata.
AnalyticsError: нейтральная surface,embeddedбезвторойcard,retry240,safe recovery
403/404/429 безrawservermessage. Rootизменилтолькоanalytics sourcefamilystates,
ошибкиqualityподписаны«риски/оценки»,journal«журнал», какapproved.

Root адресно:52widgetunitPASS (66unitпо8specsполныйanalyticsнабор),8affected
E2EPASS. ПервыйrootR7E2E exit1 былERR_CONNECTION_REFUSED (Viteпроцессзавершился),
послеrestartтотженабор8/8PASS. НовыйVite4173 session82200. КадрыR7отдельно
browser-r7/; R6immutable78PNGсохранены. 37sourcehashesapproved-reference-images-r7.

Независимый QA R7 завершён: **TEST PASS / FUNCTIONAL PASS** локальной
mock-аналитики:8 unit specs,66 tests;39/39 filtered E2E,44.2s; typecheck,
scoped ESLint/Prettier exit0.625/625 hashes совпали, drift0, unlisted0.
QA-report: qa-r7/report.md; команды/логи/metadata и78browser hashes рядом.
Manifest SHA:7cf4652636df63ff26bf3268738f3964c04cd5c77a749853a9de6690fd73bcb4.

Независимый UI R7 завершён: **desktop PASS / tablet PASS / mobile PASS**.
Все R5/R6 findings CLOSED, новых не обнаружено. Реально просмотрены base
full-document/viewport, loading/error/focus/busy, daily/period и stress widths;
37 источников и78browser hashes совпали,625inputs drift0. Снимок остаётся
финальным analytics-r7; после приёмки runtime/tests не менялись.

Работа **US-M13-01–04 завершена** в границах локального frontend/mock QA.
Итог: docs/frontend-v2/evidence/analytics-implementation-2026-11-03.md;
QA: artifacts/frontend-v2/analytics-implementation-2026-11-03/qa-r7/report.md;
UI: artifacts/frontend-v2/analytics-implementation-2026-11-03/ui-r7/report.md.
Открытых analytics findings нет. Владение файлов — root. Commit/push/deploy
не выполнялись. Следующий шаг — продолжение frontend по следующему поручению;
общая регрессия после завершения frontend отдельным этапом, не релизный PASS.
Полная регрессия и общая приёмка приложения **DEFERRED до завершения frontend**
по прямому указанию владельца. Stage QA NOT RUN; локальные mocks отдельно.

## Codex · Аналитика · все три вкладки согласованы · 03.11.2026

Владелец согласовал «Обзор», «Риски и качество» и «Оплаты» на desktop/tablet/
mobile, включая новую desktop-базу Оплат, синхронизацию C и решения P1/P2.
Текущие эталоны — области `1636:7923`, `1656:14471`, `1690:31301` и их карты
в `design-index.json`. Предыдущие записи «на согласование» ниже — история;
решение: [analytics-design-approval](evidence/analytics-design-approval-2026-11-03.md).

Подготовлен [промпт разработки трёх вкладок](prompts/analytics-implementation-2026-11-03.md),
US-M13-01–04. Прямое указание владельца: тестировать только выполненную работу
в аналитике, включая её переходы/возврат. Полные тесты приложения и итоговая
приёмка frontend — DEFERRED до завершения frontend. Это ограничение имеет
приоритет над общими финальными gates WORKFLOW и распространяется на QA.
Не ослаблять проверки/CI; выбирать конкретные аналитические тесты.

В этом ходе изменены только approval/index/документация и промпт. Runtime,
tests, API/backend, Figma и production не менялись; TEST/FUNCTIONAL/browser UI
NOT RUN. HEAD `2187d5085373865a99c8428c9a14c687134d686f`, ветка
`frontend/v2-implementation`; dirty tree сохранён. Владение — root.
Следующий шаг: исполнить подготовленный промпт по отдельному поручению;
согласование дизайна не равно runtime PASS.

## Codex · Оплаты · состояния готовы к согласованию · 03.11.2026

US-M13-02/03 + применимые US-M13-01, только дизайн. Область1690:31301:
66состояний×3адаптива =198 документов в отдельных viewport1440×1000/
834×1194/390×844. Desktop — новая база на согласование, оригиналы сохранены.
Новые локальные row8/pager6 вариантов; общие период/refresh/errors/guards и
существующие назначения переиспользованы.619 записанных реакций,324/324
проверок цепочек; actual NODE616/204unique targets/missing0. Все198 геометрии/
данных сверены, первые4строки сохраняют позиции, nextCursor=null безMore.

Независимо просмотрены198/198 fullPNG (132D/T+66M),27/27 nativeviewportproofs
и specimen14вариантов; SHA before/after совпали. Исправлены новые экземпляры
summary-error и локальный focus-ring; R1 сохранён. Пустые выгрузки пересняты;
PNG сигнатуры/IEND/размеры/decode проверены.30/30 protected FNV совпали.
Figma snapshot4de28eb6,37958nodes/14327TEXT/Inter/rasterfills0,clipping198
восстановлен. HEAD2187d5085373865a99c8428c9a14c687134d686f,
branch frontend/v2-implementation. Артефакты:
artifacts/frontend-v2/analytics-payments-states-2026-11-03/ — manifest,
state-map,states-and-node-ids,fixtures,prototypes,reviews,previews.
Отчёт: docs/frontend-v2/evidence/analytics-payments-states-2026-11-03.md.

Открытых layout/copy/overflow findings нет. Ограничение storyboard: NO/NR и
существующие risk/conversation destinations сохраняют отдельные presentation
fixtures, не единый денежный/lifecycle snapshot с Payments. Явно аннотировано.
Будущая реализация: preserve pages при next error/local retry, invalid continuation
reset, conversation binding, back period/pages/anchor/focus, manual refresh.
Frontend/backend/tests/API/prod не менялись; TEST/FUNCTIONAL/browser UI NOTRUN.
Figma Present попытка не загрузила экран; actual playback/scroll/focus/DOM/AT/
keyboard UNVERIFIED. Макеты не утверждены. Следующий шаг — согласование владельцем
новой Desktop-базы, состояний и минимальной синхронизации C; реализация отдельно.
Владение файлами/Figma — root.

## Codex · Риски и качество · состояния готовы к согласованию · 03.11.2026

Дизайн-only US-M13-04 + общие US-M13-01/03. Область Figma1656:14471:
53 сценария ×3 адаптива =159 редактируемых документов внутри отдельных viewport
1440×1000/834×1194/390×844; полная высота документа хранится отдельно.
Связан601 переход; подготовлены независимые ошибки/повторы,14 числовых
профилей, период, навигационные копии Обзора, access recovery без редизайна.
Исходники1606:7777/1622:7834/1622:8555, Обзор1636:7923 и shared masters
защищены baseline12FNV; финальная сверка12/12 unchanged. Общий KPI P1 предложен
как ΣTP/(ΣTP+ΣFP),R00=9/11≈82%; P2«По дате действия». Исходные79% сохранены.
Артефакты: artifacts/frontend-v2/analytics-risk-quality-states-2026-11-03/ —
node-ledger,state-map,design-samples,prototype,manifest,final-review и previews.
Независимые reviewers просмотрели159/159 полных PNG:106Desktop/Tablet и53Mobile.
ТриLow (маскаRetry,basiscolor,QLATEselected30) исправлены; повторно просмотрены
54/54 изменённыхPNG и21/21 nativeviewportproofs. Открытых visual findings нет.
R1сохранён вexports-r1/,105PNGunchanged; размеры180PNG и SHA сверены.
Clipping159viewport восстановлен; полные документы сохранены. Цепочки231/231,
назначения601/601 существуют. Общий период демонстрируется из исходных30дней,
включая применение7/90/1/4; другие полученные результаты — данные и парная
навигация. Независимые числовые профили статичны; границы явно аннотированы.
Snapshot HEAD2187d5085373865a99c8428c9a14c687134d686f,
branchfrontend/v2-implementation. Отчёт:
docs/frontend-v2/evidence/analytics-risk-quality-states-2026-11-03.md.
Frontend/backend/tests/API/production не менялись. TEST/FUNCTIONAL/browser UI
NOT RUN; playback/DOM/AT/реальная прокрутка и клавиатура UNVERIFIED.
Макеты не утверждены. Следующий шаг — согласование владельцем P1/P2 и состояний;
реализация требует отдельного поручения. Владение файлами и Figma — root.

## Codex · Аналитика / Обзор · состояния готовы к согласованию · 02–03.11.2026

US-M13-01/02/03, только дизайн. Область Figma `1636:7923` содержит123 кадра
(41 сценарий ×1440/834/390), карту и два локальных набора вариантов. Исходные
1606:7507/1622:7517/1622:8245, диалог1603:55698 и masters664:3935/256:2529
сохранены:6/6 контрольных FNV подписей совпали. Все649 назначения существуют,
48 проверок цепочек/возвратов прототипа прошли. Два независимых design-only
reviewers реально просмотрели82Desktop/Tablet и41MobilePNG; последние C1/A30
перепроверены после исправлений. Открытых visual findings нет. Все123 финальных
PNG сохранены, размеры сверены; SHA-256 зафиксированы в manifest. Сбои batch
экспорта закрыты адресной повторной выгрузкой, старые PNG не являются финальными.
Артефакты: `artifacts/frontend-v2/analytics-states-2026-11-02/` — state-map,
node-ledger/final-structure, compose/prototype scripts, design-samples, exports.
Frontend/backend/API/tests/production не менялись, runtime TEST/FUNCTIONAL/UI
NOT RUN. Реальные DOM/focus/ARIA/клавиатура/abort/auth и Figma playback UNVERIFIED.
Таблица всех IDs:states-and-node-ids.md; отчёт:
docs/frontend-v2/evidence/analytics-overview-states-2026-11-03.md. Snapshot:
HEAD2187d5085373865a99c8428c9a14c687134d686f, branchfrontend/v2-implementation.
Макеты не утверждены. Следующий шаг — согласование владельцем; реализация
требует отдельного поручения.

## Codex · Аналитика · исправление фона6frames · 02.11.2026

По замечанию владельца root fills6 новых макетов заменены с transparent на
canonical Radar C canvas#F5F5F7 (эталон27:2765). IDs1606:7507/1606:7777,
1622:7517/1622:7834/1622:8245/1622:8555 прежние. Layout, размеры, тексты,
карточки, меню и все вложенные properties сохранены: protected digests6/6 equal,
root fills исключены из digest. Ведущий просмотрел6nativePNG на3 адаптивах,
background-only CANVAS принят. Explorer независимо подтвердил причину по двум
compose.js: source fills копировались без canvas. Shared masters/tokens прежние.
Попытка привязки старого token остановлена до записи: обаcanvas aliases отличаются
от эталона; скопирован точный paint27:2765. Runtime/API/tests/prod не менялись,
TEST/FUNCTIONAL/browser UI/independent visual NOTRUN; новый owner approval layouts
не присваивается. HEAD2187d5085373865a99c8428c9a14c687134d686f, branch прежняя.
Manifest:artifacts/frontend-v2/analytics-background-2026-11-02/manifest.json;
[evidence](evidence/analytics-background-2026-11-02.md). Предыдущие manifests/PNG
сохранены, backgroundCorrection имеет приоритет только для root fills.

## Codex · Аналитика · планшет и телефон · 02.11.2026

US-M13-01–04 references: подготовлены4 editable адаптации текущих desktop C:
tablet Обзор1622:7517(834×2543), Риски1622:7834(834×2536);
mobile Обзор1622:8245(390×3767), Риски1622:8555(390×4488).
Сетка рисков2колонки tablet/1 mobile, сводки mobile2×2, compact appbar C,
responsive chart variants, период mobile2строки, операции/оценки mobile1колонка.
Все4 финальных native PNG просмотрены ведущим. Видимый overflow0; тексты/числа
12/12 аналитических блоков равны desktop. Fingerprints4источников unchanged.
Desktop/старые compact/shared masters не менялись; только новые frames и размер
секции4800×13200. Исходные328:17122/328:17325 уже отсутствовали до работы,
использованы действующие1606:7542/1606:7812. Runtime/tests/API/prod не затронуты.
Snapshot HEAD2187d5085373865a99c8428c9a14c687134d686f, branchfrontend/v2-implementation.
Manifest:artifacts/frontend-v2/analytics-adaptives-2026-11-02/manifest.json;
[evidence](evidence/analytics-adaptives-2026-11-02.md). Runtime TEST/FUNCTIONAL/browser
UI/independent UI не запускались. Макеты pending owner approval; следующий шаг —
согласование владельцем четырёх адаптаций.

## Codex · Settings Privacy · stage delivery · 02.11.2026 · CI blockers

Владелец поручил commit/push/stage без новых локальных tests и устранение blockers.
6654678/RC1 отправлен вstage иfeature; все837filehashes unchanged. CI41439289032:
quality/builds3/container PASS, shard1 nativepinch scale1 FAIL, shard2 WebKit open
dialog1FLAKY; stage-deploy SKIPPED. Rawlogs/traces/artifacts сохранены.
a84440a/RC2 меняет только native-pinch browser на fullheadlessChromium, жест ивсе
assertions прежние; CI41443408243 проверяет этот fix. Runtime/UI/API не менялись.
Следующий адресный fixture fix ordinaryworkspaceconsent держит SSE stream открытым,
вместо искусственных EOF/reconnect во времяmouseDown/up; explicitreconnect иheldGET
проверки остаются. Никакие skips/таймауты/coverage/budgets/matrix не ослаблены.

VPN исправлен владельцем, SSH stage доступен. Подтверждён envstaging/domain/
composeproject; старыйrelease ed577f84e992-we7940037. Неиспользуемый Dockerbuildercache
старше24h очищен:2.747GB, свободно6.6GB вместо4.8; images145/volumes4 не менялись,
backups/данные/prod не тронуты. Требование5GB не обходилось. Backend/source/API/
migrations прежние. Stage пока не объявлен выложенным; ожидается чистый CI+deploy.
Evidence:docs/frontend-v2/evidence/settings-privacy-stage-2026-11-02.md и
artifacts/frontend-v2/settings-privacy-redesign/stage-2026-11-02/. R6 acceptance
ниже — исторический frontend/mock snapshot, не PASS изменённых CI inputs.

## Codex · Settings Privacy · final R6 · 02.11.2026 · frontend/mock ПРИНЯТО

Третий этап US-M14-01/02/04/07 завершён: mobile390 и финальная приёмка трёх размеров.
Независимый TEST PASS, отдельный FUNCTIONAL PASS; UI desktop PASS22/tablet PASS22/
mobile PASS22 против approved Figma и owner exception нижней Account#005BB5.
Все66entries и40extras оценены, direct/reuseSHA метод раскрыт в R6/ui/report.md
иviewed-images.json; исторический desktopR7 UNVERIFIED не переписан задним числом.

Snapshot1680inputs/837git-visible,branchfrontend/v2-implementation,
HEADc59bce88a64a596f3b3d2f0fb760105308cb193e,
manifestSHA d0097014d85604924bc6436488a10f32715ef2c1697c25907e4089f1e44e6238.
Check1260unit/109files,builddev/preprod/prod/audit exit0;fullstrict1368PASS40SKIP/
1408attempts,0initialfail/retry/flaky. JS905560≤905600,CSS71967≤72000.
FUNCTIONAL20controlled +6fallback PASS, MOBILE-R2-QA-01(rotation visibility) и
MOBILE-R4-QA-01(enabled confirm/backgroundGET) CLOSED наR6. ResyncfindingCLOSEDR2
сохранён, historicalAnalyticsR4-QA-01 OPEN/cause-datingUNVERIFIED.

Все before/after TEST/FUNCTIONAL/UI coreguards0/drift[]1680/837;UIseal6SHA
b7e0689e24474f8188c3e28f34c697a74a8d7a53dc5a068b385bdd627211de55 также0/drift[].
QA/UI освободили locks и4173. После release ведущий обновил только STATUS и finalhandoff;
дваmetadata delta/1678unchanged inputs объявлены в R6/post-review-metadata.json.
Чужие source/tests/untracked/Analyticsmetadata и все прежние FAIL/evidence сохранены,
819entryprotected/97oldFigma inputs unchanged;source-map/экспорты старых этапов прежние.

Handoff:artifacts/frontend-v2/settings-privacy-redesign/final/handoff.md;
reports/source/actual/diff/manifest в mobile/R6. Только frontend/mock acceptance:
realstageconsent/export/prod NOTRUN;realZIPcontents/manifest/audit/retention/dataset
effects/nativeWebKitpinch/toolbarzoom/useracceptance UNVERIFIED. Ни API/generated/
backend/legal/deps/lockfile,ниpush/deploy/merge не менялись/не выполнялись.
Реализация общая для всех размеров; следующий шаг — пользовательская оценка frontend.

## Codex · Settings Privacy · R6 · 02.11.2026 · приёмка возобновлена

Пользователь явно разрешил повтор локальных check/Playwright после двух deadline
автоматической проверки разрешений. R5 checkpoint при входе:1691inputs/837git-visible,
SHA b0c46595d569e6c518368fba50b4036b30eeb4b5bc8a915654532a934c927eb2, drift[].
Branch/HEAD прежние. Новых source/test изменений после checkpoint нет.18addressed
heldGET/retry cases all3 browser PASS без повторов. Исходный workspaceconsentcase
повторяется отдельно. Далее fresh capture/native proof и новый immutable R6,
все обязательные gates → independent TEST → FUNCTIONAL → UI66. Текущий PASS всего
этапа ещё не заявлен; прежний R5 checkpoint и все FAIL/блокировки сохранены.
Права/API/guard predicate/команды не переписаны: R5 UI disabled использует тот же guard.
Реальные stageconsent/export и production не разрешены и не выполняются.

## Codex · Settings Privacy · R5 checkpoint · 02.11.2026 · НЕ ПРИНЯТО

US-M14-01/02/04/07: mobile реализован, финальная приёмка трёх размеров не завершена.
R4 strict CI:1355PASS1FLAKY40SKIP/exit1, все1654inputs/837git-visible guards чистые.
MOBILE-R4-QA-01: WebKit enabled confirm click совпал с фоновым GET; существующий
blocked guard молча запретил POST. Ведущий воспроизвёл heldGET (button incorrectly
enabled), переиспользовал ТОЧНО тот же predicate в handler и disabled. API/guards/
команды/cache не переписаны. Добавлены4E2E grant/revoke×390/1280; mobilefile42cases.
Первый after-target12PASS6FAIL только из-за нового exact badge expectation без✓;
исправлено на существующее«✓ Действует», rawFAIL/inputs сохранены, rerun ещё не прошёл.

R5 addressunit43PASS/3files,format/lint0,builddev/preprod/prod/audit0;
JS905560≤905600/CSS71967≤72000. Checkdefault иCI1:EMFILE наwatcher; polling check
не ослаблял rules, но завершилсяFAIL(stage-proxy listenEPERM/13notrun иParis timeout).
Дважды automatic permission approval review timed out до запуска локального
Playwright; разрешённый повтор использован. Default sandbox:listenEPERM4173.
Browser rerun/capture/TEST/FUNCTIONAL/UI66 BLOCKED/UNVERIFIED, PASS не заявлен.
Нужна guidance/explicit approval для повторного локального запуска после восстановления
проверки разрешений. Код/тесты/прошлыеFAIL/чужая Analyticsmetadata сохранены, locks свободны.
Checkpoint:mobile/R5/checkpoint-manifest.json; состояние и причины — final/handoff.md
иmobile/R5/execution-blocker.md. Реальные stageconsent/export/prod запрещены иNOTRUN.
Все старые desktop/tablet/mobile reports и источники остаются историческими evidence.

## Codex · Settings Privacy · final R4 · 02.11.2026 · подготовка

US-M14-01/02/04/07: mobile реализован, независимая приёмка продолжается.
R3 выполнил check1260unit/build3/audit0/fullstrict1356PASS40SKIP0retry и
rotation target12PASS, но immutable TEST/FUNCTIONAL BLOCKED: внешняя работа
Analytics в09:29:24UTC изменила SOURCES/STATUS/design-index и добавила evidence,
inventory837 вместо836. Код/tests/contracts/tooling и Privacy selection неизменны.
Полные guards/delta/timeline/старые и новые docs сохранены в mobile/R3/qa;
R3 не получил snapshot PASS, FUNCTIONAL/UI не принимались, QA освободил locks/4173.

Чужие Analytics изменения сохранены. R4 включает их в новый manifest; ведущий
повторяет capture/native proof и mandatory gates, затем TEST→FUNCTIONAL→UI66.
Прежние R1 resync FAIL и R2 rotation focus FAIL сохранены; адресные fixes и
регрессии входят в общий runtime. На R3 независимый rotation target12/12PASS,
но окончательное закрытие visibility finding требует FUNCTIONAL на новом R4.
Только нижняя Account ссылка #005BB5 имеет явное owner exception. Реальные
stage mutations/export, production, backend/API/generated/legal/deps/push/deploy/
merge не выполняются. Итоговый handoff: settings-privacy-redesign/final/handoff.md.
Inputs будут заморожены до явного release QA/UI; текущий финальный PASS не заявлен.

## Codex · Аналитика · desktop layout C · 02.11.2026

По поручению владельца новые content328:17122/328:17325 помещены в основной
desktop layout C: Обзор1606:7507(1440×1939), Риски и качество1606:7777(1440×2168).
Sidebar240 + content1200, активна Аналитика. Исходники, текущие tablet/mobile,
shared masters/styles/variables сохранены; fingerprint5/5 unchanged. Оба финальных
native PNG просмотрены; текст/геометрия контента равны источникам. PNG diagnostic:
2/11 отличающихся пикселей; точное pixel equality не утверждается.
Новые макеты подготовлены к согласованию; runtime TEST/FUNCTIONAL/browser UI
не запускались, общий UI UNVERIFIED. Branchfrontend/v2-implementation/
HEADc59bce88a64a596f3b3d2f0fb760105308cb193e и чужой dirty tree сохранены.
Manifest:artifacts/frontend-v2/analytics-desktop-layout-2026-11-02/manifest.json;
[evidence](evidence/analytics-desktop-layout-2026-11-02.md). US-M13-01–04 references,
без изменения правил. Следующий шаг: решение владельца по двум desktop frames.

## Codex · Settings Privacy · mobile · 02.11.2026 · интеграция третьего этапа

US-M14-01/02/04/07: mobile390 и итоговая приёмка всех66frames разрешены новым
поручением. Branchfrontend/v2-implementation/HEADc59bce88a64a596f3b3d2f0fb760105308cb193e
сохранены; entry835tracked/untracked архивированы в mobile/baseline. Сверка
tabletR4: только2 объявленных reportmetadata отличаются,1147inputs unchanged.
DesktopR7 differences полностью объяснены tabletR4+его объявленной metadata.
Чужие исходники/untracked/старые evidence/source-map/экспорты сохранены.

Прочитаны актуальные правила/обаhandoff, применён figma-design-to-code.
Новый read-only Figma sessiond10a6633-de6b-4e1e-9b9c-d3b05d04d31f,22 exact
mobilecontexts/nativePNG+4SVG/SHA в mobile/figma/source-map.json. Source22
изображения просмотрены ведущим; APItimeouts сохранены, retryуспешны.
Меню20/close28 byteequalexistingreuse,brand/cog existing28/20. Figma не правилась.

Runtime владеет ведущий: SettingsPrivacyPage reuseSettingsPageHead20/28mobile,
32/40wide, localtabs1000/1120/activecap320, cards16/20–28/legal1col; RadarShell
Privacy appbar64/mainx16/content358/hiddencontext/pb32; ConsentControls один
UiSheetDialog/model/command для всехразмеров, mobilefullscreen/headerbodyfooter,
equal173actions; ExportOrganizationCard fullwidthmobile/busystyle. Shared
UiSheetDialog только Privacyoptin/privateprivacyWide, defaultsAccess прежние.
API/model/guards/cachekeys/businesshandlers/legal/deps не менялись.

Предварительно capture77/77PASS:44desktop/tabletcanonical PNG byteequalR4,
13/14main naturalheightsexactmobile; revoke-saved18px ниже source из-за
dynamicactor «Вы» вместо длинногоFigmaимени, не layoutpadding. Unit40/4PASS,
typecheck0. P1CSSFAIL72094/72000 иP2JSFAIL905771/905600 сохранены сinputsarchives;
P3 корректно reuseexistingresponsiveclasses безновыхCSS/MQL:preprodJS905481,
CSS71967, budgets0/прежние. LintprivacyWide default warning найден/исправляется,
rawсохранён. Никакие бюджеты/assertions/baselines не ослаблялись.

Worker владеет только новым tests/e2e/settings-privacy-mobile.spec.ts(34cases).
MobileR1strict102scheduled:94PASS4FAIL4CDP-SKIP0flaky/8retries,exit1. Finding:
longtracealertoverflow×3engine, nativepinchChromiumscale2достигнут,ноclosefocus
заvisualedge. Rootправит Privacyoptin overflow-wrap/defaultprop, workerготовит
bounded nativekeyboard/pan diagnostic безruntimeправок; порт4173покаroot.
Остальные14main/6dialogs/short390×390/landscape/text200/reflow/touch/legalPASS
вэтом авторскомtarget, это не финальныйQA/PASS. Raw worker/R1 сохранён.

Владелец отдельно явно согласовал #005BB5 для нижней «Открыть аккаунт»
(mobile/owner-decision.md), исключение применяется к финальному66frame UI;
исторические R7/R4reports не переписываются. Прежний AnalyticsR4-QA-01OPEN
unknowncause/dating, новые cleanruns не waiver. Финальный snapshot/mandatory
check/build3/audit/fullstrictmatrix → independentTEST→FUNCTIONAL→UI66 ещё
предстоят. Нет доказательстваUNVERIFIED. Stageconsent/export/prod/backend/API/
generated/migrations/legal/Figma/deps/push/deploy/merge вне задачи. Итоговый
handoff будет settings-privacy-redesign/final/handoff.md, mobile не завершён.

Продолжение P4: Privacy-only overflow-wrap исправил longtrace, privacyWide:false
закрыл lintwarning. Buildpreprod/bundle/lint0:JS905526/CSS71967. Boundedpinchprobe
подтвердил: programmaticfocus не pan, нативныйShiftTab/Tabдаётцелыйring приscale2;
исходныйprobeFAIL сохранён. FreshworkerR2strict98PASS4CDP-SKIP0FAIL/flaky/retry,
8inputs guard unchanged;testfileownership/4173 переданы ведущему. Старыйtarget
179PASS2FAIL2SKIP:толькоустаревший mobilebusycloseexpectedcount0. Поsource
проверяется visible+disabled во всехразмерах,affected6/6PASS,бизнесassertions
сохранены. Финальныйcapture77+nativeproof/diff66/snapshotR1 готовятся, затем
всеmandatorygates/independentQA/UI66 заново, PASS пока не предполагается.

Формальный mobileR1:1570inputs/836git-visible,SHA
78f0bb2b64269b644e2abbd60e94d2cc05292284c17c17931a19d6ff96edb8d6.
TESTFAIL:check1258/build3/audit0,target16PASS2SKIP,fullstrict1343PASS1FLAKY40SKIP
(mobileconversationcursoroldercancelled,30stimeout/retry1PASS). Все243Privacy
cases first-attemptPASS6CDPSKIP. FUNCTIONALBLOCKED/UI NOT RUN. Это новый
MobileR1-QA-01,не historicalAnalytics. Bounded3PASSтолькоnonreproduction.
Before/after1570guardбезdrift,QA RELEASE inputs/4173. Raw/report/snapshotR1
не переписаны. Trace+sourceуказалиonResync tenantinvalidate defaultcanceltrue.

Дляобязательногогейта ведущий добавиладресныйshared frontendfix только
src/app/config/realtime.ts:cancelRefetch:false наresync,каксуществующийsafety
refresh; API/ключи/tenantfilter/businesscommands/модели не менялись. Новые2unit
cases(RECONNECTED/BUFFER_OVERFLOW)сheldnextpage воспроизвелиabort доfix(2FAIL),
послеfix14realtimetestsPASS:olderpageсохраняется,15ssafetyобновляетвсестраницы,
другойtenantнеперечитывается. Тесты tests/unit/app/realtime.test.ts;исходный
browsercaseне ослаблялся. ПодготовкаR2:отдельныеfreshcapture/diff66,новыйfreeze
иВСЕmandatorygates/TEST→FUNCTIONAL→UI66 заново. HistoricalAnalyticsOPENбезwaiver.

R2frozen1580/836SHAa7a62afa53ba0d4e43c139504fe1a2e90c48778752d22c6c17d716b31dce2142:
TESTPASS1344PASS40SKIP0failed/flaky/retry,check1260/build3/audit0. Новая
FUNCTIONALFAIL MOBILE-R2-QA-01/P2:portrait390844openGrant→667375stable→500+GET500
→Escapeфокусrecoveryприnormalzoom1,ноtargety563..609нижеviewport375вChromium/
WebKit. R1resyncfindingCLOSEDR2,AnalyticsOPEN. R2guard1580безdrift/releaseполный;
raw/probe/reportнеправились,UIBLOCKED. Ведущийдобавил4newmobilecases(grant/revoke
×Escape/Cancel)сfullviewport/ring/1mutation/Enterrecovery;before1FAILreproduced,
after12/12PASSall3. Shared dialog-return-focus.ts теперьпозволяетнативныйfocus
scrollвместоpreventScroll:true,прочаялогикавыбораtarget/guardsпрежняя. Newmobile
38cases. ПодготовкаR3сfresh66/полнымиgate/независимойприёмкойзаново;PASSещёнет.

## Codex · Settings Privacy · tablet · 02.11.2026 · R4 принят

Второй этап US-M14-01/02/04/07 завершён: TEST PASS → FUNCTIONAL PASS → UI PASS.
Tablet834 принят по всем22 approved Figma кадрам. Desktop22 — regression против
принятого новым поручением runtimeR7; mobile2 — working baseline regression,
мобильный redesign не принят и автоматически не запускался. Existing sharedfooter
005BB5 сохранён; исторический R7UI report не переименован задним числом.

R4 snapshot1149inputs/835git-visible, HEADc59bce88a64a596f3b3d2f0fb760105308cb193e,
branchfrontend/v2-implementation. ManifestSHA
b5d7076ea531534e26671729e7e17eb383f7f208db4c836368e16b9d7a810a75.
Entry833tracked/untracked архивированы;827 исходных inputs вне разрешённой
дельты unchanged,123 старых desktop source/capture unchanged. Source22nativePNG/
highfidelitycontexts+4SVG/SHA в tablet/figma; старые source-map/экспорты сохранены.

Runtime: SettingsPrivacyPage wide768/tablet typography/cards/legal/loading;
SettingsTabs local1120/46h/end334/keyboard/insetoutline/refguard; RadarShell
толькоPrivacytablet appbar72/mainx24width786/hiddencontext/menu20; UiSheetDialog
толькоPrivacywide equalfooter289/289 (адресный commonborderbasisfix с desktop
sameDOM regression). Defaults/Access/mobile/API/model/commands/guards/cache/ZIP/
roles/24h/legal/deps сохранены.18newtablet meaningful E2E cases +2точных ожидания
Privacytablet header; mobile114/visible и остальные assertions прежние.

Независимый QA: check1258unit/109files+architecture13, build:dev/pre-prod/prod,
audit:release exit0; targeted12/12PASS; полный CI strict --fail-on-flaky-tests:
1246PASS36SKIP0failed/flaky/retries,10.8min.52newtabletPASS2CDP-SKIP+93existing
PrivacyPASS. JS905547/905600,CSS71967/72000,initial230146/304800, budgets прежние.
Отдельный FUNCTIONAL Chromium/WebKit/8widthtransitions/shortfocus/axe0 PASS.
36SKIP (30stand/2CDP/4existingguards) не выдаются за проверенные сценарии.

Независимая hardreadonly visualrole реально просмотрела22tablet source/current,
6dialogviewport,22desktopbefore/after,2mobilebefore/after,17extras incl834×480
Cancelring. ВсеPASS в указанном scope; новыхfindings нет. R2-UI-01loading CLOSED:
857.6/643.2+прямая отсечка source1499:25594. Desktop14main byteequal/8overlay
onlyapprovedfooter289delta; mobile2 byteequal. Currentdialogcrop losslessly
изтого жеviewport,22/22 независимо verified; старыеsecondaryfullPNG архивированы.
UIseal52 SHA5811265455ce2d27cee7ce5265a35e9693c9efcaa2d33f5ffc72dd7c464fcbaa.

R1TESTFAIL staleheader, R2TEST/FUNCTIONALPASS+UItabletFAIL loading, R3TESTFAIL
detachedtestmeasurement11PASS1FLAKY сохранены. R4singleMQL+atomicDOMreadiness
закрывает R3-QA-01; R1-QA-01 остаётся CLOSED. Historical AnalyticsR4-QA-01 OPEN
unknowncause/dating: current first-attemptPASS только non-reproduction, не waiver.

Guards before/after TEST/FUNCTIONAL/UI1149+seal52 exit0/drift[]; source inputs
во время приёмки не менялись. Роли RELEASE inputs,4173free; ведущий владеет
реализацией/тестами. После review только STATUS+tablet/handoff reportmetadata,
дельта2inputs/остальные1147unchanged в R4/post-review-metadata.json. Ни commits,
ни push/deploy/merge не выполнялись.

Evidence artifacts/frontend-v2/settings-privacy-redesign/tablet/handoff.md,
R4/manifest.json,qa/report.md,ui/report.md,ui/comparison-index.json,
mobile-handoff.md. Native toolbarzoom/serveraudit/retention/realZIPcontents/
dataset effects/realintegration UNVERIFIED;417CSSDSF2 equivalentreflow и mock
учтены отдельно. Реальныеstagewrites/downloads запрещены/NOTRUN;production/
Figma/backend/API/generated/migrations/legal/deps не затрагивались.
Следующий шаг — отдельное поручение на mobile, без автоматического перехода.

## Codex · Settings Privacy · desktop · 02.11.2026 · R7 проверен, footer decision pending

US-M14-01/02/04/07: реализованы desktop1440 и общая логика /settings/privacy.
Три карточки+Account,14mainstates/6dialogs/2hosts, реальный ZIP Blob,
права/DATASETS/tenant/user/logoutguards, Retry-After,24h organizationtimezone.
Основные файлы: SettingsPrivacyPage,ConsentControls,ExportOrganizationCard;
shared opt-in primitives, context/mediaquery/date-time и meaningful unit/E2E.
Ведущий владеет runtime/shared/tests/STATUS; worker передал4testfiles.

R7 snapshot993inputs/833git-visible, HEADc59bce88a64a596f3b3d2f0fb760105308cb193e,
manifestSHA1be46d5203aa10a23fb49ab38c5e7ce59fb7aa9aa3315c6a51aaf1dd548a5f29.
Независимые TEST PASS / FUNCTIONAL PASS (frontend/mock): check1258unit109files,
architecture13; build:dev/pre-prod/prod,audit:release exit0; stockCI1194PASS,
34SKIP/0failed/flaky/retry,93PrivacyfirstattemptPASS;11дополнительныхaxeсостоянийPASS.
CSS71967/72000,JS904416/905600,initial230088/304800. Assertions/coverage/budgets/
browserconfig не ослаблялись. Sandbox EMFILE/listenEPERM raw сохранены,
эскалированные локальные повторы exit0. Stage mutations/downloads NOT RUN.

UI реально просмотрел22Figma/browserpairs+4compactbefore/after:
desktop UNVERIFIED только R6-UI-05/P3 footercolor — source0071E3contrast4.31,
actual005BB5contrast6.10. Выбор владельца запрошен, ответа/waiver пока нет.
R6-UI-01–04 CLOSED: cooldownbutton/overlay24%/revokeparagraph/loaderrorwidth.
Tablet regression PASS / mobile regression PASS; их Figma redesign вне поручения.
R4focus/R5lintfindings CLOSED. Исторический R4-QA-01/P2 Analyticsflaky OPEN:
причина/давность UNVERIFIED, R6/R7 не воспроизвели; raw не стирались.

До/после QA/UI все993inputs и7reviewinputs безdrift. После release изменены
только этотблокSTATUS и handoff.md; точный post-review-metadata.json хранит
старые/новыеhashes и проверку всех остальных991inputs. Snapshotarchive неизменен.
Protected25 byte-equal baseline, исходный STATUSsuffix сохранён. У отдельных
исторических ignoredgeneratedPNG до R1 сохранность UNVERIFIED; inventories/raw
сохранены, дальнейшие outputs изолированы. Доступ/backend/API/generated/legal/
Figma/production не менялись. Реальные audit/retention/ZIPcontents и nativezoom
UNVERIFIED;720CSS/DSF2 — equivalentreflow. Push/deploy/merge не выполнялись.

Evidence: artifacts/frontend-v2/settings-privacy-redesign/desktop/handoff.md,
R7/qa/report.md,R7/ui/report.md,figma/source-map.json,tablet-handoff.md.
Следующий шаг: решение владельца по footer и окончательный desktop UI verdict.
Затем — отдельное поручение на tablet, автоматически этап не запускать.

## Codex · Онбординг · CI fixture timezone fix · 02.11.2026

По поручению владельца исправлено падение company-page.test.ts в CI41365010251
на stage d5abbd9. Причина: runner UTC отправлял UTC, mockPOST отвечал Moscow;
после201+authme503 повтор корректно отправлял PATCH из-за разницы пояса.
Source repro UTC exit1 подтвердил POST,PATCH. Fixture явно выбирает Moscow,
старый fetchcount1 сохранён, добавлены exactPOSTmethod/body. Runtime/дизайн/CSS
не менялись. US-M02-01,N2/N5/N7, все454trackedsrc byte-equalHEADd5abbd9.

CI-fix-R1:820inputs,manifestSHA
d48fe0865e84ccab0997f95831f51a3c05cd08c593d1bb1e1090c009ed034362.
Независимые scoped TEST PASS / FUNCTIONAL PASS:18unit×UTC/Moscow/Yekaterinburg
=54PASS,адресныеPrettier/ESLint/typecheck exit0,guard820/820безdrift.
Полныеsuites/build/UI/stageнеперезапускались;UI-L01/02OPENсохранены.
Исправлениеподготовленокpushstage;штатныйCI/autodeployнеизменны.
Evidence: `artifacts/frontend-v2/onboarding-existing-api-2026-11-02/CI-fix-R1/`,
qa/report.md,логиисходногоCI/UTCFAIL,snapshot/relevant.diff,публикацияотдельно.
[Отчёт](evidence/onboarding-existing-api-2026-11-02.md).

## Codex · Возврат в онбординге без изменения дизайна/API · 02.11.2026 · R2 проверен

US-M02-01/02/03/04: реализованы редактор той же компании при возврате,
поэтапное сохранение, черновики полей/графика в памяти открытого мастера,
история 1→2→3 и явное создание другого пространства по существующей ссылке.
Дизайн/CSS/Figma/backend/API/production не менялись; удаление остаётся Hotfix09.11.
Владелец runtime/tests/shared schema — ведущая сессия Codex, QA только outputs.

R2 frozen:820inputs, HEAD e7940037e6a15ff6a4e7e2e07b99b981a234e442,
manifestSHA df39a657368735c5d81c1446b947c002236ca76228b6cd4acece26b0bf258d11.
`artifacts/frontend-v2/onboarding-existing-api-2026-11-02/R2/`: archive/diff/inputs,
qa/report.md/commands/logs,comparisons.json,location-matrix.json,ui/report.md.
Независимые TEST PASS / FUNCTIONAL PASS frontend/mock N1–N7: адресные133unit,
check1225unit/107files+architecture13, builds×3/audit exit0,
stock1101PASS+34standSKIP/0FAIL/retry/flaky;33/33новых onboarding browsercases.
JS905395/905600,CSS71967/72000,initial237804/304800, пороги прежние.
Сверки до/после TEST/FUNCTIONAL/UI:820/820безdrift; после — только mainreport/STATUS.
Обычные команды с sandbox override после доказанных EMFILE/listenEPERM;
конфигурация/assertions/coverage/baselines ради PASS не менялись.

R1 TEST PASS / FUNCTIONAL FAIL сохранён, UI не запускался. QA-R1-01/P1
(same-tenant user change) и QA-R1-02/P1 (201→refresh503→reload) CLOSED наR2.
RouterView ключуется userID;4regression проверяют A→B→A/latePOST/PATCH.
Подтверждённый201 сохраняет companyID до authme;9browserrecoverycases проверяют
consumed/open/multiple membership,1POST и точныйtenantPATCH. ЧужойrecoveryID
не вызываетorganizationwrites/reads; правки перед retry не теряются.
Для бюджета дедуплицированы поля/схемы двух форм и подписи валют с прежними
контролами/порядком/атрибутами/валидацией. Settings company/services regressions PASS.

НезависимыйUI реально просмотрел93PNG с SHAguard. Normal/edit company/location/
services+перваяCompanySettings: desktop/tablet/mobile PASS approved-pattern.
Дополнительнаяlocationmatrix enabled/disabled/saving/retry: desktop/tablet PASS,
mobile FAIL. UI-L01/P2 OPEN — busyформа390бледнееapproved, opacityпредсуществуетHEAD
(template byte-equal). UI-L02/P2 OPEN — initialviewport390 перекрывает строку
ошибкиfixedCTA; послеscroll ошибкацеликомвидна, причина/давностьнеустановлены.
Полный UI всех loading/focus/overlayM02/M03 UNVERIFIED, общего полногоPASSнет.
Дизайн радиfindingsнеправился. Следующийшагпередпоставкой — отдельноразобрать
UI-L01/02 и применимыенепроверенныесостояния. Stage/production/реальныеканалы
непроверялись/неменялись наэтапелокальнойприёмки,preview4173свободен.
Следующимпоручением02.11 владелецразрешилcommit/pushstageбезповторныхтестов;
результатпубликации — R2/stage-release/, штатныеCI/autodeployнеизменны.
[Полный отчёт](evidence/onboarding-existing-api-2026-11-02.md).

## Hotfix · Удаление в онбординге · План на 09.11.2026

По поручению владельца 02.11.2026 сценарий удаления точек и услуг включён
в Hotfix на 9 ноября. В Plane создан модуль Hotfix (02–09.11, Запланировано),
[LIDRADAR-27](https://plane.lid-radar.online/lid-radar/browse/LIDRADAR-27/)
добавлена в него со сроком 09.11 и статусом New. US-M02-02/03/04, регрессии
M02-01/M03. При удалении точки с услугами сначала предупреждение; подтверждение
переводит связанные услуги на «Все точки», отмена сохраняет привязки.
Поэтапное сохранение одной компании сохраняется. [План и критерии](RELEASE-PLAN-2026-11-09.md).
Карточка повторно открыта, модуль/срок/описание подтверждены; evidence —
`artifacts/frontend-v2/hotfix-2026-11-09/lidradar-27.jpg`.
Следующий этап — макеты и согласование; реализация не начата, канонические US,
runtime/API/Figma/stage/production прежние. TEST/FUNCTIONAL/UI NOT RUN.

## Figma · Аккаунт · Компактная раскладка · 02.11.2026

Следующим поручением владельца секция `1574:24806` уплотнена до3368×32594
вместо19480×34920: площадь меньше на83.9%. Три колонки Desktop/Tablet/Mobile,
17 одинаково пронумерованных состояний, верхние края макетов17/17 выровнены.
Все49 исходных макетов: IDs/размеры/внутренние слои и reactions по контрольному
hash сохранены49/49. Исходные семь секций и их ссылки сохранены; изменены
canvas-позиции, размеры контейнеров и служебные подписи. Добавлены34TEXT.
Снимок `account-compact-2026-11-02-final`, artifacts в
`account-consolidation-2026-11-02/compact/`: baseline/plan/scripts/validation,
final.json, composition.png. Ведущий просмотрел изображение всех трёх колонок;
пересечений/выхода за границы нет. Это canvas review; TEST/FUNCTIONAL/browser UI
NOT RUN, US/runtime/API/stage/production прежние. [Отчёт](evidence/account-consolidation-2026-11-02.md).

## Figma · Аккаунт · Единая секция · 02.11.2026

По поручению владельца семь оставшихся блоков Аккаунта объединены в одну
секцию `1574:24806` на странице Настроек. Слева пять desktop-групп, справа
tablet и mobile. Исходные семь SECTION IDs и 3288 вложенных узлов сохранены;
контрольные hashes содержимого 7/7 совпали, размеры/child IDs прежние.
Пересечений между группами и с другими секциями нет; соседние секции прежние.
Итоговая общая компоновка реально просмотрена inline; содержимое экранов не
редактировалось. US/runtime/API/тесты/stage/production не менялись.
TEST/FUNCTIONAL/browser UI NOT RUN: задача только на организацию canvas.
[Отчёт](evidence/account-consolidation-2026-11-02.md), снимок и скрипт —
`artifacts/frontend-v2/account-consolidation-2026-11-02/`. Следующий шаг —
просмотр владельцем общей секции; реализации это поручение не запускает.

## Codex · Account link #005BB5 · 02.11.2026 · C3 принят в header scope

N-ACCOUNT-LINK-COLOR-01/P2 реализован: текстовые Account-ссылки всегда text-link
(#005BB5,rgb0/91/181),два route-dependent цвета RadarShell удалены. Геометрия,
типографика,href,brand/avatar/buttons прежние. Ordinary axe без исключений;
подготовленный waiver C1 не принят/не опубликован и сохранён как SUPERSEDED.
Исторические QA-S8-01/S10/RC8 raw FAIL не переписаны.

C3 frozen:/private/tmp/lidradar-account-link-color-c3,979inputs,manifest SHA
4a5ae2396a1446cdd3b9e05deb23e9ce61b952dec2b0590c19a6f6101a749411.
TEST PASS / FUNCTIONAL PASS AC1–6; UI хедеров desktop/tablet/mobile PASS.
C3 check1213/106+architecture13 и preprod exit0. Verified reuse C1:
builds dev/prod/audit exit0; stock1102=1068PASS+34expectedSKIP,0fail/retry/flaky;
135новыхAccountcases и12прежнихaxeFAILcases теперьPASS безwaiver.
C3/C1captures/C1poststock142/142bundlefiles byte-equal,976unchangedinputs;
C3 единственныйtestdelta—6awaitvi.dynamicImportSettled вexistingintegrationunit
(8/8boundedprobe,assertions/timeoutsнезаменены). C1rawcheck1210/3FAIL сохранён;
C2preparation_NOT_ACCEPTED,непроверенныйsnapshot сохранён.

Figma359/359localTEXTfillbindingscolor/link;geometry/fonts359/359,pagefingerprints5/5,
Access/flows8/8 иvariables8/8 стабильны. Новые25nativePNG+25crops,source-map и
accountLinkColorCorrection вindex. Capture27/27PASS,117PNG/145files. UI27pairs
(11viewed+16strictbothSHAreusewithinC3)+54extras+3nativefull+reference просмотрены.
Input/capture/stockSHAguards0drift. Послеприёмки—толькоmainreport/STATUS/indexstatus.

[Отчёт](evidence/account-link-color-2026-11-02.md),artifacts account-link-color/C3/:
qa/test-report.md,ui/report.md,comparisons/index.json. P3UI-RC8-01 остаётся OPEN;
Privacy body/старый overlay внеheader-onlyscope. StageRC8/backend/API/production
не менялись;push/deploy/merge не выполнялись. Порт4173 освобождён,чужой4174сохранён.

## US-M04 · Реализация отменена, сначала план · 01.11.2026

Владелец отменил текущую frontend-реализацию и установил порядок: сначала
согласование плана задач, затем отдельное поручение писать код. Основной чат
подтвердил остановку; локальный preview4175 остановлен. Изменения реализации
в16 tracked-файлах восстановлены до HEAD26c111ee,17 новых runtime/test/tooling
файлов убраны из активного дерева. Все33 файла и patch сохранены в
`artifacts/frontend-v2/integrations-implementation/cancelled-2026-11-01/`.
Согласованные Figma R1+R2, истории и backend-документация сохранены;
чужие правки настроек/конфигурации не откатывались. API, backend-код и production
не затронуты; frontend восстановлен до начала отменённой реализации.
Прогоны отменённого снимка не означают приёмку восстановленного frontend.
[План задач](tasks/INTEGRATIONS-IMPLEMENTATION-PLAN.md) имеет статус проекта,
реализация запрещена до отдельного поручения. До её запуска согласовать
границы недостающего username в API и восстановления частичного отключения.
Проверка отката: побайтное сравнение16 файлов, отсутствие17 новых файлов,
сохранностьAPI/generated/lockfile, `git diff --check` — exit0.

## Codex · Настройки S10 · Stage RC8 опубликован · 01.11.2026

По поручению владельца S10 закоммичен и выложен только на stage. Код —
`5d026577`, docs-only format fix — `26c111ee`, annotated tag —
`release/2026-11-01-rc8`, stage version — `ed577f84e992-w26c111ee`.
Atomic push обычный; старые RC tags сохранены. Production не затронут.

CI41344194979 raw FAIL: 921 PASS / 12 contrast FAIL / 34 SKIP / 0 flaky;
все36 failed attempts — QA-S8-01. Quality1213unit/106files + architecture13,
Python10, builds×3, audit и container PASS. Auto deploy SKIPPED; ручной
stage-only helper по принятому владельцем исключению завершился exit0 с
backup/health/disk guards. CI/tests/environment policies не менялись.

Post verifier:11 checks PASS;141/141 CI prod assets равны web container.
Backend `ed577f84e992`, API `9f9766cc4d23`, миграция000032/checksum прежние;
7services healthy, backup создан. Runtime/tests/tooling соответствуют S10.
Live read-only QA: exit0,45checks/15route visits/22PNG, errors0/business
mutations0,logout204. Новые role changes/Telegram issue/persistence/delivery
не проверялись. Общий email reminder сохранён; native «Скрыть» позволяет
проверить canonical desktop header y32 (с banner89px исходно y121).

S10 FUNCTIONAL/UI frontend/mock PASS; raw TEST FAIL сохранён. Дополнительный
post-deploy UI: desktop PASS, tablet PASS, mobile FAIL. Подтверждён новый
UI-RC8-01/P3: при Tab/type на390×390 поле видно целиком, но нижние4px focus
outline clipped; на390×844 тот же ввод PASS. Follow-up exit1,12новых PNG;
исходные40QAfiles/22PNG и runtime/tests сохранены. Это открытое замечание,
не принятое исключение QA-S8-01. Stage сохраняет порученный S10/RC8;
точечный fix потребует отдельного snapshot/проверок/mobile review.
[Отчёт](evidence/stage-release/Codex-R1/settings-s10-rc7.md), artifacts:
`settings-notifications-team/Codex-R1/stage-rc7/` (историческое имя RC7).
Чужие Integrations/Codex изменения сохранены и в stage не попали.

## US-M04 · Backend-документация синхронизирована · 01.11.2026

По явному поручению владельца обновлены только13-channels.md и одна строка
J1/шаг4 в30-journeys.md backend-документации: US-M04-01/02/04/05 соответствуют
согласованным R1+R2 и Figma-историям. Live Figma6/6 совпало с принятым снимком.
US-M04-03/06 побайтно прежние;20 старых AC сохранены,21 новый, всего41
REQUIRED_NOT_VERIFIED. Документ отделяет UI-подписи от машинного контракта.
Backend HEAD e7f8767 прежний, diff только2Markdown, новых backend files нет.
API/код/миграции/generated/тесты не менялись. DOC CHECK PASS: Python и diff-check
exit0; TEST/FUNCTIONAL/UI/stage NOT RUN, production не затронут.
[Состав и evidence](../proposals/us-m04-integrations-story-update-2026-11-01.md),
снимок `artifacts/frontend-v2/integrations-backend-stories-2026-11-01/`.
Manifest SHAc3443dc8e94f; итоговый канон SHAab44a972bdf8.
Следующий этап — границы реализации; запрет изменений backend/API сохраняется.

## Figma · Интеграции согласованы, истории обновлены · 01.11.2026

Владелец явно утвердил текущие макеты R1+R2, все3 адаптива, включая значок
CheckError. В User Stories & Flows/M04 `689:3926` обновлены US-M04-01/02/04/05:
обычный Telegram/Secretary Mode, Empty с логотипом, актуальные бейджи,
баннеры ошибок над действиями, отдельные remote/local результаты и отключение.
Основной текст US-M04-03/06 побайтно сохранён; в6 карточках обновлены согласование,
примечания и ссылки. Два превью актуализированы, связанные подписи J1/Gaps исправлены.
Критерии REQUIRED_NOT_VERIFIED; продуктовый PASS не присвоен.
Структура/контент PASS,4 полных истории и итоговый обзор реально просмотрены.
Утверждённые UI области неизменны:4019/FNV40a13548 и845/FNVfd8665b9.
Evidence/manifest — `artifacts/frontend-v2/integrations-story-update-2026-11-01/`;
SHA4a1eb8b64ab1,27 файлов;15 Figma destinations/JSON/SHA checks PASS, diff-check exit0.
[отчёт и ссылки](evidence/integrations-stories-2026-11-01.md).
Runtime/API/backend Markdown не менялись; TEST/FUNCTIONAL/browser UI/stage NOT RUN.
Следующий этап — синхронизация канона/границы реализации по дальнейшему поручению.

## Figma · Интеграции · 01.11.2026 · правки готовы к просмотру

R2/US-M04-04: по замечанию владельца возвращён восклицательный знак20×20
слева от текста CheckError во всех3 адаптивах404:4301/4405/4510. Размеры
карточек и раскладка кнопок прежние; SourceError тексты/размеры сохранены.
Структура и реально просмотренные3PNG PASS; evidence — `icon-fix-r2/`
в каталоге ниже. Исходный снимок R1 сохранён. Runtime/product QA не запускались.

`N-INTEGRATIONS-DESIGN-01`, US-M04-01/02/04/05: выполнены6 замечаний владельца.
30 Source masters используют цельные бейджи по Уведомлениям; FirstError —
иконка рядом с текстом, CheckError/SourceError — баннер над действиями.
Desktop/tablet CheckError:3 кнопки в одной строке. Telegram без Business;
Empty-кнопка с векторным логотипом во всех3 адаптивах. Исправлены размеры
4 длинных страниц и пересечения в UI Kit; root IDs сохранены.
Структура PASS:41 бейдж/38 именованных panels/36 основных frames, Inter,
Business0, без clipping нижнего края. Ведущий просмотрел21 итоговый PNG:
15 карточек,3 полных страницы и3 дополнительных статуса; scoped Figma visual
desktop/tablet/mobile PASS. Это не независимый browser UI/product verdict.
Доступ7292 узла/FNVfb95b7a0 до/после неизменен. Первоначальные failed audit,
PNG и screenshot timeout сохранены; точная проверка radius/full9999+binding PASS.
Manifest/scripts/SHA/PNG: `artifacts/frontend-v2/integrations-design-2026-11-01/`.
Индекс снимка SHAf3e6c3c93e5a,50 файлов/21 итоговый PNG; JSON и diff-check exit0.
[Отчёт и ссылки](evidence/integrations-design-2026-11-01.md).
Runtime/US/API/тесты не менялись; TEST/FUNCTIONAL/browser UI/stage NOT RUN,
production не затронут. Следующий шаг — просмотр владельцем; approval pending.

## Figma · Desktop-хедеры настроек · 01.11.2026 · исправлено

`N-SHELL-HEADER-01`: по поручению владельца все48 desktop-хедеров Уведомлений,
Команды и Данных (12/20/16) приведены к `1307:13352`: ссылка «Аккаунт» —
`hig/accent`/`#0071E3`, верхний отступ32px через `spacing/32` вместо24.
Auto layout сохранён; контент сдвинут вниз8px, основные полные экраны имеют
высоту1238/1504/1222. Структурные проверки48/48, сохранность содержимого,
ширин и числа узлов7275/13147/5282 PASS;26 контрольных ветвей tablet/mobile,
локальных компонентов и материалов совпали по hash, эталон прежний.
Исходный хедер и три итоговых полных PNG реально просмотрены. Исторические
approval snapshots не переписывались; добавлен `desktopHeaderCorrection`.
[Отчёт](evidence/settings-desktop-header-2026-11-01.md), manifest/PNG/scripts —
`artifacts/frontend-v2/settings-polish/figma-2026-10-31/desktop-header-fix-2026-11-01/`.
Runtime/тесты/stage/production не менялись; TEST/FUNCTIONAL/browser UI/Present
NOT RUN. Следующий runtime/UI QA — по обновлённому source snapshot.

## Codex · 24h-only RC6 · 01.11.2026 · опубликован и принят на stage

US-M02-05/06, регрессия US-M02-02/04 и часы M10 preferences: только ЧЧ:ММ
во всех адаптивах. UI-RC5-01 закрыт по уточнённому контракту владельца;
прежняя классификация только как обрезки AM/PM была ошибочной. Данные API
уже были HH:mm, конвертация/миграция не требовалась.

На stage опубликован точный принятый S3
`1df33d785fe8400b5c7eb873aa5b9668c29a7f2f`, annotated
`release/2026-11-01-rc6`, версия `ed577f84e992-w1df33d78`.
GitHub run41323229349 SUCCESS, все 8 jobs с первой попытки:
1189 unit / 104 файла, 13 architecture cases, 10 deploy guards,
три build/audit; E2E 819 PASS + 34 ожидаемых skip, 0 failed/flaky.
Независимые TEST PASS → FUNCTIONAL PASS → UI desktop/tablet/mobile PASS.
Локальный reviewer реально просмотрел 137 PNG; финальный stage reviewer —
все 12 PNG часов, обе локали/три адаптива, findings нет.

Real stage smoke exit0: 109 PASS, 66 route visits (11 маршрутов × ru-RU/en-US
× три адаптива), ошибок API/JS и попыток бизнес-записей 0, logout204.
График 09:00–21:00, сводка 09:00, тихие часы 22:00–08:00 читаемы без AM/PM.
«Не сохранено» остаётся одной строкой. Draft восстановлены без Save.
Все 11 server checks PASS; backend ed577f84e992, API SHA9f9766cc4d23,
applied/latest migration000032 и checksum неизменны. Production/main не тронуты.

Evidence `artifacts/frontend-v2/company-time-24h/Codex-R1/S3/`: русский
handoff.md, qa/, ui/, stage/ci-final.*, server-after.json, live/report.json,
stage/ui/. Финальный final-audit.json: source780, execution2, UI437,
live evidence29 — drift0. Remote stage и peeled RC6 tag подтверждены на1df33d7.
S1/S2 failures и исходные capture records сохранены. Чужая параллельная
Notifications/Team реализация основной копии сохранена и в RC6 не включена.

Ограничения: real persistence/delivery и физическая клавиатура не проверялись;
точные PUT/валидация проверены на mock. UI stage — формат часов, не новая
полная Figma-приёмка M10/Team. Следующий шаг — просмотр готового stage владельцем.
Этот STATUS/handoff — локальный итог после deploy, docs-only push не запускался.

## Codex · 24h-only RC6 · 01.11.2026 · stage CI

Time24 S3 принят: независимые TEST PASS, FUNCTIONAL PASS и UI desktop/tablet/
mobile PASS. Commit `1df33d785fe8400b5c7eb873aa5b9668c29a7f2f` отправлен exactSHA
в stage с annotated `release/2026-11-01-rc6`; GitHub run41323229349 выполняется.
Production исключён. Время хранится как раньше HH:mm, интерфейс фиксирован
text/numeric без native AM/PM в графике, отдельном wizard и UiInput time
сводки/тихих часов. size5 устранил intrinsic overflow640.

QA S3: check1189unit/104files+13architecture,build×3/auditPASS;
strict853cases=819PASS+34expectedskip,failed/flaky/retry0. Company73capturePASS,
173PNG и54time-formatPNG. UI reviewer реально просмотрел137images:54новых,
63exactFigma/browser pairs и20responsive; all3PASS, AM/PM/обрезок нет.
Source780 +execution2 +UI437files послеreview0drift; rawrecords не переписаны.
Исходные S1/S2 failures сохранены; QA-T24-01/02 закрыты новымS3.

Evidence `artifacts/frontend-v2/company-time-24h/Codex-R1/S3/`: manifest,
qa/,company-browser/,comparisons/,ui/,post-review-audit иstage/CI.
Серверный preflight11checksPASS: покаRC5, backended577/API/migration неизменны.
Следующий шаг: завершение CI/autodeploy и real read-only stage24h smoke обеих
локалей/всех трёх размеров. Не смешивать candidate с текущей чужой main
Notifications/Team реализацией; её файлы сохранены и не входят вRC6.

## Codex · 24h-only time · 01.11.2026 · S3 на проверке

Кандидат `1df33d785fe8400b5c7eb873aa5b9668c29a7f2f`,780source inputs,
manifest `f004ea7997b3c24ea430591fe77c93cc7af0523ea6b69c0356e226c18d92a170`.
S1 lint finding закрыт; S2 check/build×3/audit PASS, но найдена регрессия
intrinsic width текстовых полей онбординга на640px (696>641). S2 остановлен
после690PASS,1FAIL; история/три failure attempts сохранены.
S3 задаёт size5 для четырёх raw clock fields, CSS/validators/API прежние.
Адресный closure S3 PASS12/12: шесть responsive график ширин, включая640zoom200,
и шесть ru/en×adaptive24h сценариев; focus/axe/noPageScroll сохранены.

Полный QA идёт в immutable `/private/tmp/lidradar-time24h-s3-1df33d7`.
Чужой main-preview4173 не трогаем; root предоставил execution wrappers4174
в S3/execution-4174,2SHA дополнительно к780inputs. Это только port/baseURL,
абсолютные пути тех же testDir/cwd и generated outputs. Original/override
case union853, проекты/retries/selectors и workers2 идентичны. Source config
не менялся; первый port-blocked attempt сохранён. После TEST/FUNCTIONAL нужны
54новых time-format PNG и73Company captures для независимого UI всех адаптивов.

В main параллельно идёт Notifications/Team runtime +Figma/Codex/docs работа;
она сохранена и исключена из narrow hotfix. Не запускать main build как
доказательство этого candidate и не коммитить чужие изменения. Stage покаRC5;
следующий шаг — закончить S3 QA/UI, затем опубликовать точный принятый SHA
и выполнить read-only stage24h smoke. Production/backend/API не менялись.

## Codex · N-SNT-REDESIGN-01 · 01.11.2026 · S10 принят с contrast exception

Завершены NotificationsR47/TeamR54:US-M10-01…07,US-M11-01/04…08,
N-SN/N-ST-ADAPTIVE-01 иdesktopheader N-SHELL-HEADER-01 (включаяPrivacyheader).
**FUNCTIONAL PASS (frontend/mock); UI desktop/tablet/mobile PASS. Raw TEST FAIL**
сохранён только по явно принятому QA-S8-01: account#0071E3 на#F5F5F7,4.31<4.5.
Белаяподложка не применена,тесты/пороги не ослаблены. Решение владельца:
`evidence/settings-notifications-team/accepted-contrast-exception-2026-11-01.md`.

Принят immutable S10 `/private/tmp/lidradar-notifications-team-s10`,HEAD1df33d7,
1096inputs,manifestSHA
`aa3ae00a23f8b8acaa9e5758000c729abebacb074ae63a23140ce66b2486520e`.
Check1213/106+arch13,builddev/preprod/prod,auditrelease exit0;
JS903380/905600,CSS71967/72000,largest103901/110100,initial237710/304800.
FullstockCI exit1:967cases=921PASS+12acceptedcontrastFAIL+34expectedSKIP,
36failedattempts/24retries/flaky0,8.6min. ScopedNotif42/Team30/Header36/timeformat18
PASS. Все12FAILоднойпричины;34skips=30stand+4browser-specific,неcoveragePASS.

S8UI5групп исправлены только вruntime: общие validation summaries/disabledInvite,
Telegramdestructivecolor,busycontrols/cancel,mobileRetrywidth. ExactSVG16×16
readonlyexport,Notificationsopacity0.45/Team0.65;nativeinputsdisabledсохранены.
QA-S9-01lowheight13px закрыт S10:scroll только приsubmit,5строгихkeyboardPASS;
ещё15focusedPASS. ПервичныеdiagnostictimingFAILсохранены/разобраны,criteriaнеослаблены.
Все172guardedtests/tooling/contracts/scripts SHA unchanged сS8;макет не менялся.

Capture255/255PASS,774files сохранены;142/142preprod/capture/postCIbundle equal.
ПослеQA/UI1096inputs неизменны,mainruntime/tests/tooling/contracts/scripts равныS10.
UI274items+5contexts:50новыхexactpairsпросмотрены,178reuseпоstrictnative+actualSHA
из полного личного S8просмотра;18header+9responsive+18Team+1functionalпросмотрены.
Все3адаптиваPASS,новыхin-scopefindingsнет. Teamloading1pxnonblocker;
PrivacyR57oldoverlay/tabletсохраненывнеscopeполногоbody/dialogredesign.

Отчёты: `evidence/settings-notifications-team/implementation-2026-11-01.md`,
`artifacts/frontend-v2/settings-notifications-team/Codex-R1/S10/qa/test-report.md`,
`S10/ui/report.md` и `S10/ui/review-progress.json`. S1…S9evidence/dirty/untracked/
чужиеCodex/designdocs сохранены. FUNCTIONAL/UI — независимые Sol/high иTerra/high
с explicitownerexception;hardpresetconfigsне менялись. Production/Figma/backend/
API/generated/roles/lifecycle/money/deps/lockне менялись,push/deploy/mergeнет.
4173свободен,чужой4174нетронут. Live stage/persistence/реальнаяdeliveryUNVERIFIED.
Согласованныйfrontend/mockобъём завершён;дальнейшаяlive/releaseприёмкаотдельно.

## Codex · 24h-only time · 01.11.2026 · S2 на проверке

Владелец уточнил: AM/PM недопустимы во всём интерфейсе. Прежняя классификация
UI-RC5-01 только как P3 обрезки была неверной: требуется фиксированное ЧЧ:ММ,
независимое от нативного browser/OS locale. Данные API уже были 24-часовыми.
Root заменил native time controls на text/numeric в графике настроек, отдельном
BusinessHoursFields онбординга и логическом UiInput type=time (digest/quiet).
Shared helper добавляет двоеточие при вводе3–4цифр и сохраняет курсор;
диапазоны/AMPM не конвертируются, существующие validators и PUT прежние.

42адресных unit PASS, Chromium6/6 (ru-RU/en-US ×desktop/tablet/mobile),
проверены точные HH:mm PUT. Candidate commits6e7b340 и4fcc936; S1 TEST FAIL
по QA-T24-01 (порядок атрибутов Vue), source/logs сохранены;42unit/build×3/audit
S1 PASS. Линтер исправлен в S2, адресный ESLint0. Runtime snapshot S2 immutable
в `/private/tmp/lidradar-time24h-s2-4fcc936`,780Git inputs; все финальные gates,
полная browser matrix и capture переданы независимому time24_qa.
Новый UI-review всех трёх адаптивов нужен после TEST/FUNCTIONAL PASS.

Evidence: `artifacts/frontend-v2/company-time-24h/Codex-R1/` с initial archive,
S1/S2 manifests, diff, briefs и логами. Чужие Figma/Codex docs и STATUS сохранены
в main, в точечные commits не включены. На stage пока остаётся RC5 `087970b`;
новый кандидат ещё не push/deploy. Production/backend/API/миграции не менялись.
Следующий шаг: S2 TEST→FUNCTIONAL→UI, затем RC6 stage и живой24h smoke.

## Codex · N-SNT-REDESIGN-01 · 01.11.2026 · ТЗ подготовлено

По поручению владельца подготовлена задача на реализацию редизайнов двух
вкладок настроек: «Уведомления» R47 и «Команда и доступ» R54, все три адаптива.
ТЗ: `tasks/SETTINGS-NOTIFICATIONS-TEAM-REDESIGN-CODEX.md`; пакеты
`N-SN-ADAPTIVE-01` / `N-ST-ADAPTIVE-01`. Указаны US-M10-01…07 и
US-M11-01/04…08, stable API, файлы/владельцы, проверки, независимая приёмка,
обработка unknown/late ответов, защиты владельца и полная матрица 228 кадров.

Figma прочитана без правок: live metadata подтвердили все87+141 IDs,
получены design context со screenshot двух desktop main; approved fingerprints
повторно не вычислялись. Подготовительный manifest780 inputs, metadata/context
и source-check — `artifacts/frontend-v2/settings-notifications-team/`
`Codex-preparation-2026-11-01/`. HEAD при фиксации подготовки
`6e7b340e683998a1d7f582360ec3e9bbf954b41c`, ветка frontend/v2-implementation,
рабочее дерево dirty; 24-часовой runtime commit внешней сессии сохранён.
Эта задача меняет только документацию; реализация не запущена,
TEST/FUNCTIONAL/UI не запускались и не получили новый PASS.
Следующий шаг — отдельное поручение выполнить подготовленное ТЗ.

## Codex · Stage RC5 · 01.11.2026 · опубликован

По прямому поручению владельца весь текущий frontend с Company S7 и Services S4
отправлен обычным atomic push в stage и развёрнут на
`https://stage.app-lid-radar.ru`. Commit
`087970b6de0f6fda22f104a65a722de4d79063ed`, annotated tag
`release/2026-11-01-rc5`, серверный release `ed577f84e992-w087970b6`.
Production/main не затрагивались, runtime после приёмки S4 не менялся.

GitHub run41309866705 завершён SUCCESS с первой попытки: все8jobs,
check1184unit/103files +13architecture +10deployguards, build×3/audit,
container, оба strict E2E shards и stage-deploy. E2E801PASS+34expectedskip,
failed/flaky/retry0. Пропуски:30stand без credentials,2Safari logout,
2width-owner. JS903809/905600, CSS71932/72000; пороги не менялись.
Backend остался на deployed `ed577f84e992afb5b0564c685736976c0c3255d9`,
API hash и миграция000032 неизменны. Серверные11checks PASS, readiness ready,
7running services/5healthy checks, exact frontend checkout/image SHA.

Независимый qa_s1: release TEST PASS и FUNCTIONAL PASS в scope точного deploy
и реального read-only smoke. Финальные52checks,11routes×3=33visits,
Chromium1440×1000/834×1194/390×844, errors0/business mutations0/logout204.
Реальный login/auth-me, новые настройки, все8названий/edit/switch/SVG готовы,
add/cancel, однострочный dirty status и SSE200 проверены. Runtime persistence/
business CRUD/delivery/native OS keyboard этим smoke не подтверждаются.

Независимый services_ui_s4 просмотрел9finalstagePNG: desktop FAIL,
tablet FAIL, mobile PASS. Открыт **UI-RC5-01 P3**: compact native time fields
на desktop/tablet обрезают AM/PM (`09:00 A` / `09:00 P`); на mobile суффиксы
полные. Аналогичный вид есть в прежнем controlled S7/S4 capture, новая регрессия
RC5 не установлена. Services names/controls и company dirty label PASS во всех
трёх. Это ограниченный stage rendering smoke; историческая полная Figma
приёмка S4 не переписывается. P3 требует отдельной точечной правки и проверок;
общий stage UI PASS не объявляется.

Evidence: `artifacts/frontend-v2/stage-settings-release-2026-11-01/RC5/`:
commit/source/manifest, CI raw+summary, server-before/after, live/report и9PNG,
qa/report/verdict, ui/report/verdict/findings, handoff и commands/exits.
1006принятых S4 inputs и17finalevidence files без drift. Единственная внешняя
post-commit delta — сохранённый Figma R50 prose в STATUS; эта итоговая release
запись тоже локальная документация и не входит в deployed immutable commit.
Ранние harness failures/PNG сохранены с диагнозами; финальный capture ждёт
async names/controls/images/font/paint, raw errors/credentials не пишет.
Следующий шаг — проверка владельцем stage и triage UI-RC5-01.

## Codex · Stage RC5 · 01.11.2026 · публикация разрешена

Владелец поручил отправить на stage весь актуальный frontend с новыми разделами.
Готовится полный Git-visible снимок Company S7 + интегрированный Services S4
со всеми исходниками, тестами и документацией. Все 1006 принятых S4 inputs
повторно сверены без drift. Независимые TEST/FUNCTIONAL/UI трёх адаптивов PASS
сохраняются; runtime после приёмки не меняется. Секреты и ignored artifacts
в Git не включаются, исходный dirty снимок сохранён отдельно.

Stage-autodeploy включён и запускается только после quality, build×3/audit,
обоих strict browser shards и container smoke. Backend stage зафиксирован
к текущему deployed `ed577f84e992afb5b0564c685736976c0c3255d9`, API hash
совпадает, миграция `000032_registration_invitation_check`, readiness ready.
Новый RC5 отправляется обычным fast-forward push; production/main исключены.
Фактические CI/deploy/live результаты будут зафиксированы после выполнения.
Подробности: `evidence/stage-release/Codex-R1/settings-rc5.md`;
локальные evidence: `artifacts/frontend-v2/stage-settings-release-2026-11-01/RC5/`.

## Codex · N-SS-ADAPTIVE-01 · 01.11.2026 · S4 принят

«Услуги и цены» выполнены для desktop, tablet и mobile по всем 48 утверждённым
кадрам (16×3). Независимые TEST PASS, FUNCTIONAL PASS и UI всех трёх адаптивов
PASS на одном неизменном снимке. Приняты frontend AC US-M03-01 #1–5 и negative,
US-M03-02 #1–3, US-M03-03 #1–3/6; регрессия US-M02-03/shared выполнена.
Production/backend/Figma не менялись; push/deploy/merge не было. Все исходные
незакоммиченные изменения, тесты и evidence компании сохранены; Company S7
остаётся immutable и принят.

Снимок S4: HEAD b4b19f025039570037d176cf5f05a21abb51624e, ветка
frontend/v2-implementation + dirty, 1006 inputs, normalization 0. Manifest SHA:
`6b15cd89a934e186f59b6475d95b7c4b9a7cd7805b4a8789daa9212425016635`.
Checkout `/private/tmp/lidradar-services-adaptive-s4`; archive/manifest/briefs,
изолированный services-only.patch и handoff находятся в
`artifacts/frontend-v2/settings-services-adaptive/Codex-R1/S4/`.
Начальное dirty дерево 755 inputs сохранено в родительском initial archive.

Реализованы адаптивные таблица и карточки, шесть смыслов цены/null/cents,
фильтры и счётчики, loading/empty/error/stale состояния. Формы add/edit имеют
normal/saving/error/подтверждённый success, ОК/edit того же response ID,
сохранение ввода после определённого отказа и блокировку слепого unknown POST.
Команды захватывают tenant до await; поздние ответы из прежнего контекста
изолированы. Disable: cancel/loading/error/retry/autoclose/reactivate и возврат
фокуса при исчезновении строки текущего фильтра. Общие UiSheet/UiTooltip
расширены opt-in, UiSavedResult переиспользуется компанией и услугами.
Onboarding/wizard и default consumers сохранены; API/деньги/lifecycle не менялись.

Действующие источники: source-map с 48 current native PNG, шестью usable context
и четырьмя явными tool timeout, тремя metadata XML, approved selection и SHA.
Все первичные PNG доступны и включены в snapshot; 58 native/context refs
проверены. Figma read-only. Точные SVG переиспользованы; 20 прежних M3 paths и
два знака каналов перенесены в SVG без перерисовки (zero-pixel proof в трёх
browser projects). На build объединяются повторяющиеся immutable class строки;
семантические тесты защищают keys/imports/directives, dev source maps прежние.
Зависимости, lockfile, generated API, budgets, coverage, baselines и retries
не менялись.

Независимый qa_s1: все девять финальных gates exit 0. Check: 1184 unit в 103
файлах, 13 architecture cases, format/lint/FSD/API/types PASS. Три build и audit
PASS: JS 903809/905600, CSS 71932/72000, max chunk 84897/110100, critical
241836/304800. Локальная stock CI матрица: 805 cases/805 attempts = 801 PASS +
4 ожидаемых skip, 0 failed/flaky/retry. Два skip прежние Safari logout, два —
Services width matrix с владельцем Chromium. Services capture 67/67 (48+19),
Company shared capture 73/73, controlled Company 4/4 PASS. Порт 4173 свободен,
QA процессы остановлены. TEST/FUNCTIONAL отчёт и команды — S4/qa/.

Независимый services_ui_s4 реально просмотрел 135 изображений: все 48 пары
Figma/browser, 26 PNG из 19 responsive records, 36 shared crops, 10 controlled
pairs и 15 resting/viewport/host-popup. UI-01 placeholder, UI-02 disabled fill
и UI-03 mobile error gap закрыты; новых findings нет. Все 48 exact-frame и
19 approved-pattern cases PASS, отдельно desktop/tablet/mobile PASS.
Два прежних shared UNVERIFIED закрыты новым сравнением одинаковых состояний
S7/S4 (help и hover): четыре state JSON идентичны, 7/10 PNG побайтно одинаковы,
три отличаются на 8/9/57 пикселей. Вердикт основан на просмотре, не на пороге
pixel diff. Старые несопоставимые polish PNG оставлены историческими.
Матрицы, attribution, viewed paths/SHA — S4/ui/; исходные PNG/records не менялись.

Post-review: 1006 snapshot/main inputs, два external AC и 691 UI files имеют
нулевой drift/missing/unlisted. Root и проверенная копия preprod dist побайтно
совпадают. История S1–S3 сохранена. QA-SS-S2-01 late focus закрыт scoped callback
исходной страницы/tenant: RED 3/3 до fix, GREEN 6/6 после, финальные stock cases
PASS. Shared inputs и прежний Company S7 не перезаписывались.

Stage/server persistence/auth/delivery, исторические диалоги/сделки M03-03 #4–5,
M03-04 AI, физическая OS keyboard и нативный browser zoom — UNVERIFIED.
Frontend/mock приёмка их не закрывает. DESIGN/SOURCES/design-index изменялись
внешним автором и сохранены; root нормализовал лишь whitespace JSON без изменения
parsed contents, исходные bytes сохранены. Следующий шаг — локальный review
готового diff владельцем; публикация не выполнялась.

## Codex · N-SC-ADAPTIVE-01 · 01.11.2026 · S7 принят

Задача «Компания и график» для desktop/tablet/mobile выполнена.
US-M02-05 #1–7, US-M02-06 #1–5 и negative; регрессия M02-02/04/shared.
Независимые TEST PASS, FUNCTIONAL PASS, UI desktop/tablet/mobile PASS.
Root пишет код; qa_s1 и ui_s5 независимо принимают неизменную копию.
Production/backend/Figma не менялись, push/deploy/merge не выполнялись.
Исходные tracked/untracked и чужая работа SERVICES сохранены.

Конечный снимок S7: HEAD b4b19f025039570037d176cf5f05a21abb51624e,
ветка frontend/v2-implementation + dirty,859 inputs. Manifest SHA-256:
`c9a33eb8b7ee21c25101d99fb51a07064dc0d79bc5d26e322026d3d1c1c3b6d2`.
Checkout `/private/tmp/lidradar-company-adaptive-s7`; archive/diff/manifest и
handoff в `artifacts/frontend-v2/settings-company-adaptive/Codex-R1/S7/`.

Реализованы три fluid layout, вкладки с отдельным скроллом, карточки точек,
все21×3 состояния, подтверждённый success→ОК/edit того же ID, drafts/retry,
2000ms feedback, unknown POST lock, guards/tenant/late-response protections.
«Не сохранено» закреплено в одну строку:9 ширин ×3 browser projects PASS.
Help targets44×44 при glyph20; low-height/VV/scroll/reconnect покрыты18 cases.
На1024 timezone теперь читается полностью; source1440 композиция сохранена.

Независимый qa_s1: check1167unit/100files, builddev/preprod/prod и auditrelease
exit0; stock CI766cases/766attempts =764pass+2oldskip,0fail/flaky/retry.
Все27 selected-label width cases и18 viewport cases PASS. Touch20/20 безCI,
retries0,traceon. Capture73/73:63canonical/126PNG+14responsive/20PNG;
вместе с27polish всего173PNG/253files. Бюджеты не менялись:JS905568/905600,
CSS71980/72000,maxchunk81140/110100,critical241797/304800.
FUNCTIONAL AC→test/code/evidence PASS, openQAfindings0, QA-S4-01 CLOSED.

Независимый ui_s5 реально просмотрел101image:63 exact-frame pairs (21/adaptive),
6mainviewport,6hostviewport+6popup и20responsive PNG (approved-pattern).
Все63 canonical и supplementary PASS; UI-S5-01…07 и UI-S6-01 CLOSED,
новых findings нет. Read-only reviewer вернул verdict сообщением; root записал
ui/report/verdict/matrices/reviewed-images с attribution. Исходные browser
capture records с UNVERIFIED не менялись; UI verdict хранится отдельно в ui/.
Post-review:859snapshot/603main runtime/config+companySelection/externalAC0drift;
253browserfiles0drift/unlisted. Root/snapshot129preprod files byte-identical.
Два main документа приведены к уже проверенному Prettier-виду S7, содержимое
сохранено; оригинальные bytes в S7/docs-before-final-format/.

Sources: `artifacts/frontend-v2/settings-company-adaptive/Codex-R1/source-map.json`
содержит63 current native PNG с SHA/размерами,
24 usable context, остальные39 недоступны и помечены. Старые legacy/S6 не эталоны.
S1–S6 archives/reports и tooltip-diagnostics D1/D2/D3 сохранены как история.
S7 отличается от S6 только OrganizationForm grid и meaningful width assertion:
red3/3 на старой сетке (105px<134px), green27/27 после min192 timezone.

Stage/server persistence/auth/delivery и физическая OS keyboard UNVERIFIED.
Low-height и mock VisualViewport отдельно PASS, не выдаются за native OS.
Следующий шаг: review локального diff владельцем; публикация не выполнялась.

## Figma · Правки настроек по поручению владельца · 31.10.2026

Privacy cleanup R59 · 01.11.2026 · ЗАВЕРШЕНО: по поручению владельца удалены
41 старый экран/диалог Privacy для desktop/tablet/mobile, включая `531:4174`,
всего3155 узлов. В удалённых деревьях общих masters нет. Утверждённая область
`1499:23110` сохранена:5282 узла,66 составных кадров, approved R57.
Перенаправлены124 prototype-узла на актуальные адаптивы; все278 уникальных
назначений переходов страницы Settings существуют, удалённых корней на canvas0.
На US `689:3915` исправлены5 ссылок и их подписи; история отзыва ведёт на
active `1499:23614`, остальные — на primary `1499:23486`. Старое US-превью
заменено статичным снимком утверждённого экрана, обновлены контекст/дата.
Два PNG US реально просмотрены; подписи помещаются, новая ссылка в одну строку.
Визуальные FNV/count для всех9 approved областей и49 Account/navigation
кадров совпали до/после; реакции исключены из визуального hash.
Семь оставшихся старых секций названы «Аккаунт», пять служебных описаний
уточнены. DESIGN/SOURCES и `settingsPrivacySelection.canvasCleanup` обновлены;
остальные корни индекса и утверждение R57 сохранены. Evidence —
`artifacts/frontend-v2/settings-polish/figma-2026-10-31/privacy-cleanup-r59/`.
Эта запись заменяет прежнее решение оставлять legacy Privacy на canvas;
исторические exports/manifests сохранены. Runtime/tests/config/backend/API,
общие tokens/components и замороженный Доступ не менялись; продуктовые проверки
и Figma Present не запускались. Очистка завершена; реализация этой задачей
не разрешается.

Статусы R58 · 01.11.2026 · ИСПРАВЛЕНЫ ПОДПИСИ: владелец повторно уточнил,
что макеты согласованы. Названия областей «Уведомления» `1392:15150`,
«Команда и доступ» `1426:18281`, «Данные и конфиденциальность» `1499:23110`
и две подписи обзорных досок теперь содержат «Утверждено».
Изменены ровно пять служебных узлов; устаревших «На согласование» внутри
трёх областей не осталось, число узлов сохранено:7275/13147/5282.
Решения владельца R47/R54/R57 действуют без повторного согласования.
DESIGN/SOURCES и шесть полей карты синхронизированы; прочие поля карты
сохранены. Старые полные отпечатки включают прежние подписи; overlay —
`artifacts/frontend-v2/settings-polish/figma-2026-10-31/settings-status-labels-r58/manifest.json`.
Эта запись заменяет прежние пояснения о сохранении названия «На согласование».
Сами экраны, masters/tokens, runtime/test/config/backend/production не менялись.
Продуктовые проверки для исправления подписей не запускались.

Privacy R57 · 01.11.2026 · УТВЕРЖДЕНО ВЛАДЕЛЬЦЕМ: полный комплект66 кадров
desktop/tablet/mobile в `1499:23110` после согласованной правки отзыва.
В12 revoke-диалогах/hosts (confirm/saving/error,3 адаптива) текст: новые
переписки и вердикты перестанут включаться в наборы; Radar продолжит работу
без изменений; история выдачи/отзыва сохранится. После успеха в3 адаптивах
только «✓ Согласие отозвано.».28 text nodes изменены,3 описания удалены;
проверка12 текстов и3 success PASS, overflow0, обещаний удаления0.
Просмотрены phone confirm, tablet error и desktop success;66 IDs live.
Approved snapshot:5282 узла, FNV-1a32 `5457f9c2`. Каноническая карта
`settingsPrivacySelection` заменила pending `settingsPrivacyDraft`;
остальные selection-блоки сохранены. DESIGN.md/SOURCES.md обновлены.
Evidence — `artifacts/frontend-v2/settings-polish/figma-2026-10-31/privacy-redesign-r57/`.
Утверждён UI/copy; расхождение legal/lifecycle по созданным наборам этим
решением не разрешено. Backend docs/runtime/test/config не менялись;
runtime TEST/FUNCTIONAL/UI и Figma Present не запускались. Следующий шаг —
отдельное поручение на реализацию; повторное утверждение макетов не требуется.

Privacy R56 · 01.11.2026 · МАКЕТ ГОТОВ К СОГЛАСОВАНИЮ: отдельная область
`1499:23110` «Данные и конфиденциальность — Redesign / На согласование».
Визуальный референс — утверждённые Уведомления `1392:15150`; существующие
Privacy/Account сохранены. Scope US-M14-01/02/04/07: ML-согласие, ZIP компании,
документы. Личный экспорт/удаление аккаунта M14-03/05/06 вне макета.
Desktop `1499:23486`1440×1214, tablet `1499:25281`834×1276,
phone `1499:26740`390×1568. Всего66 кадров, по22 на адаптив:14 main,
6 подтверждений grant/revoke (confirm/saving/error),2 opened hosts.
На телефоне попапы390×844. Локальные4 sets/30 variants, existing HIG buttons,
Inter/semantic tokens; raster-filled nodes0, новых shared masters/tokens0.
Права владельца/менеджера и независимость экспорта от согласия сохранены;
нет мгновенного switch, общего сохранения, процента прогресса или новой API-логики.
150 prototype bindings; targets доступны. Проверены2427 текстовых узлов,
overflow0; dialog bounds issues0. Saving6×3 controls: реакции0, hit areas≥44.
Просмотрены11 PNG, включая все3 основные адаптации и ошибки/загрузку/readonly.
Активный текст/статусы contrast4.58–16.83:1 по реальным токенам; focus example
и keyboard/ARIA-аннотации добавлены. Все8 approved visual fingerprints MATCH.
Формулировка судьбы уже созданных наборов требует сверки legal/lifecycle перед
реализацией;90/365 показаны как условия, исполнение retention не подтверждалось.
Figma Present, runtime TEST/FUNCTIONAL/browser/keyboard/ZIP verification NOT_RUN/
UNVERIFIED. Старые approved selections не переписаны; `settingsPrivacyDraft`
явно pending. Evidence — `artifacts/frontend-v2/settings-polish/figma-2026-10-31/privacy-redesign-r56/`.
Код/тесты/config/backend/production не менялись. Следующий шаг — решение
владельца по макету; реализация требует отдельного поручения после утверждения.

Настройки R55 · 01.11.2026 · ОЧИСТКА ЗАВЕРШЕНА по поручению владельца:
удалены128 старых экранов/диалогов четырёх утверждённых разделов,7853 узла.
В удалённом наборе общих masters/components0. Все8 указанных approved областей
сохранены: до/после совпадают node counts и visual FNV (reactions исключены).
140 входящих prototype-переходов перенаправлены на новые tablet/mobile эталоны;
на странице US `689:3915` обновлены39 ссылок/подписей по9 старым адресам,
включая ранее недоступные targets. Все39 проверены, link/layout issues0;
карточка US-M11-01 просмотрена. Исторические US-снимки с датой26.10 сохранены.
128 удалённых roots отсутствуют, остаточных старых экранов в смешанных областях0;
на Настройках255 уникальных prototype targets, missing0. «Данные» и «Аккаунт»
сохранены,7 смешанных областей/описания переименованы по оставшемуся содержимому.
Индекс `settingsPageCleanup`, DESIGN.md/SOURCES.md обновлены; прежние approved
selection-блоки не переписаны. Утверждения4 разделов продолжают действовать.
Evidence: `artifacts/frontend-v2/settings-polish/figma-2026-10-31/settings-cleanup-r55/`.
Runtime/test/config/production и замороженный Доступ не менялись; runtime QA не
запускался. Следующее действие — отдельное поручение владельца.

Команда R54 · 01.11.2026 · УТВЕРЖДЕНО ВЛАДЕЛЬЦЕМ: полный комплект
desktop/tablet/mobile в `1426:18281`, итог R48–R53. Основные экраны
`1427:18286`1440×1496 / `1428:19529`834×1522 / `1428:21909`390×2071;
141 кадров, по47 на адаптив. Live-сверка: все141 IDs на месте, снимок13147
узлов, FNV-1a32 `274d5fbb`; метод и код сохранены в evidence R54.
Карта `settingsTeamSelection` в design-index.json, DESIGN.md и SOURCES.md
обновлены; остальные разделы индекса сохранены. Три последних основных
превью R50/R53 проверены по SHA. Решение/состав —
`artifacts/frontend-v2/settings-polish/figma-2026-10-31/team-redesign-r54/manifest.json`.
Figma, общие masters/tokens, code/test/config не менялись. Название области
«На согласование» историческое; актуальный статус approved записан в карте.
Runtime TEST/FUNCTIONAL/UI не запускались. Следующий шаг — отдельное поручение
на реализацию; текущим утверждением разработка не разрешена.

Команда R53 · 01.11.2026 · НА СОГЛАСОВАНИЕ: мобильный «Отозвать…»
в приглашениях заменён на корзину во всех14 Phone/Pending-инстансах.
Правый край визуальной кнопки совпадает с иконками участников; области48×44.
Локальный master `1426:18350`, action `1426:18381`, пример `1428:22053`;
существующие переходы на подтверждение сохранены. Master+14 instances:
rightDelta0, issues0. Phone-превью просмотрено; PNG/manifest —
`artifacts/frontend-v2/settings-polish/figma-2026-10-31/team-redesign-r53/`.
Общие masters/tokens, code/test/config не менялись; runtime QA/Present не
запускались. Ожидается решение владельца по макету.

Команда R52 · 01.11.2026 · НА СОГЛАСОВАНИЕ: в мобильной карточке
`1428:21986` и всех58 Active-инстансах текстовые действия заменены на
карандаш «Изменить роль» и корзину «Отозвать доступ». Группа справа,
правый край визуальной кнопки совпадает со статусом «Активен»; области48×44.
Изменён только локальный Phone/Active и его actions; существующие NAVIGATE
сохранены, у ключевой карточки по одному переходу на действие. Проверены
master+58 instances, rightDelta0, issues0. Phone-превью просмотрено;
PNG/manifest — `artifacts/frontend-v2/settings-polish/figma-2026-10-31/team-redesign-r52/`.
Общие masters/tokens, code/test/config не менялись; runtime QA/Present не
запускались. Ожидается решение владельца по макету.

Команда R51 · 01.11.2026 · НА СОГЛАСОВАНИЕ: мобильная кнопка приглашения
`1428:21971` и ещё17 аналогов в `1426:18281` заменены на синий плюс из
локального R50 Icon action. Заголовок и плюс в одной строке; область48×44,
недоступное состояние и существующие переходы сохранены. Phone390×2079
просмотрен; PNG и manifest —
`artifacts/frontend-v2/settings-polish/figma-2026-10-31/team-redesign-r51/`.
Общие masters/tokens, code/test/config не менялись. Runtime QA/Present не
запускались. Ожидается решение владельца по макету.

Команда R50 · 01.11.2026 · НА СОГЛАСОВАНИЕ: desktop/tablet действия в
`1426:18281` заменены на иконки: плюс по `1307:13332`, карандаш, корзина.
Targets `1427:18372` / `1427:18391` / `1427:18456` сохранены. Локальные
INSTANCE_SWAP glyphs и Icon action Default/Hover/Focus/Disabled; визуал28px,
перенесённые области48×44. 182 icon controls проверены, issues0; на ключевых
действиях ровно один NAVIGATE, лишние CLOSE удалены. Подтверждение отзыва
сохранено. Колоночный slot64px освобождает ширину идентификатору. Mobile R49
с текстовыми действиями сохранён. Desktop/tablet и три открытых tooltip
просмотрены;3 PNG и manifest —
`artifacts/frontend-v2/settings-polish/figma-2026-10-31/team-redesign-r50/`.
Общие masters/tokens, code/test/config не менялись; Present/runtime QA не
запускались. Ожидается решение владельца по макету.

Команда R49 · 01.11.2026 · НА СОГЛАСОВАНИЕ: мобильные карточки участников
в области `1426:18281` перестроены по поручению к `1428:22914`: роль слева
и статус справа сверху, затем имя/email; «Отозвать доступ» справа внизу,
«Изменить роль» слева. Последний владелец и отозванные участники без отзыва.
Изменены только три локальных Phone-варианта;106 instances унаследовали
компоновку, native layout issues0. Широкие варианты/shared masters не менялись.
Отзыв открывает имеющееся подтверждение в ключевых сценариях прототипа.
Превью телефона390×2125 просмотрено, сохранено с SHA в
`artifacts/frontend-v2/settings-polish/figma-2026-10-31/team-redesign-r49/manifest.json`.
R48 остаётся историческим снимком. Code/test/config не менялись; runtime
TEST/FUNCTIONAL/UI не запускались. Ожидается решение владельца.

Команда и доступ R48 · 01.11.2026 · НА СОГЛАСОВАНИЕ: отдельная область
`1426:18281`, desktop1440 `1427:18286`, tablet834 `1428:19529`, phone390
`1428:21909`. Только дизайн по приложенному запросу владельца; US-M11-01,
04/05/06/07/08, API/ADR и HIG прочитаны. Две роли, member.manage только OWNER,
одноразовый код7 дней без email, soft revoke и LAST_OWNER сохранены.
141 составной кадр /47 на адаптив; выбор ролей, коды/копирование, изменения,
отзывы, ошибки/повтор, защитные и длинные состояния. Phone dialogs390×844.
11251 native nodes с корнем, Inter4636,15 local variants/3 sets, raster0,
width overflow0, out-of-bounds0, broken prototype targets0. Отпечаток `3c32303c`.
18 конечных PNG реально просмотрены; активные текстовые пары4,66…16,83:1.
Светлый контур1,34:1 записан как ограничение; browser a11y/Present/runtime
TEST/FUNCTIONAL/UI — UNVERIFIED/NOT_RUN. Ревью изображений выполнено ведущим.
Утверждённые Уведомления R47 `d0522675` MATCH; shared masters/variables и
экраны Доступа не менялись. Scope-проверка после устаревшего auto-review
подтвердила новые Team nodes; разрешённый повтор выполнен.
Артефакты: `artifacts/frontend-v2/settings-polish/figma-2026-10-31/team-redesign-r48/`
содержит manifest.json, review.md и18 PNG. Code/test/config/API/production и
approved design-index в R48 не редактировались. Ждать решения владельца;
разработку не начинать без утверждения макета и отдельного поручения.

Уведомления R47 · 01.11.2026 · УТВЕРЖДЕНО ВЛАДЕЛЬЦЕМ: область `1392:15150`,
desktop1440 `1393:15150`, tablet834 `1393:15932`, mobile390 `1393:16559`.
Утверждён полный комплект R44–R46: по29 кадров, всего87, включая последние
правки Telegram, тултипа, кнопок, отступов и бордеров полей. Точные состояния
записаны в `settingsNotificationsSelection`; все15 прежних корней design-index
сохранены. Native read:7275 nodes с корнем, отпечаток `d0522675`; геометрия
в manifest R47 актуальна. Figma при фиксации решения не редактировалась.
DESIGN/SOURCES и карта обновлены; manifests R44–R46 остаются историческими.
Решение: `artifacts/frontend-v2/settings-polish/figma-2026-10-31/notifications-redesign-r47/manifest.json`.
Runtime/test/config/API/production не менялись, новый TEST/FUNCTIONAL/UI PASS
не присваивался. Дизайн-этап завершён; ждать отдельного поручения на реализацию.

Уведомления R46 · 01.11.2026 · НА СОГЛАСОВАНИЕ: обычные бордеры 99 полей
в области `1392:15150` приведены к эталону услуг `1320:13388` / `1316:13406`:
светлый #DEDEE3, 1px INSIDE, существующее скругление10. Все адаптивы,
standalone и host формы; шесть focus и три validation бордера сохранены.
Проверки геометрии/стиля без отклонений, просмотрены desktop/tablet/phone.
Manifest: `artifacts/frontend-v2/settings-polish/figma-2026-10-31/notifications-redesign-r46/manifest.json`.
Общие masters/tokens, runtime/test/config не менялись; разработку не начинать.

Уведомления R45 · 01.11.2026 · НА СОГЛАСОВАНИЕ: в области `1392:15150`
добавлен исходный векторный логотип Telegram, статус подключения оформлен
плашкой 28px по образцам `1234:12271` / `1203:11325`; подключён — зелёный
с векторной галочкой, неподключён — нейтральный. Кнопки однострочные и по
центру. Пояснение перенесено в локальный тултип у заголовка, hit44×44,
36 карточек имеют единый gap16. Применено ко всем трём адаптивам и host.
Просмотрены шесть конечных PNG из Figma, исправлено наложение тултипа.
R44 PNG — исторические; текущая карта изменений и проверки сохранены в
`artifacts/frontend-v2/settings-polish/figma-2026-10-31/notifications-redesign-r45/manifest.json`.
Общие masters/tokens и runtime/test/config не менялись. Present и runtime
доступность не проверялись. Ожидается решение владельца; разработку не начинать.

Уведомления R44 · 01.11.2026 · НА СОГЛАСОВАНИЕ: отдельная область
`1392:15150` «Настройки / Уведомления — Redesign / На согласование».
Главные frames1440 `1393:15150`,834 `1393:15932`,390 `1393:16559`.
Изучены US-M10-01…07, API, текущий код, исходник и12 apple-design references.
Подключение Telegram отделено от доставки по типам; отдельное сохранение,
quiet/digest/disabled/defaults, ошибки/загрузка и личная привязка сохранены.
87 composed frames,10 локальных components/2 sets,6794 editable nodes,
Inter/raster0/overflow0;18 конечных PNG реально просмотрены. Измеренные
активные текстовые пары4,66…16,83:1. Native прототип первого типа настроен,
тайминги лишь демонстрируют ответ; Present/живой API и browser accessibility
не проверялись. Все8 контрольных исходников MATCH; общие masters/tokens
не менялись. Approved design-index не переключался на этот draft.
Артефакты `artifacts/frontend-v2/settings-polish/figma-2026-10-31/notifications-redesign-r44/`:
manifest.json, review.md и18 PNG. В этой задаче код/тесты/конфигурация
не редактировались, параллельные runtime inputs сохранены. Следующий шаг:
решение владельца по макету; реализацию не начинать без отдельного поручения.

Услуги R43 · 01.11.2026: владелец утвердил все normal/loading/error состояния
«Отключить услугу?» на desktop/tablet/phone, включая открытые host и правило
автозакрытия после успешного ответа без окна успеха. `dialogs.disable.status`
и `confirmationAdditionStatus` всех адаптивов — approved. Полный комплект
услуг по16 кадров на адаптив согласован; прежние approvals сохранены.
Приняты снимки R42: desktop1302/`8ce1956e`, tablet1198/`7a8362d3`,
mobile1374/`89650d42`. Нового чтения/правок Figma не было: это запись решения
по только что показанным макетам. Карта, DESIGN, SOURCES, evidence и manifest
`r43.json` обновлены; ledger R43 complete. Runtime/tests/API/production
не менялись. Новый runtime TEST/FUNCTIONAL/UI PASS не присваивался.

Услуги R42 · 01.11.2026: добавлена ошибка отключения во всех адаптивах:
desktop `1373:15125`, tablet `1373:15152`640×407, phone `1373:15179`390×844.
Critical feedback574×68/358×88, единый фон/контур, inner paints0. Сообщение
«Не удалось отключить услугу», без неподтверждённого утверждения о backend active.
«Повторить отключение» ведёт в loading своего адаптива; Cancel/X доступны и
ведут в main. Успешный ответ по-прежнему закрывает окно без success сцены.
Теперь16 composed frames/адаптив, размеры/позиции секций прежние.

Просмотрены3 PNG, native74 уникальных editable IDs, Inter/raster0/overflow0.
Все28 контрольных узлов/строк/masters/notes MATCH. Снимки1302/`8ce1956e`,
1198/`7a8362d3`,1374/`89650d42`. R42 manifest/PNG, карта/ledger обновлены;
комплект отключения normal/loading/error готов к просмотру владельцем.
Runtime/tests/API/production не менялись, параллельные inputs сохранены.
TEST/FUNCTIONAL/browser UI/Present/live request NOT RUN.

Услуги R41 · 01.11.2026: добавлены loading окна «Отключить услугу?»
desktop `1370:15071`, tablet `1370:15094`640×315, phone `1370:15117`390×844.
Обе кнопки и X недоступны; Cancel — State Disabled, X opacity45%, все native
actions включая descendants0. Деструктивная outline кнопка со спиннером16
и «Отключаем…»279/358×46. Размеры совпадают с normal, source normal/hosts сохранены.
Правило успеха указано отдельными canvas notes и в `dialogs.disable.afterSuccess`:
после успешного ответа автозакрытие, отдельного success окна и timeout симуляции нет.

Теперь15 composed frames на адаптив, геометрия секций прежняя. Новых62 editable
nodes, raster0/Inter/overflow0;3 PNG просмотрены, desktop/tablet SHA совпадают.
Все13 источников/строк,6 normal/host и3 использованных shared masters MATCH.
Снимки1278/`3c019059`,1174/`994505e6`,1348/`fb8f0cc7`. R41 manifest/PNG,
карта и ledger обновлены; normal/loading отключения на просмотре владельца.
Runtime/tests/API/production не менялись; TEST/FUNCTIONAL/browser UI/Present
и живой успешный запрос NOT RUN. Автозакрытие — спецификация поведения в Figma.

Услуги R40 · 01.11.2026: владелец утвердил mobile R39,12 кадров,
`1352:14063`/1082/`3ce837b9`; approval отдельно от нового дополнения.
Во всех адаптивах добавлена четвёртая строка «Отключение услуги»:
desktop `1366:14734`, tablet `1366:15007`, phone `1366:15254`.
Каждая содержит normal confirmation и экран с открытым окном, теперь14 кадров.
Диалоги `1366:14735`/`1366:15008`640×315, phone `1366:15255`390×844;
на телефоне header64/viewport643/footer136, X справа16 и кнопки358×46.
Источник `534:4412` и его текст сохранены. В новых desktop/tablet копиях
ширина кнопок279 FILL устраняет прежний выход2px за контейнер574.
Старый submit destination536:4519 очищен; Cancel/X ведут в свой adaptive main.
Результат отключения не прототипировался: поручение только на normal prompt.

Секции расширены; tablet y5280, phone y11336, gap256 между адаптивами.
Все9 прежних строк и4 исходных области/диалога совпали с pre-R40 hash.
Новые680 editable nodes, raster0, Inter, overflow0;6 реальных PNG просмотрены,
phone host SHA совпадает с normal popup. Текущие area snapshots:
desktop1258/`75537885`, tablet1154/`bdd2cfc7`, mobile1326/`831f10fd`.
R40 журнал/PNG и карта обновлены. Новые подтверждения на просмотре;
исходный mobile статус approved. Runtime/tests/production этой сессией
не менялись; TEST/FUNCTIONAL/browser UI/Present/live tap/scroll NOT RUN.
Следующий шаг — просмотр владельцем трёх добавленных подтверждений.

Услуги R39 · 01.11.2026: владелец утвердил планшет `1338:13676`; status approved
записан отдельно от нового mobile. После прерывания мобильных узлов не было.
Создан комплект `1352:14063`, x6808/y8630,2916×4084,12 экранов в трёх строках.
Main `1352:14067`,390×1628: шесть карточек358×190 вместо таблицы, прежние цены,
одна отключена, info открыт. Название/точка/цена/статус/edit/switch/help;
действия44, название до2строк с ellipsis. Вкладки358/1120 прокручиваются.
Scoped cards `1350:4154` и help `1350:4156`,93 bound nodes, существующие стили.
Все11 popup occurrences390×844:9 standalone и2 host, в том числе новая услуга.
Шапка64, кнопки136, viewport643 VERTICAL; fields358/171×46; X справа16.
Saving inputs50%/spinner16/actions0; success без заголовка формы, ОК/edit;
error с сохранёнными данными, feedback358×88 и retry в mobile saving.
Исправлены унаследованный minHeight1194 у host и stretch overlay494; оба
host и все состояния реально просмотрены после исправления. PNG host совпадают
с normal popup. Native1082 nodes/218 instances/308 text/Inter/raster0/overflow0,
table headers0, stale tablet nav0,45 полей; fingerprint `3ce837b9`.
14 PNG/SHA, операции и IDs — `r39-images/` / `r39.json`; карта/ledger обновлены.
Все5 текущих source hash до/после совпали. Company desktop a393da88 отличался
от старой истории уже до R39, в этой задаче не правился. Runtime/tests другой
работы сохранены; эта сессия меняла Figma и документацию/evidence.
TEST/FUNCTIONAL/browser UI/Present/live tap/scroll NOT RUN. Mobile на согласовании.
Следующий шаг — просмотр владельцем мобильного комплекта услуг.

Услуги R38 · 01.11.2026: владелец утвердил desktop `1307:13282` целиком.
Подложка «Отключена» в трёх desktop появлениях стала HUG87×28 вместо68×28:
текст67 и padding10 с обеих сторон помещаются. Desktop1027/`1d869c32` после
этой адресной правки сохранён при создании адаптива.

Под desktop создан планшетный комплект `1338:13676`, x6808/y4024,4610×4350:
12 экранов/состояний в трёх строках. Main `1338:14703`,834×1194; каталог786,
шесть строк736, пять колонок208/104/124/104/148; все действия44×44, плюс28
в hit44. Вкладки786/1120 с native HORIZONTAL overflow. Сохранены6/5/1,
цены, отключённая услуга и открытая подсказка. Локальный Tap44 helper
`1337:4159` открывается нажатием; popup358×126 над вопросом. При просмотре
исправлено перекрытие popup предыдущими строками через reverseZ=false.
Окна640×673 по центру viewport x97/y260.5, error640×765; все состояния
normal/saving/success/error и новая услуга перенесены. Открытие, ОК/X/Cancel,
редактирование после успеха и retry явно ведут в tablet; stale desktop nav0,
saving actions0. Main, оба host и весь canvas реально просмотрены.
949 editable nodes/200 instances/285 text/Inter/raster0/overflow0,
финальный fingerprint `7474c842`. Tablet пока на согласовании. PNG/SHA и
журнал — `r38-images/` / `r38.json`, карта/ledger обновлены.

Тем же сообщением владелец уточнил область заморозки: **только экраны Доступа**.
Настройки, Аналитика и остальные разделы вне заморозки; прежние ограничения
Онбординга/Radar заменены этим решением. DESIGN-FREEZE/CODE-FREEZE,
AGENTS/CLAUDE, DESIGN, WORKFLOW, SOURCES, RELEASE-SCOPE и карта синхронизированы.
Релизные gates/API/production-процедуры сохранены. Исходные desktop/tablet/mobile
компании совпали с текущими pre-R38 hash; исторический finding R33 не переписан.
В этой сессии runtime/API/production не правились; параллельные изменения
runtime/тестов сохранены. TEST/FUNCTIONAL/browser UI/Present NOT RUN.
Следующий шаг — просмотр владельцем планшета услуг; мобильный комплект не начат.

Услуги R37 · 01.11.2026: добавлены success/error обоих диалогов. Add
`1331:13637` / `1331:13658`, edit `1331:13710` / `1331:13731`. Success640×673
без формы/её заголовка, галочка и ссылки ОК/«Изменить услугу», центр совпадает.
Error640×765: введённые значения сохранены, поля доступны, единый critical-блок
574×68 и повтор в соответствующий saving. После add success отдельная edit-форма
новой услуги `1331:13595` с теми же1500–2500 RUB. Canvas5216×3768, прежние
normal/saving/hosts сохранены. Четыре результата и общий render просмотрены;
Inter/raster0/overflow0/stale company navigation0. PNG/SHA в `r37-images/`
и `r37.json`, карта/ledger обновлены. Все семь текущих baseline совпали;
историческое finding tablet R33 сохранено. Runtime/API/production не менялись;
TEST/FUNCTIONAL/browser UI/Present NOT RUN. Следующий шаг — просмотр владельцем
результатов услуг; автоматический runtime исход saving не моделировался.

Услуги/бордеры R36 · 01.11.2026: по приложенному скриншоту geometry-fix
mobile ошибок завершён первым. Два wrapper `1324:13557` / `1324:13558`,358×88,
рисуют общий фон/контур; прежние instances прозрачные FILL358 внутри, x0/y0.
Оба popup390×844 реально просмотрены через server screenshots. R35 менял
opacity, но не устранил дефект со скриншота; нативная причина не установлена.
Затем добавлены saving-диалоги услуг `1325:13557` / `1325:13603` справа от
normal, оба640×673: пять disabled полей/селектов, spinner16/«Сохраняем…»,
Cancel/X disabled, всех actions0. Add — введённый пример «Озонирование салона»
1500–2500 RUB; edit сохраняет31 000/31 000. Main и обычные формы сохранены.
Оба saving render просмотрены:44 editable nodes/10 instances/Inter/raster0/
overflow0. Область3104×3768. PNG и SHA в `r36-images/`/`r36.json`; карты
и ledger обновлены. Desktop и текущий tablet совпали по hash, mobile
2352/`df2f4b10` отражает два wrapper. Старый R33 finding сохранён.
Runtime/API/production не менялись; TEST/FUNCTIONAL/browser UI/Present NOT RUN.
Следующий шаг — просмотр владельцем saving и дальнейшие состояния услуг.

Услуги/бордеры R35 · 01.11.2026: `1307:13332` теперь синий плюс28×28 без
текста и заливки, тот же master, что у `1189:10954`. Область услуг2400×3768:
главный экран и две строки друг под другом — add `1316:13356`, edit
`1320:13388`. Полные экраны с открытым диалогом `1320:13389` / `1320:13639`
слева, отдельные формы640×673 справа. Фон затемнён18%, окна центрированы.
В mobile error `1288:12955` / `1288:13111` равная обводка INSIDE1 усилена
20%→35%,358×88 и тексты сохранены; оба popup390×844 реально просмотрены.
Финальная область услуг также просмотрена: main201 nodes, оба host240,
Inter/raster0/overflow0. Desktop компании и source-диалоги совпали по hash,
текущий tablet также неизменен; старое finding R33 остаётся UNVERIFIED.
Mobile hash `ef978bfb` отражает две разрешённые правки. Журнал `r35.json`,
evidence `figma-services-2026-11-01.md`, карты обновлены. Runtime/API/production
не менялись; TEST/FUNCTIONAL/browser UI/Present NOT RUN. Следующий шаг —
просмотр владельцем новой раскладки и дальнейшее поручение по состояниям услуг.

Услуги R34 · 01.11.2026: в области `1307:13282` под основным экраном создана
строка `1316:13356` с обычными desktop-диалогами «Добавить услугу»
`1316:13357` и «Изменить услугу» `1316:13397`, оба640×673. Создание — пустые
поля, редактирование — первая услуга/31 000 ₽. Поля574, ценовые колонки279:
унаследованный срез правого бордера устранён. Обе формы реально просмотрены;
по40 editable nodes/9 instances/15 text/Inter, raster0, overflow0.
Кнопка добавления и первый pencil связаны с новыми overlays; Present NOT RUN.
Внешний вид главного экрана совпал по visual hash `9aef4f4a`; исходные диалоги
совпали по полным hash. Saving/success/error/adaptives не добавлялись.
Журнал `r34.json`, карта `settingsServicesSelection.dialogs`, evidence
`figma-services-2026-11-01.md`. Диалоги на согласовании; runtime/API/production
не менялись, TEST/FUNCTIONAL/browser UI/Present NOT RUN. Следующий шаг —
просмотр владельцем обычного состояния; прежнее finding tablet R33 сохранено.

Услуги R33 · 01.11.2026: отдельная область `1307:13282` справа от desktop
компании, первый экран `1307:13284`, 1440×1000. Невалидный warning удалён
в новой копии; блочного сохранения нет. Шесть услуг: точная цена, диапазон,
«от», «до», неизвестная и с копейками; одна отключена, фильтры6/5/1.
Открыт информационный tooltip у отключённой строки; reverse Z исправляет
перекрытие соседними свитчами. По уточнению владельца кнопка `1307:13332`
теперь165×36, плюс16 перед подписью14/20; ID сохранён. Финальный render
просмотрен;202 editable nodes/40 instances/0 raster, width overflow0.
Новый экран на согласовании: `settingsServicesSelection`, журнал `r33.json`,
evidence `figma-services-2026-11-01.md`. Исходный Services, desktop/mobile
компании совпали по hash. Tablet hash изменился25dc049c→a6203ac8 при отсутствии
мутаций в этой области; точная сохранность UNVERIFIED, baseline не переписан.
Runtime/API/production не менялись; TEST/FUNCTIONAL/browser UI/Present NOT RUN.

Утверждение адаптивов R32 · 01.11.2026: владелец принял и утвердил полный
комплект новых планшетных `1246:10269` и мобильных `1277:11797` макетов
«Компания и график», по 21 экрану/состоянию в каждом. Планшет — итог R26,
мобильный комплект — R30 с исправлениями R31 и полноэкранными попапами390×844.
Оба набора теперь approved в `design-index.json`; desktop `1189:10891`
остаётся утверждённым. Журнал решения `r32.json`. Макеты и runtime этой
задачей не менялись; новых TEST/FUNCTIONAL/browser UI/Present не было.
Утверждение дизайна не снимает CODE-FREEZE и не запускает реализацию.

Микроправка R31 · 01.11.2026: исправлены лейблы порогов, отступ крестика
и правая обводка error-feedback во всех применимых mobile popup состояниях.
18 лейблов — HUG20/y12 в строке44, центр совпадает с вопросом; во всех11
шапках видимый круг крестика отстоит справа16px при сохранённой hit-area46.
Два error-баннера358×88: внутренняя обводка1px по всем сторонам, ширина FIXED,
лишний clip контента снят. Normal/error popup и border3× реально просмотрены.
Журнал `r31.json`, карта `mobileDraft.popupPolish`. Размер390×844 и данные
сохранены; runtime/API/production не менялись. TEST/FUNCTIONAL/browser UI/
Present не запускались.

Мобильные состояния R30 · 01.11.2026: владелец утвердил первый экран R29
и поручил добавить остальные. В области `1277:11797` теперь 21 экран/состояние
в четырёх строках: компания, график, создание и изменение точки. Сохранение,
успех/idle, ошибки и повторы перенесены; введённые данные сохранены.
По уточнению владельца все диалоги — полноэкранные попапы 390×844:
шапка 64 и действия 136 закреплены, тело 643 имеет native VERTICAL overflow.
Success того же размера, без заголовка формы, с X и ссылками OK/«Изменить точку».
В формах синие вопросы44px, открыта левая подсказка add / правая edit.
Все четыре финальные строки реально просмотрены. Read-back: 2350 editable
nodes/649 instances/669 text/0 raster, text width overflow0;96 полей132×46.
Статусы успеха/ошибки имеют таймер2000ms, retry ведёт в mobile saving;
stale tablet navigation0. Desktop `fae67cc4`, tablet `25dc049c` и оформление
первого mobile `f119377c` сохранены. Журнал `r30.json`, карта `mobileDraft`.
Первый экран approved; новый комплект готов к просмотру владельцем.
Runtime/API/production не менялись; TEST/FUNCTIONAL/browser UI/Present и
живой scroll не запускались. Реализация frontend этим поручением не начата.

Микроправка R29 · 01.11.2026: строка времени мобильного рабочего дня
`1277:11870` теперь занимает все326px. Через scoped master `1276:4226`
обновлены все шесть рабочих дней: два равных input132×46 (FILL), подписи
«с»/«до» и отступы сохранены. Все12 значений прежние, render недели просмотрен.
Журнал `r29.json`, карта `mobileDraft`. По-прежнему один экран на согласовании;
остальные состояния не создавались. Runtime/API/production не менялись;
TEST/FUNCTIONAL/browser UI/Present не запускались.

Мобильный первый экран R28 · 01.11.2026: по новому поручению создан только
`1277:11798`, 390×2485, в области `1277:11797` под планшетом (gap256).
Статус — на согласовании; остальные мобильные состояния ждут утверждения.
Одна колонка полей и пяти точек, шестое действие добавления, общий блок
точек/графика с разделителем; дни с checkbox46 и отдельной строкой времени96×46.
Длинное имя200 символов обрезается; полное имя доступно по нажатию264×44.
Appbar Phone64, горизонтальные вкладки358/1120. Финальный render просмотрен;
242 editable nodes/71 instances/0 raster, Inter, text width overflow0.
Desktop2306/`fae67cc4` и tablet2302/`25dc049c` до/после совпадают.
Журнал `r28.json`, карта `mobileDraft`. Runtime/API/production не менялись;
TEST/FUNCTIONAL/browser UI/Present не запускались. Следующий шаг — отзыв
владельца о первом мобильном экране, без автоматического создания остальных.

Утверждение планшета R27 · 01.11.2026: владелец утвердил область `1246:10269`
целиком — 21 экран/состояние «Компания и график» в четырёх строках после R26.
Это текущий планшетный эталон; desktop `1189:10891` также остаётся утверждённым.
Решение записано в `design-index.json` → `settingsCompanyAndScheduleSelection`
→ `tabletDraft` (status approved; имя ключа сохранено для совместимости).
Журнал `r27.json`, последнее изменение Figma — R26. Макеты и runtime в этой
задаче не менялись; новые проверки TEST/FUNCTIONAL/browser UI не запускались.
Следующий этап workflow — синхронизация US/решения о реализации; approval
макетов не снимает CODE-FREEZE и не включает новый пакет runtime в релиз.

Микроправка R26 · 01.11.2026: «Добавить точку» с заглавной буквы, синяя
подпись/плюс и мягкая голубая рамка; голубая подложка убрана по уточнению
владельца, фон белый. Scoped set `1265:11891`, включая Hover/Disabled;
восемь текущих карточек361×54 и все21 планшетное состояние проверены.
Финальный render блока `1249:10724` просмотрен. Comparison/preview R25
уже отсутствовали при чтении R26; не восстанавливались. Журнал `r26.json`,
текущая карта `tabletDraft`; исходники/тесты сохранены. Runtime
TEST/FUNCTIONAL/browser UI/Present не запускались; production не затрагивался.

Выбор и правки R25 · 01.11.2026: владелец выбрал A. Общая карточка с линией
применена ко всем восьми группам планшетной области и preview `1260:11743`;
21 исходный кадр/IDs сохранены. Верхний плюс заменён шестой карточкой361×54
«добавить точку», с плюсом справа, без индикатора. Scoped set `1265:11891`
Default/Hover/Disabled; при saving добавление заблокировано. В четырёх полных
экранах и preview — desktop-вкладки: viewport786×46, strip1120, native
HORIZONTAL overflow334px. Основные экраны теперь834×1815; modal viewport1194h
и размеры форм не менялись. Read-back: 5 точек + действие, одна неактивная,
200-char name, прежние 12 значений на группу, поля46h, overflow0, Inter.
Desktop2306/`fae67cc4` сохранён. 2301 editable descendants/649 instances/0 raster.
Через Plugin API просмотрены preview, saving и modal host после timeout обычного
экспорта. B/C уже отсутствовали до R25, не восстанавливались. Журнал `r25.json`;
текущий источник обновлён в `tabletDraft`. Runtime/API/production не менялись;
TEST/FUNCTIONAL/browser UI/Present и живой scroll-жест не запускались.

Варианты R24 · 01.11.2026: справа от планшета создано сравнение `1260:11738`,
три полных экрана834: A `1260:11743` — общая карточка/разделитель; B
`1260:11820` — выбор точки в шапке + список `1260:11864`; C `1260:11897` —
график внутри раскрытой точки. Это предложения, выбор владельцем не сделан;
текущие 21 планшетное состояние и approved desktop не менялись — fingerprints
до/после совпали. Полный comparison render просмотрен; 12 значений времени
совпадают во всех трёх, поля46h, Inter, overflow0, 701 editable descendants,
201 instances/0 raster. Рекомендация A для пяти точек — дизайн-суждение.
Карта: `tabletDraft.layoutAlternatives`; журнал `r24.json`.
Runtime/API/production не менялись; TEST/FUNCTIONAL/browser UI/Present не запускались.

Планшет R23 · 01.11.2026: под утверждённым desktop создана область `1246:10269`
на согласование, 21 экран/состояние в тех же четырёх строках. Ширина834,
основной экран1872h, modal viewport1194h. Appbar/компактный выбор раздела;
название компании отдельной строкой, валюта/пояс в две колонки; пять точек в две
колонки, график ниже. Локальные Tablet-компоненты: поля времени46h и edit-hit44,
full-name tooltip по нажатию. Desktop digest `99f3ae90` /2306 узлов не изменён.
CANVAS: все строки и финальные modal-host/main render просмотрены; overflow0,
96 time fields46h, 40 edit targets44×44, success modal sizes сохранены,
фоновые подсказки под модалками закрыты. Native: 2221 узел/625 instances/0 raster.
Карта: `settingsCompanyAndScheduleSelection.tabletDraft`; журнал `r23.json`.
Утверждение планшета ещё не дано. Runtime/API/production не менялись;
TEST/FUNCTIONAL/browser UI/Present не запускались.

Утверждение и очистка R22 · 01.11.2026: владелец утвердил `1189:10891`.
Это текущий эталон настроек «Компания и график»; выбор зарегистрирован в
`design-index.json` → `settingsCompanyAndScheduleSelection`. Сохранены все
21 экран/состояние в четырёх строках, 2306 узлов. Вне области удалены 33 старых
макета раздела (по 11 desktop/tablet/mobile, вместе с их диалогами/состояниями).
114 переходов перенаправлены на новые основной экран/форму изменения точки,
старые flow starts очищены; stale roots/links0. Внешних ссылок на удаляемые
кадры на остальных девяти страницах нет. Проверка 241 сохранённого корня
совпала по слоям/визуальным свойствам; reactions сверены отдельно.
Утверждённая область реально просмотрена; журналы `r22-before.json` / `r22.json`.
Старые адаптивы больше не эталоны; новые tablet/mobile этим решением не приняты.
Runtime/API/production не менялись, TEST/FUNCTIONAL/browser UI/Present не запускались.

Состояния R21: в компанию `1189:10934` и три её копии рабочих экранов добавлен
верхний правый статус. В первой строке `1227:11767` справа: сохранение
`1234:12279`, успех `1234:12305`, отсутствие изменений `1234:12331`, ошибка
`1234:12357`. Saving блокирует три поля и показывает spinner; успех через
2000 ms сменяется на «Изменений нет», ошибка — на «Не сохранено». При ошибке
баннер и все три значения остаются, активный повтор ведёт в saving.
Размеры 1120×230, error 1120×314; overflow0, Inter, editable layers, 0 raster.
Вся строка реально просмотрена; журнал `r21.json`. Runtime/API не менялись,
TEST/FUNCTIONAL/browser UI/Present не запускались.

Уточнение R20: footer sidebar возвращён к нижнему краю на всех четырёх
полных экранах рабочей области. FILL по высоте / SPACE_BETWEEN; bottom gap24
подтверждён для каждого. Меню сверху и размеры экранов прежние. Основной render
просмотрен; журнал `r20.json`. Runtime/API/тесты не менялись/не запускались.

Организация R19: область `1189:10891` разбита на четыре строки/section:
Компания `1227:11767` (только исходный экран, справа пусто); График
`1227:11768` (основа + saving/saved/idle/error); Создание `1227:11769`
и Изменение `1227:11770` (основа с открытой модалкой + её состояния справа).
Вспомогательная форма после добавления сохранена в строке изменения.
Все 14 исходных кадров сохранили размеры и IDs; удалена только пустая обёртка
сравнения `1203:11309`. Ссылки ведут на существующие кадры внутри SECTION.
Обзор и обе новые композиции просмотрены; фоновые hover-подсказки под модалками
закрыты. Журнал `r19.json`. Runtime/API/тесты/Present не запускались и не менялись.

Уточнение R18: `1198:11093` приведён к самостоятельной области «Точки и график»,
как error-reference `1205:11721`: оболочка страницы/Компания убраны, размер
1120×698. ID корня и вложенной области `1198:11151` сохранены, retry-ссылка
актуальна. 12 значений, disabled-контролы и loading/spinner сохранены;
пояснение графика совпадает с эталоном. Убрана прежняя minHeight1000.
Итоговый render просмотрен; журнал `r18.json`. Runtime/API/тесты не менялись.

Состояния R17: ошибки изменения `1218:11737` и добавления `1218:11806`
точки. Баннер под формой, все 9 полей и введённые значения сохранены,
поля доступны; «Повторить сохранение» активно и ведёт к соответствующему
saving-диалогу. Отмена/крестик доступны. Оба render просмотрены, overflow0,
Inter; ошибка команды не окрашивает поля как ошибочные. Журнал `r17.json`.
Runtime/API/тесты/Present не запускались и не менялись.

Уточнение R16: верхние заголовки убраны из обоих success-диалогов, в шапках
остались только крестики справа. Размеры 640×681 / 640×575, центрированный
feedback и ссылки сохранены; CLOSE reactions на месте. Оба render просмотрены.
Журнал `r16.json`. Runtime/тесты/Present не запускались и не менялись.

Уточнение R15: центровка ссылок исправлена в обоих success-диалогах. Вместо
фиксированных 56/160 px с LEFT-текстом — scoped Link `1213:4113`, HUG 44/134 px
с одинаковым padding12. Центр текста совпадает с центром ряда (delta0).
Размеры окон и CLOSE/NAVIGATE сохранены; оба render реально просмотрены.
Второй экспорт сначала timeout, адресный повтор получен. Журнал `r15.json`.
Runtime/тесты/Present не запускались и не менялись.

Состояния R14: успешное изменение `1211:11746` (640×681) и добавление
`1211:11795` (640×575) в рабочей области. Размеры точно равны формам;
input/footer удалены, по центру подтверждение и ссылки «ОК» / «Изменить точку»
в обоих случаях. Настроены CLOSE и переходы к форме с соответствующими данными;
для только что добавленной точки подготовлена форма `1211:11692` (Арбат).
Оба render просмотрены, Inter, inputCount=0, sameDimensions=true.
Журнал `r14.json`. Runtime/тесты/Present не запускались и не менялись.

Уточнение R13: бейдж `1205:11736` тоже сообщает об ошибке — красный индикатор
и «Ошибка сохранения», AFTER_TIMEOUT 2000 ms → нейтральное «Не сохранено».
Баннер ошибки, черновик и активный повтор остаются. Новый scoped-компонент
`1207:4121`, обе фазы 160×28. Просмотрены область ошибки и варианты бейджа;
журнал `r13.json`. Runtime/тесты/Present не запускались и не менялись.

Состояние R12: `1205:11721` «09 · График · Ошибка сохранения · Повторить»
добавлено ниже пары Saved/Idle. Сообщение ошибки под расписанием, все 12
значений времени сохранены, поля доступны. Кнопка «Повторить сохранение»
активна; prototype click ведёт на экран сохранения `1198:11093`.
Полный render просмотрен, draft сверён с исходным, Inter сохранён.
Журнал `r12.json`. Runtime/тесты/Present не запускались и не менялись.

Состояния R11: ниже прежних экранов добавлена пара областей `1203:11309`:
`1203:11310` — зелёная галочка/«Сохранено»; `1203:11469` — «Изменений нет».
Для бейджа `1203:4119` настроен AFTER_TIMEOUT 2000 ms → Idle. Оба состояния
реально просмотрены: 12 полей снова доступны, значения прежние, повторное
сохранение без правок недоступно. Статус 132×28, без сдвига заголовка.
Журнал `r11.json`. Это Figma-only: runtime пока имеет прежний saved/alert,
новый таймер не реализовывался. TEST/FUNCTIONAL/Present не запускались.

Состояния R10 добавлены в рабочую область справа от saving-экрана графика:
`1200:11250` «05 · Изменить точку · Сохранение», `1200:11316` «06 · Добавить
точку · Сохранение». Все 9 input/select заблокированы, значения видны,
кнопки со spinner/«Сохраняем…». Отмена и закрытие недоступны согласно текущему
busy-контракту диалогов. Оба render реально просмотрены, overflow=0, Inter.
Журнал `r10.json`. Runtime и тесты не менялись/не запускались.

Состояние R9 добавлено в рабочую область: `1198:11093` «04 · Компания и график ·
Сохранение графика». Disabled: 12 полей времени, 7 чекбоксов, 6 вкладок, выбор/
редактирование 5 точек, добавление и копирование часов. Все значения сохранены;
кнопка 220×46 использует существующий Busy action со spinner и «Сохраняем…».
Полный экран реально просмотрен; Inter, native editable layers, 0 raster.
Блок компании остаётся отдельным. Журнал `r9.json`; runtime и тесты не менялись/
не запускались. Другие состояния пока не добавлялись.

Уточнение R8: создана отдельная область `1189:10891` «Компания и график ·
Рабочие экраны и состояния». Основной экран `1189:10892`: пять карточек,
ровно одна неактивная, длинное название 200 символов с открытой подсказкой,
счётчик в sidebar — 5 точек. Справа два диалога: `1189:11028` с левой открытой
подсказкой, `1189:11088` с правой. В общем Help вопросы перекрашены в синий;
для двух previews добавлен scoped Above-вариант, чтобы input не закрывал текст.
Итоговая композиция реально просмотрена; Inter, editable nodes, no raster.
Журнал `r8.json`. Runtime/тесты не менялись и не запускались. Следующий шаг —
разбор состояний компании в этой новой области по поручению владельца.

Уточнение R7: кнопка добавления точки уменьшена 46→28 px, плюс синий,
Default без заливки, Hover с лёгкой подложкой. Шапка списка теперь 28 px,
заголовок и кнопка выровнены. Просмотрены список и состояния кнопки;
новый scoped-компонент `1186:4115` не меняет онбординг. Журнал `r7.json`.
Runtime/тесты не менялись и не запускались.

Уточнение R6: у обрезанного названия добавлена hover-подсказка с полным текстом
200 символов; короткие названия без подсказки. Реальный Hover render просмотрен,
текст совпадает с названием; затем восстановлен Default (скрыто). Компонент
`1184:4125`, журнал `r6.json` рядом с R5. Runtime и тесты не менялись/не запускались.

Уточнение R5: в список добавлены ещё две точки — «Арбат» (5 символов) и
название ровно 200 символов; вместе с исходной карточкой их три. Лимит взят
из `manage-locations/model/schema.ts` (trim + Array.from ≤200). Полный текст
сохранён в Figma, визуально обрезается троеточием в фиксированной строке 22 px.
Просмотрен render списка: карточки 272×54, карандаши и индикаторы на месте.
Снимок и IDs: `r5.json` рядом с R4. Runtime и тесты не менялись/не запускались.

Уточнение R4: индикатор перенесён с прямого участка border на середину дуги
правого верхнего скругления (45°). Центр (268.1317, 3.8683) лежит точно на
центральной линии stroke радиуса 11.5 px. Active/Hover/Inactive просмотрены;
журнал `r4.json` рядом с R3. Runtime не менялся.

Уточнение R3: в карточке точки удалена подпись графика, название и карандаш
выровнены в одной строке; карточка 272×54. Центр зелёного/красного индикатора
совпадает с линией верхнего border (0.5 px). Просмотрены фактическая карточка
и Active/Hover/Inactive; IDs/evidence сохранены в `r3.json` рядом с R2.
Runtime и тесты не менялись и не запускались.

Уточнение R2 владельца выполнено в Figma: текстовый статус карточки заменён
индикатором 8 px справа сверху (зелёный/красный, Active=true/false); карандаш
уменьшен до 28×28, включая hover, с отступом от border. В обоих диалогах
настроек устранено переполнение 2 px: поля 574/279 px по контейнеру, overflow=0.
Карточка, Active/Inactive/Hover и оба диалога реально просмотрены.
Журнал/IDs: `artifacts/frontend-v2/settings-polish/figma-2026-10-31/r2.json`.
Это Figma-only R2; runtime и тесты не менялись и не запускались.

В Figma внесён точечный пакет: warning вместо обычного текста в 19 desktop
Layout настроек; статус внутри выбранной карточки точки; подсказки у порогов
и единица «мин» внутри полей двух диалогов настроек. В семи desktop состояниях
услуг уменьшены фильтры, добавлены карандаш/switch/hover-подсказка; прежний текст
под таблицей перенесён полностью. По прямому разрешению владельца аналогичные
поля обновлены в девяти актуальных диалогах онбординга (US-M02-04,
desktop/tablet/mobile, добавление/изменение/ошибка). Значения 30/60 сохранены;
настройки сохраняют 45/120. Исторические варианты онбординга не менялись.

Основная сессия просмотрела реальные Figma изображения основных страниц,
диалогов и состояний подсказок; Inter, warning tokens и prototype wiring
проверены. Это **не** независимая runtime UI-приёмка. TEST/FUNCTIONAL runtime
не запускались. Существующие dirty/untracked исходники и тесты сохранены;
backend/API/production не менялись. Старые tablet/mobile макеты настроек
остаются отложенными. Следующий шаг — согласование макетов владельцем,
затем отдельная синхронизация требований/реализации и QA по WORKFLOW.
[Пакет, точные nodes и ограничения](evidence/settings-polish/figma-2026-10-31.md).

## Аудит незакоммиченных изменений · 31.10.2026

Проверены frontend, backend и лендинг: изменены только документы, AI manifest
и evidence; runtime/API/миграции/зависимости неизменны. Backend сохранён двумя
локальными коммитами: `71b658a` (US-M01/02/04) и `00e5fb5` (R02 / v9r5).
31 Python-тест AI tooling и обязательный backend pre-commit `make check-local`
(формат/vet/Go tests без БД/architecture) PASS; frontend format check PASS.
Полный release/живой FUNCTIONAL/UI не запускался; исходный AI tuple FAIL сохраняется.

Исторический staged `docs-before.log` с заменёнными абсолютными путями оставлен
вне коммитов, без изменения его содержимого или index. Отдельное расхождение
для follow-up: US каналов описывает Secretary Mode, а текст диалога подключения
ещё упоминает бизнес-аккаунт. Изменения требований не означают приёмку runtime.
[Снимок аудита и границы проверок](evidence/uncommitted-review-2026-10-31/review.json).
Push, merge и deploy не выполнялись.

## R02 / RG-AI · 31.10.2026 · v9r5 утверждён владельцем

По прямому решению владельца v9r5 зафиксирован как стабильный замороженный
tuple: backend manifest `status: FROZEN`, `releaseApproval.status: STABLE`,
основание `OWNER_RISK_ACCEPTANCE`. R02 завершён в части выбора и допуска
с исключениями; дальнейшие испытания — первая студия. Техническая квалификация
остаётся `passed: false`: GOLDEN/HOLDOUT false, hardwareResult null. Пороги,
исходные reports, datasets и selection сохранены; прежний CANDIDATE-manifest
сохранён побайтно, HOLDOUT/baseline summary согласованы с исходными reports.

Заморожен tuple из selection v9r5, tree `b0b57554…`. Локальный
`make ai-release-verify` FAIL: `domain/ai.go` изменён, `analysis_status.go`
не входил в selection; это исходное расхождение дерева, hashes не подменялись.
Фактический узел UNVERIFIED. Следующий шаг R03/R07: учесть расхождение в
release manifest; на первой студии отдельно проверить факты/пять правил риска,
hardware и фактический tuple. Ограниченный режим не вводился.

План выпуска уточнён владельцем: выкатывается точный замороженный v9r5;
до deploy нужен `ai-release-verify` exit0 на релизном снимке, после deploy —
сверка фактического tuple узла. При успешной проверке закрывается только FAIL
совпадения tuple, с сохранением истории и проваленных метрик. В Plane обновлены
название и описание [LIDRADAR-16](https://plane.lid-radar.online/lid-radar/browse/LIDRADAR-16/),
статус остаётся Confirmed до проверки операционного остатка.

[Решение и hashes](../../../Lidradar/docs/engineering/AI-V9R5-STABLE-2026-10-31.md),
[сверка первоначального снимка](evidence/ai-v9r5-stable-2026-10-31/verification.json),
[актуальный план R02](RELEASE-PLAN-2026-11-01.md#r02--ai-v9r5-утверждён-и-заморожен-как-стабильный).
Runtime, тесты и frontend inputs не менялись. TEST/FUNCTIONAL/UI и серверные
проверки не запускались; push/deploy/production не затрагивались.

## Stage RC4 · 31.10.2026 · изоляция T28 navigation

Strict rc3 GitHub41215749019: quality1162/build×3/audit/container/Python10 PASS,
E2E712PASS/1flaky/32skip; строгий gate заблокировал deploy, stage остался наrc2.
Native/teamgeometry прошли. Новая единственнаяflake mobile AccessT28: второй
goto/login начиналсядоlazyimportsпервого; traceфиксирует moduleimportfailed,
WebKitinternalerrorдляmainJS/CSS иblankframeдоfooterassertions.

CI-RC3-01: test-only подготовкакаждогоиз8кадровчерезabout:blank, затемцелевойURL.
Тежеfixtures/readychecks/footergeometry/linksecurityassertions/timeouts. Runtime,
Accessдизайн ипринятыйG01 не меняются. Новыйtag `release/2026-11-01-rc4`;
evidence/независимаяприёмка `artifacts/frontend-v2/stage-freeze-2026-10-31/CI-FIX3/`.
ПослеlocalPASS обязательныновыйполныйstrictLinuxCI иactualstageverification.

CI-FIX3 независимо принят: **TEST PASS / FUNCTIONAL PASS** (test-only scope).
Freshcheck1162unit, strictT28=30/30за31.2sec,30attempts/0retry/failed/flaky.
Byteproofsame8paths/mocks/ready/geometry/security/narrowassertions;731/731unchanged,
source6728b8ea…; все745caseIDs прежние. НовыйLinuxCI/actualdeployещёUNVERIFIED;
единичныйtraceнеисключаетотдельныйWebKit/runtime риск. Послеcommit/tagrc4 идут
atomicstagepush, обязательныйполныйstrictCI ипроверкафактическогосервера.

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
