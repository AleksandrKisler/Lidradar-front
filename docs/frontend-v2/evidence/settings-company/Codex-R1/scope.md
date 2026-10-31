# Настройки → Компания и график · Codex R1

31.10.2026. US-M02-05/06; связанные US-M02-02/04 — регрессия.
Ветка frontend/v2-implementation, HEAD 4e175e914719f380dcadb05ccf28d34e9de08439 + dirty.
Работа Claude/Codex и прежние evidence сохраняются; shared shell C не перерабатывается.

## Уточнение области владельцем

После начального получения Figma владелец поручил **только desktop**.
Tablet/mobile не согласованы, неактуальны: DEFERRED_UNAPPROVED_DESIGN,
не участвуют в визуальной приёмке. Существующая узкая вёрстка сохраняется;
проверки на ней — только регрессия, не принятие этих макетов.

## Источники и расхождение

Все исходные 33 node обнаружены на странице 523:54633 файла jN8Hhzn6ObIAEi7FoY9kPu.
Матрица и metadata/context: artifacts/frontend-v2/settings-company/Codex-R1/.
Активные desktop nodes: 529:4216, 562:5504, 562:5284, 562:5060, 564:9310,
568:7202, 568:7423, 534:4297, 534:4255, 534:4996, 534:5011.
Основной desktop актуализирован: компания1120×230 сверху, точки320 слева,
график776 справа. Остальные desktop состояния сохранили старую компоновку
компания548/точки548 сверху, график1120 снизу. Состояния реализуются в структуре
актуального основного desktop; точное совпадение геометрии старых состояний не заявляется.
Диалоговые кадры desktop — отдельные640px cards, сравнивать crop dialog.

Backend/API/ADR задают данные/права/defaults; Figma sample не runtime default.
Онбординг использует BusinessHoursFields/собственную orchestration, settings —
BusinessHoursEditor с предупреждением потери. Общие primitives не меняются.
Паттерны без точного эталона: ошибки сохранения/повтор/длинные значения/tenant race.
Существующие утверждённые UiAlert/UiSheetDialog используются без изменения masters.

## Владение

Root: SettingsCompanyPage, BusinessHoursEditor, settings-forms unit, workspace E2E,
STATUS и evidence. Worker organization: OrganizationForm и новый unit, затем handoff root.
Worker browser: новые settings-company E2E/capture/helper, затем handoff root.
QA после интеграции/снимка: read-only inputs, TEST → FUNCTIONAL.
UI только после обоих PASS, desktop; tablet/mobile DEFERRED.

## Проверки

В цикле address unit/typecheck и Chromium. Финальные npm run check, build:dev,
build:pre-prod, build:prod, audit:release и штатный test:e2e, без ослабления gates.
Stage отдельно, перед запуском revision/API hash/migration. Внешние операции не выполняются.

## S2 после проверки S1

S1 check1158/1158, build×3/audit0; fullE2E прерван ведущим для коррекции inputs,
40passed/2interrupted, exit130; это не принятие S1 и не доказанные тестовые дефекты.
Уточнены desktop pencil18px (родной размер SVG), narrow loading/copy сохраняют
прежнюю геометрию. Добавлен lifecycle guard смены рабочего пространства: подтверждение
грязного графика выполняется до очистки tenant cache/смены членства; отмена возвращает
select/focus. Guard снимается при уходе со страницы, остальные потребители прежние.
Старые изменения WorkspaceSwitcher сохраняются. Unit scope расширен на switch-workspace
и workspace-switcher, для нового перехода добавлен browser-сценарий.

WebKit long-native-select diagnosis: control box itself fit, its internal option
painting overflow propagated into the document (405px at320). Local overflow-hidden
on settings schedule selector fixes paint overflow without changing narrow layout.
Native select and card trigger receive focus before confirmation (Safari click semantics).
Narrow copy keeps its earlier hidden state when unavailable; tests distinguish it from
new desktop disabled-state. Radar mobile regression opens its existing Filters dialog
before asserting the location filter; no Radar runtime change.
Root S2 target: 48unit/51browser checks PASS, 3 stock projects, 9widths.

## S3 · исправления независимого desktop UI

S2 TEST/FUNCTIONAL frontend/mock PASS, но UI FAIL (четыре minor findings V01–04).
Исторический отчёт S2/ui-report.md сохранён. Исправлены название точки16/22,
дни недели16/22 толькоlg, desktop time left/padding14/gap12. В UiSheetDialog
добавлен opt-in desktopFormSpacing: gap24 после описания и уменьшение нижнего
padding на8, поэтому footer остаётся на месте. Применяется только к трём
settings вызовам (location create/edit, unsaved, company confirm), onboarding
получаетfalse. Остальные consumers сохраняют прежний defaultfalse, tablet/mobile
не меняются. Основной абзац подтверждения компании наdesktop теперьink.

В списке точек один status badge используется на всех размерах (lg:contents/order),
вместо двух копий одного и того же текста/условия. Это сохраняет границы бюджета
при добавлении opt-in режима общего диалога; бизнес-правила/API/данные не меняются.
График получил тот же desktop radius18, что и остальные карточки. Shared UiSheetDialog
требует повторной регрессии ключевых consumers; финальные gates повторяются наS3.

## S4 · изоляция старого polling test и computational snapshot

S3a check/build×3/audit PASS, но full E2E FAIL:706PASS/2старыхskip/1sandboxFAIL.
PROCESSING polling test ожидал2detailGET, получил3. QA адресныйповтор×5×3projects:
13PASS/2ChromiumFAIL. В обоих traces повторный/events непосредственно предшествует
общему overview/templates/list/detail refetch. Завершённый mockSSE reconnect →
разрешённый RECONNECTED resync → tenant query invalidation. Sandbox runtime/test
до этого побайтно совпадали сS2; shared dialog не причина дополнительногоGET.

S4 меняет только fixture внутри этого polling теста: стабильный открытый mock SSE.
Assertions1/1/2 иclock2999+1ms прежние, runtime/API и отдельныеreconnect tests прежние.
Это устраняет посторонний resync из сценария, который проверяет polling interval.
Все неуспешные логи/traces сохранены, они не объявленыPASS.

Новый release-plan продолжает редактироваться параллельной задачей. Это её output,
а не build/runtime/test/design/AC input текущего поручения. S3a source glob включил
его избыточно и обнаружил повторную внешнюю правку; immutable PASS не заявлялся.
S4 manifest исключает только этот активный output, как STATUS, и сохраняет отдельный
external-context hash/копию. Все вычислительные inputs, исходные инструкции,
approved design-index иstory/AC остаются в frozen manifest, включая untracked.
Полныйformat:check не исключает release-plan и не меняется. Больше этот файл root
не форматирует/не меняет; ранее применённое форматирование сохраняло MarkdownAST.

## S5 · desktop footer точных диалогов

S4 TEST/FUNCTIONAL frontend/mock PASS: check1159, build×3/audit0, full707/2прежнихskip,
independentpolling15/15, sharedconsumer14/14 иfunctional10/10. UI подтвердил закрытие
V01–04, но выявил V05: footer gap12 вместо16 и min-content длинной кнопки мешает
двум равным280px (unsaved actual≈270/294). Исторический S4 UI FAIL сохранён.

S5 использует ту же opt-in опцию форм настроек (короткое имя settingsForm,
отсутствующий Booleanprop по Vue даётfalse): толькоlg footer gap16 и min-width0
у children с прежнимflex1. Другие consumers и узкие режимы сохраняютgap12.
Косметический неиспользуемый класс company-layout удалён, дублирование badge
не возвращается; бюджеты не меняются. RootauditS5:JS905573/905600,CSS71876/72000,
initial249375/304800. Никаких правил/запросов/assertions/API изменений.

S5 check обнаружил требованиеvue/require-default-prop: даже Booleanflag нужен
explicit default. S5a возвращает settingsForm:false; правило не отключается,
поведениеfalse прежнее. ТриbuildS5 прошли, audit был остановлен, full ещё не запускался.
Для S5a повторяются обязательные gates иdesktopfooter review; V01–04 прежние.

## S6 · точное равенство outer-width footer

QA S5a trace выявил mixed secondary/primary281/279 даже послеmin-w0: border2px
secondary участвует воflexbase, primaryбезborder. S6 заменяет только opt-in/lg
footer на grid2 minmax(0,1fr),gap16: внешние ширины обеихкнопок280 независимо
отborder. Default/narrow footer остаётсяflexgap12. Вcapture всех4exactdialogs
добавлены измерения footerButtons и строгие Figma-assertions280/280,gap16
(0.1px precision). Это проверяется до независимых финальных gates.

История S5a: check/build/audit0, localworkers2fullFAIL706/2skip/1WebKitlostsubmit;
PATCHнебыло,clickpointвнутри279×46button, причина не установлена. TargetWebKit×5PASS,
serialworkers1full707/2skipPASS. ПопыткаstockCI2/2 остановленаexit130дляисправления
измеренногоV05. Событиеlostsubmit не объявленоисправленным и не скрывается.
ВS6 полныйrun выполняется сразу вштатномCIprofile CI=true:workers2/retries2 из
неизменённогоconfig, все3projects; попытки/flakycounts учитываются явно.
