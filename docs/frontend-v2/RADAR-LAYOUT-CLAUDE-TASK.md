# ТЗ Claude Code · Перенос актуального layout Radar в существующий frontend

Дата: 30.10.2026. Основание: поручение владельца собрать изменения sidebar/header,
tablet и phone в задачу для существующей схемы агентов. Это исправление уже
реализованного Radar по выбранным макетам, а не новая страница с нуля.
Настоящее поручение Codex — подготовка ТЗ; реализация начинается при передаче
стартового промпта Claude.

## 1. Цель и границы

Привести ленту Radar, деталь риска и навигационные меню к выбранной оболочке C
с последними adaptive-уточнениями: облегчённая левая навигация, workspace снизу,
профиль и настройки в хедере, новые компактные app bars/drawers, плотность phone-ленты.

Переносить только уже выбранный дизайн. Соблюдать
[DESIGN-FREEZE](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/DESIGN-FREEZE.md):
Figma не менять, новый дизайн не придумывать. C уже входит в текущие источники
radar.shellSelection; это перенос эталона в runtime. Доступ и Онбординг сохраняют
свои макеты и поведение. У G01 уже есть пользовательская приёмка: не запускать
повторно весь пилот F00–F02, но проверить затронутые регрессии.

Backend, API, OpenAPI/generated, миграции, роли, lifecycle, деньги и бизнес-правила
не менять. Новые библиотеки и правки lockfile для этой задачи не нужны.
Не тиражировать новую оболочку на Настройки/Admin/Диалоги/Аналитику/Интеграции
только потому, что AppShell общий. Эти разделы — область регрессионной проверки,
а их отдельный дизайн-rollout не входит в поставку. При необходимости изолировать
Radar-вариант на существующей route/layout-границе без второго приложения/глобального store.

Срез подготовки: ветка frontend/v2-implementation, HEAD
4e175e914719f380dcadb05ccf28d34e9de08439. US-M02-04 уже включён в этот HEAD;
старые отчёты со срезом 3870d65 не описывают текущий код. Есть чужие dirty
документы и evidence. Перед запуском сверить HEAD/status/untracked, сохранить всё;
не делать reset/stash/checkout поверх работы. Не запускать двух авторов AppShell.
Никаких push/deploy/merge без отдельного поручения.

## 2. Источники и приоритет

- [CLAUDE.md](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/CLAUDE.md), [STATUS](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/STATUS.md),
  [WORKFLOW](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/WORKFLOW.md),
  [SOURCES](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/SOURCES.md),
  [RELEASE-SCOPE](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/RELEASE-SCOPE.md).
- [Существующая схема Claude](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/CLAUDE-OPERATING-RULES.md),
  [настройки](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/.claude/settings.json),
  [QA](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/.claude/agents/lidradar-qa.md),
  [UI](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/.claude/agents/lidradar-visual-review.md),
  [шаблон brief](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/CODEX-TASK-BRIEF.md).
- [DESIGN](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/DESIGN.md), [архитектура](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/architecture.md),
  [тестирование](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/testing.md),
  [design-index](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/design-index.json):
  radar.shellSelection.currentSourceAvailability, adaptiveRework,
  adaptiveRework.userRefinement, desktopLogout и appliedFrames.
- [Перенос C](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/evidence/radar-shell-c-2026-10-30.md),
  [новые tablet/phone](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/evidence/radar-adaptive-rework-2026-10-30.md),
  [последние уточнения](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/evidence/radar-adaptive-refinement-2026-10-30.md),
  [desktop-выход](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/evidence/radar-desktop-logout-2026-10-30.md),
  [rollout основных макетов](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/evidence/radar-layout-rollout-2026-10-30.md).
- [US-M07 — Radar/риски](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar/docs/user-stories/16-radar-risks.md):
  US-M07-04–08, US-M07-11 — существующие действия, фильтры и состояния.
  [US-M01-03/08](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar/docs/user-stories/10-access.md) — выход и организации;
  [US-M16-01–06](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar/docs/user-stories/25-cross-cutting.md) — изоляция,
  realtime/offline, адаптивы, браузеры и клавиатура.
- Связанные неизменяемые контракты:
  [действия/исходы](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar/docs/user-stories/17-actions-outcomes.md),
  [выручка](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar/docs/user-stories/18-revenue.md),
  [frontend OpenAPI](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/contracts/openapi.yaml),
  [происхождение контракта](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/contracts/source.json).

Это межмодульная визуальная правка Radar, новая продуктовая US не создаётся.
Ниже AC-RADAR-LAYOUT-* — локальные критерии данной поставки, дополняющие
существующие US. Они не заменяют их бизнес-AC.

Последние решения владельца → принятые US/ADR/API/RELEASE-SCOPE для поведения →
актуальные выбранные Figma nodes для визуала → код и исторические отчёты.
В SOURCES/старых evidence остались ссылки на 1026/1050 и другие удалённые
proposals/обзоры: использовать их только как историю. Текущие источники —
канонические кадры ниже. Отдельная UI Kit App/Slot-концепция не входит в задачу.

## 3. Точная карта макетов

Файл [LidRadar](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=21-2), страница 21:2 «03 · Радар».
30.10.2026 выполнена read-only live-сверка: все 23 root IDs существуют.
[Сохранённая геометрия и карта](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/radar-layout-task-2026-10-30/source-map.json).

| Figma node                                                                                  | Название в Figma                                                | Размер документа |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------- |
| [27:2765](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=27-2765)     | Radar · Apple HIG · Плитки · 1440 × 1000 · Прокрутка            | 1440 × 1000      |
| [21:1825](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=21-1825)     | Radar · Apple HIG · Список · 1440 × 1000 · Прокрутка            | 1440 × 1000      |
| [21:1982](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=21-1982)     | Radar · Apple HIG · Плитки · Полная лента                       | 1440 × 2100      |
| [21:1753](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=21-1753)     | Radar · Apple HIG · Список · 12 рисков · Полная лента           | 1440 × 2808      |
| [199:11280](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=199-11280) | Риск · Нет ответа клиенту · Apple HIG · 1440                    | 1440 × 1875      |
| [220:2548](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=220-2548)   | Риск · 1440 × 1000 · Исходное · Apple HIG                       | 1440 × 1000      |
| [226:8826](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=226-8826)   | Риск · 1440 × 1000 · Ошибка записи действия · Apple HIG         | 1440 × 1000      |
| [226:9036](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=226-9036)   | Риск · 1440 × 1000 · Записываем действие · Apple HIG            | 1440 × 1000      |
| [226:9242](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=226-9242)   | Риск · 1440 × 1000 · Плейсхолдеры · Первая загрузка · Apple HIG | 1440 × 1000      |
| [630:6182](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=630-6182)   | Radar · Полная лента · Плитки · Tablet · 834                    | 834 × 2944       |
| [630:6708](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=630-6708)   | Radar · Полная лента · Список · Tablet · 834                    | 834 × 3376       |
| [630:7204](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=630-7204)   | Radar · Полная лента · Плитки · Mobile · 390                    | 390 × 5209       |
| [630:7726](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=630-7726)   | Radar · Полная лента · Список · Mobile · 390                    | 390 × 5209       |
| [220:2755](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=220-2755)   | Риск · 834 × 1194 · Исходное · Apple HIG                        | 834 × 1194       |
| [226:10670](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=226-10670) | Риск · 834 × 1194 · Ошибка записи действия · Apple HIG          | 834 × 1194       |
| [226:10838](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=226-10838) | Риск · 834 × 1194 · Записываем действие · Apple HIG             | 834 × 1194       |
| [226:11002](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=226-11002) | Риск · 834 × 1194 · Плейсхолдеры · Первая загрузка · Apple HIG  | 834 × 1194       |
| [220:2970](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=220-2970)   | Риск · 390 × 844 · Исходное · Apple HIG                         | 390 × 844        |
| [226:10126](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=226-10126) | Риск · 390 × 844 · Ошибка записи действия · Apple HIG           | 390 × 844        |
| [226:10293](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=226-10293) | Риск · 390 × 844 · Записываем действие · Apple HIG              | 390 × 844        |
| [226:10456](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=226-10456) | Риск · 390 × 844 · Плейсхолдеры · Первая загрузка · Apple HIG   | 390 × 844        |
| [630:8277](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=630-8277)   | Навигация Radar · Tablet                                        | 834 × 1194       |
| [630:8361](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=630-8361)   | Навигация Radar · Mobile                                        | 390 × 844        |

Базовые browser viewport: desktop 1440×1000, tablet 834×1194, phone 390×844.
Высота full-feed документа 2100/2808/2944/3376/5209 — не высота browser viewport.
Длинные ленты и детали проверять также ниже первого экрана.

Точные составные источники:
[desktop sidebar 27:2766](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=27-2766),
[desktop header 27:2809](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=27-2809),
[tablet app bar 1048:9337](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=1048-9337),
[phone app bar 1048:9359](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=1048-9359).
Их геометрия сверена live. Достать свойства/ассеты только нужных узлов, не весь файл.
Перед get_design_context загрузить figma-design-to-code, перед use_figma — figma-use.

Существующие reference PNG и hashes искать в каталогах artifacts/frontend-v2/
radar-layout-rollout-2026-10-30/, radar-desktop-logout-2026-10-30/ и
radar-adaptive-rework-2026-10-30/refinement-1/. Прежние PNG с теми же root IDs
могут отражать старую оболочку. Зафиксировать актуальность каждого reference;
при расхождении — точечно получить свежий экспорт текущего канонического node.
Не переиспользовать source-adaptive.png как живой node удалённого overview.

## 4. Что исправить

### Desktop

- Sidebar шириной 240 px. Четыре существующих раздела в единой белой панели,
  тонкие разделители, мягкое выделение Radar, прежние route/permission guards.
  Desktop labels 14/20. Выбранный Radar остаётся выбранным и в детали риска.
- Workspace внизу, inset 24 px. В текущем sidebar 27:2789 внешний блок 192×55:
  divider 1 px и внутренняя карточка/контент 192×42 ниже на 13 px.
  Не путать высоту внутреннего блока с внешней. При коротком окне/длинном
  названии разрешить рост/прокрутку без наложения на nav и потери переключателя.
- Убрать из Radar-sidebar профиль, подпись роли и старое размещение настроек.
  Не добавлять Telegram-status card или город из timezone.
- В рабочей области header x40/y32, 1120×44 при ширине 1440:
  контекст слева; справа дата/время/пояс, имя, прозрачная ссылка «Аккаунт →»,
  settings-icon, divider и plain «Выйти».
  Контекст/дата 12/18, имя/аккаунт/выход 14/20.
- Settings glyph 20×20 внутри target 44×44, с доступным именем и tooltip.
  После него divider 1×20 #CCCCD1, «Выйти» #4D5159 с target 64×44,
  без фоновой заливки и рамки. Сохранить существующий logout-контроллер,
  busy/ошибки/неподтверждённый выход и event propagation до ShellLayout.
- Новый header присутствует и в ленте, и в detail normal/error/saving/loading;
  контекст не дублируется одновременно в AppShell и странице.

### Tablet

- App bar 72 px, внутренние горизонтальные отступы 32 px при 834.
  Меню и бренд слева, полное имя, прозрачная ссылка «Аккаунт →» и settings справа.
  Account target 93×44, без рамки/заливки: старый белый outlined-вариант отменён.
- Контекст и полная дата/время/пояс отдельной строкой ниже app bar.
  Content x32, ширина770. Контекст y24 относительно content; между основными
  секциями 24 px по текущему feed. Не переносить phone-плотность на tablet.
- Drawer 360 px при viewport834, не fullscreen-dialog.
  Один бренд в шапке72, close target44, строки nav52 и labels17/24.
  Нижний workspace68, inset24. Сохранить scrim, закрытие, навигацию и switch.

### Phone

- App bar64, внутренние горизонтальные отступы16 при390.
  Меню/бренд слева, круглый аккаунт44×44 с инициалами и settings44×44 справа.
  Ссылка аккаунта ведёт в существующий account route.
  Полное доступное имя: «Аккаунт, <displayName>»; инициалы вычислять из реального
  имени, не хардкодить «МВ». Цвет #0071E3 на #FFFFFF (эталонный контраст4.70:1).
- Контекст и полная дата ниже app bar, content x16/width358, старт y16
  относительно content. На390 эталонная строка вмещается; при длинных данных/320
  переносить с ростом высоты, не обрезать важные действия и не наезжать на дату.
- Компактная сводка: счётчик рисков сверху, два финансовых показателя рядом
  ниже; уменьшенные padding и интервалы между секциями16. Значения/подписи,
  null/unknown и валюты прежние. Не перерисовывать RiskCard.
- Переключателя «Список / Плитки» на phone нет, включая keyboard/a11y tree.
  Сортировка, кнопка фильтров и status tabs остаются. Сохранённое desktop/tablet
  list preference не стирать; на phone обе прежние формы дают карточки,
  после расширения прежнее выбранное представление возвращается.
- Drawer344 при390, шапка72, rows52, labels17/24, workspace68/inset24.
  На320 панель ограничить доступной шириной, сохранить reachable close.
  Длинное меню прокручивается, footer не перекрывает пункты.
- В detail использовать ту же компактную app bar вместо старого текстового
  «Меню»/шапки80. Сохранить «К рискам», refresh и состояния рабочих операций.
  y178 первой карточки detail и y645 первой карточки feed — ориентиры
  конкретной Figma fixture, не абсолютные top для любого контента.

Полное имя в phone Radar заменяется доступной account-кнопкой по выбранному
макету. Это не отменяет видимое имя в первом шаге онбординга:
US-M01-01 AC-G07 / существующий T25 остаются без изменений.
Не менять AccountHeader глобально, чтобы воспроизвести phone Radar.

Для compact-выхода и platform-admin entry не придумывать новый экран/право:
сохранить доступность существующего пути через account/действующую навигацию.
Перед удалением старого SidebarBody-блока проверить фактическую достижимость
этих действий для обычного пользователя и platform admin, включая прямой URL.

## 5. API и поведение сохранить

- В Figma остаются демонстрационные числа на вкладках, HIGH-count и
  «Подтверждено оплатами · за 7 дней». Их не копировать вопреки RELEASE-SCOPE:
  status tabs без чисел, допустимы только реальные active/critical counters;
  подтверждённо возвращённая выручка — «За всё время», существующий API.
- Контекст workspace/location, количество точек, имя, currency/timezone брать
  из существующих данных. «2 точки» и «23 октября2026 ·15:40МСК» — fixture,
  не runtime constants. Часовой пояс организации не заменять МСК везде.
  Loading/error не превращать в ноль, текущую дату или подтверждённый статус.
- Сохранить URL-фильтры, status→API mapping, сортировку, pagination/cursor,
  back/detail/reload, auto/manual refresh, offline/stale и permissions.
- WorkspaceSwitcher перемещается визуально; смена tenant, очистка/изоляция
  cache и игнорирование поздних ответов сохраняются. Один workspace — без
  фиктивного selector, несколько — рабочее переключение.
- Баннеры подтверждения email/удаления аккаунта/настройки и реальные ошибки
  сохраняются. Макет без баннера не разрешает удалять runtime-состояния.
  Не показывать статус Telegram из onboarding.facts.liveConnections.
- Общие UiDialog/UiSheetDialog и ранее исправленная ловушка WebKit не должны
  регрессировать. Для drawer сохранить modal semantics, inert background,
  scroll lock, Escape/close/outside по принятому поведению, начальный/возвратный
  фокус и невозможность Tab уйти в фон.

## 6. Карта существующего кода и владение

Основная сессия — единственный автор runtime/tests/config/STATUS.
Сначала карта «критерий → уже есть / изменить / проверить»; не переписывать
query/model слой ради расположения блоков.

| Файл/область                                                                                                                                                                                                                                                                                                                                                                       | Задача и граница                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [AppShell.vue](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/widgets/app-shell/ui/AppShell.vue), [ShellLayout.vue](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/app/layouts/ShellLayout.vue)                                                                                                                                          | Shell-вариант Radar, app bars/drawer, единственный owner контекста/header; сохранить banners/events/остальных потребителей.                      |
| [SidebarBody.vue](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/widgets/app-shell/ui/SidebarBody.vue), [SidebarNav.vue](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/widgets/app-shell/ui/SidebarNav.vue), [navigation.ts](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/widgets/app-shell/model/navigation.ts) | Облегчить Radar-nav и перенести workspace вниз; не менять правила видимости или добавлять несуществующие маршруты.                               |
| [WorkspaceSwitcher.vue](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/features/select-workspace/ui/WorkspaceSwitcher.vue)                                                                                                                                                                                                                                    | Переиспользовать действующий контроллер; компактное представление при необходимости, без нового switch API.                                      |
| [RadarPage.vue](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/pages/radar/ui/RadarPage.vue), [RadarSummary.vue](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/widgets/radar-summary/ui/RadarSummary.vue), [RiskFeed.vue](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/widgets/risk-feed/ui/RiskFeed.vue)        | Устранить дубли контекста, перенести header, плотность и phone toolbar; API/model/карточки сохранить.                                            |
| [RiskPage.vue](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/pages/risk/ui/RiskPage.vue), [RiskWorkspace.vue](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/widgets/risk-workspace/ui/RiskWorkspace.vue)                                                                                                                               | Применить shell в детали и всех её состояниях; сохранить back/refresh/команды и верхний ритм.                                                    |
| [AccountHeader.vue](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/widgets/account-header/ui/AccountHeader.vue)                                                                                                                                                                                                                                               | Регрессионная граница: не переносить Radar-initials в доступ/онбординг.                                                                          |
| [UiDialog.vue](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/shared/ui/UiDialog.vue), [main.css](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/app/styles/main.css)                                                                                                                                                                    | Общие primitives/tokens менять лишь при необходимости; не ломать существующую focus-логику и не менять глобальные spacing/colors под один экран. |
| [visual mapping](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tooling/visual/pairs.json), [capture](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tooling/visual/capture.spec.ts)                                                                                                                                                             | Точные node/state/fixture для нового Radar; историю evidence и unrelated baselines сохранять.                                                    |

Новые небольшие представления допустимы внутри существующих FSD slices.
Не создавать копии session/auth/tenant-query или сквозную систему shell variants
для всех разделов. Shared primitives/exports/общие файлы у ведущего.

## 7. Критерии приёмки поставки

| ID                 | Проверяемый результат                                                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-RADAR-LAYOUT-01 | На1440 sidebar240, белая nav-панель, разделители/selected Radar; workspace снизу inset24, профиль/роль/settings не дублируются слева.                                      |
| AC-RADAR-LAYOUT-02 | Desktop header соответствует27:2809: контекст/дата/имя/аккаунт/settings/divider/выход; нет дубля context и горизонтального overflow.                                       |
| AC-RADAR-LAYOUT-03 | На834 app bar72, имя и прозрачная account-ссылка, отдельный context/date; отступы32 и tablet-ритм соответствуют630:6182/6708.                                              |
| AC-RADAR-LAYOUT-04 | На390 app bar64, account initials и settings44; accessible account-name содержит полное реальное имя; нет hardcoded dataset.                                               |
| AC-RADAR-LAYOUT-05 | Phone сводка и toolbar компактны; финансовые колонки рядом; интервал16; все действующие значения/unknown/подписи сохранены.                                                |
| AC-RADAR-LAYOUT-06 | На phone нет view-switch и focusable скрытых кнопок; сортировка/фильтры/status доступны; resize сохраняет list/tiles preference desktop/tablet.                            |
| AC-RADAR-LAYOUT-07 | Drawers360/344 при834/390, шапка72, rows52 и workspace68/inset24; на320/низком окне ничего не теряется и footer не перекрывает nav.                                        |
| AC-RADAR-LAYOUT-08 | Меню открывается/закрывается клавиатурой/close/Escape/принятым scrim-click; focus внутри, возвращается на trigger; фон не скроллится и не получает focus.                  |
| AC-RADAR-LAYOUT-09 | Те же header/sidebar доступны в risk normal/command-error/saving/initial-loading на трёх адаптивах; back/refresh и остальные команды сохранены.                            |
| AC-RADAR-LAYOUT-10 | Account/settings/logout и platform-admin path достижимы по прежним правам; no duplicate logout, двойной submit и error/unconfirmed logout обработаны прежним контроллером. |
| AC-RADAR-LAYOUT-11 | Один/несколько workspace, длинные имена, switch/late response не смешивают tenant; loading/error count не показан как0 или чужой count.                                    |
| AC-RADAR-LAYOUT-12 | URL filters/status/cursor/back/reload/refresh/empty/error/forbidden/offline/stale работают по прежним US/API; нет новых endpoint.                                          |
| AC-RADAR-LAYOUT-13 | Нет чисел на status tabs/выдуманного HIGH, города из timezone или ложного Telegram health; денежные подписи и значения соответствуют RELEASE-SCOPE.                        |
| AC-RADAR-LAYOUT-14 | Настройки/Admin/прочие потребители AppShell не получают непредусмотренный layout; access/onboarding, G07/T25 и исправления US-M02-04 не регрессировали.                    |
| AC-RADAR-LAYOUT-15 | На320/390/834/1440, промежуточных breakpoint и200% zoom нет горизонтального scroll всей страницы/потери действий; длинные данные и short viewport проверены.               |
| AC-RADAR-LAYOUT-16 | Видимый focus/tooltip, доступные имена/aria-current, contrast и targets проверены; WebKit/Chromium/mobile не теряют focus в menu и вложенных controls.                     |
| AC-RADAR-LAYOUT-17 | TEST, затем FUNCTIONAL и UI desktop/tablet/phone подтверждены на одном snapshot; final gates проходят без ослабления budgets/assertions/coverage/browser matrix.           |

## 8. Тесты и схема агентов

Существующие три участника: **основная сессия Claude Sonnet + lidradar-qa Sonnet

- lidradar-visual-review Sonnet**. Не создавать новую конфигурацию, legacy
  us-m01-* роли, отдельного менеджера, три UI-агента или вложенных агентов.
  Opus автоматически не запускать.

1. Основная сессия сверяет scope/current code, сохраняет baseline и чинит runtime
   вместе с регрессионными тестами. Передаёт brief, relevant diff, точные AC,
   node map, manifest HEAD+SHA-256 всех inputs включая untracked, evidence paths.
2. На замороженном снимке lidradar-qa выполняет **TEST**, после PASS — отдельно
   **FUNCTIONAL** по17 критериям и затронутым US. Reviewer пишет только выделенные
   логи/отчёт в artifacts, не меняет src/tests/config/baselines.
3. Только после обоих PASS lidradar-visual-review просматривает готовые
   reference/actual/diff: отдельные desktop/tablet/mobile verdict. Реальный
   просмотр изображений обязателен; измерения/pixel diff его не заменяют.
4. Finding возвращается ведущему; исправление → новый snapshot → затронутые
   проверки и финальные gates. Во время приёмки inputs не меняются.
   Один владелец browser/capture/preview, suites на одном порту не параллелить.

Адресные регрессии выбрать/добавить в существующих
[workspace.spec.ts](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tests/e2e/workspace.spec.ts),
[responsive.spec.ts](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tests/e2e/responsive.spec.ts),
[access.spec.ts](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tests/e2e/access.spec.ts),
[workspaces.spec.ts](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tests/e2e/workspaces.spec.ts),
[onboarding.spec.ts](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tests/e2e/onboarding.spec.ts),
[risk-feed.test.ts](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tests/unit/widgets/risk-feed.test.ts),
[radar-summary.test.ts](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tests/unit/widgets/radar-summary.test.ts),
[switch-workspace.test.ts](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tests/unit/features/switch-workspace.test.ts)
и подходящих component-тестах shell. Проверять поведение, не классы,
повторяющие реализацию. Старые locators/sidebar-профиль корректировать только
если изменился утверждённый путь, сохраняя смысл assertions.

Матрица visual: все23 sources в source-map и явное покрытие новым состоянием/
общим проверенным shell. Captures: D tiles/list, T tiles/list, phone cards
в том числе сохранённый list preference; detail normal/error/saving/loading
×3; tablet/phone menu; account/settings transitions, длинный workspace/name,
320 и200% zoom. Каждый кадр привязать к node+viewport+fixture. Проверить верх,
низ длинной страницы и нижний workspace. Для одинаковой геометрии reuse одного
reference допустим с явным mapping, а не отдельным непроверенным PASS23/23.
Реальные даты/метрики не маскировать целиком; использовать детерминированные
fixtures с сохранением API-ограничений.

Во время реализации адресные unit/E2E и typecheck. На финальном снимке Node
24.19.0 из .nvmrc; команды из WORKFLOW: npm run check; build:dev,
build:pre-prod, build:prod; npm run audit:release; npm run test:e2e
со штатной browser matrix. Browser focus проверять в Chromium и WebKit,
а не только jsdom. Не добавлять skipped/ослабленные проверки ради PASS.

Бюджеты прежние: totalJs905600 B, initialLoad304800 B, CSS72000 B,
entry/largestChunk110100 B. Перед началом измерить текущую production-сборку
и сверить закрытие прежнего B-01; старые R7-числа не считать текущими.
Не повышать budgets и не менять checker. Само lazy-разбиение не сокращает totalJs.
Если исходный gate уже FAIL, показать before/after и причину, не объявлять
релизную готовность. Чужие format/lint failures фиксировать отдельно без правок
чужих документов только ради зелёного результата.

Live QA — отдельное evidence через npm run dev:stage и существующий proxy,
после revision/OpenAPI readiness gate; использовать разрешённые synthetic
accounts. Не поднимать/не менять backend, не сбрасывать данные/лимиты,
не печатать secrets. Нет доступного stage — соответствующее UNVERIFIED;
mock/frontend PASS не называть живым API PASS.

## 9. Результат и handoff

Создать новый каталог artifacts/frontend-v2/radar-layout/Claude-R1/
(если занят — следующий номер), компактный tracked отчёт в
docs/frontend-v2/evidence/radar-layout/Claude-R1/handoff.md и обновить STATUS.
Исторические Radar/US-M02-04 evidence не перезаписывать.

Итог: критерий → реализация → тест/evidence → verdict; список файлов и relevant
diff, HEAD/dirty inputs hashes, source-map с reference SHA-256 и временем экспорта,
команды/exit codes, размеры bundles до/после, отдельные TEST/FUNCTIONAL/UI
desktop/tablet/mobile, stage status, remaining findings и следующий шаг.
Непроверенное — UNVERIFIED; старые CANVAS PASS не являются runtime UI PASS.
Не заканчивать одной схемой/планом при переданном разрешении реализации.

## 10. Стартовый промпт для Claude

Работай в /Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front.
Исправь существующий Radar по ТЗ docs/frontend-v2/RADAR-LAYOUT-CLAUDE-TASK.md:
перенеси текущую оболочку C и последние tablet/phone layouts, включая risk detail
и drawers. Сохрани текущие исходники и evidence. Backend/API/Figma не менять,
budgets не повышать. Используй существующую схему: основная сессия Sonnet пишет
код и тесты → lidradar-qa выполняет TEST, затем FUNCTIONAL → после обоих PASS
lidradar-visual-review проверяет desktop/tablet/mobile на том же snapshot.
Начни с git status/HEAD и карты AC → есть/исправить/проверить, затем реализуй,
пройди gates и подготовь handoff. Источники,23 точных Figma nodes, границы,
регрессии и критерии находятся в ТЗ.
