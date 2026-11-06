# Общая оболочка разделов · Codex R1

Поручение от 31.10.2026: «Диалоги», «Аналитика», «Интеграции» и «Настройки»
получают принятую оболочку Radar: новый левый sidebar и header.

**ML-S2: TEST и отдельный FUNCTIONAL frontend/mock scope — PASS.
UI desktop/tablet/mobile — PASS.** Недостающие payments-state кадры досняты,
полный input inventory исправлен, финальные gates повторены на ML-S2.
Общий release gate пока FAIL по прежним внешним format/lint причинам.
Этот handoff не является разрешением выпуска.

Область касается оболочки маршрутов F05/F06: M05/M12/M13 и
M03/M04/M10/M11/M14. Полная приёмка бизнес-сценариев этих модулей не заявляется.

## Реализация и границы

- Существующий `RadarShell` подключён через route meta к списку и детали
  диалога, аналитике, интеграциям, входу настроек и всем шести вкладкам.
- Desktop: sidebar 240 px, workspace внизу; профиль, аккаунт, настройки и
  выход в header. На tablet/phone сохранены app bars 72/64 px, drawer 360/344 px.
- Активный раздел учитывает деталь диалога. Во всех settings-вкладках выбрана
  шестерёнка, а четыре главных пункта нейтральны.
- Контекст диалогов включает точку либо «Все точки»; аналитика и интеграции
  показывают организацию; настройки — организацию / Настройки без дубля.
  Дата использует timezone организации; в общей шапке настроек её нет.
- Предупреждения realtime offline/backoff, email и удаления аккаунта сохранены.
  Содержимое разделов, формы, фильтры, права и переключение workspace сохранены.

Backend/API/generated, budgets, lockfile, browser matrix и Figma не менялись.
Доступ, онбординг, отдельные plain layouts и platform Admin не переводились
на эту оболочку. Исходники Claude и предыдущие исправления Radar/US-M02-04
сохранены. Commit/push/deploy/merge не выполнялись.

Основные файлы:

- `src/app/router/routes.ts`, `meta.d.ts` — явное подключение оболочки к маршрутам.
- `src/widgets/app-shell/ui/RadarShell.vue`, `AppShell.vue`,
  `model/navigation.ts` — общий header, контекст, выбор раздела и предупреждения.
- `src/pages/settings/ui/SettingsPageHead.vue` — устранён повтор контекста.
- `tests/e2e/module-shell.spec.ts`, `workspace.spec.ts`,
  `tests/unit/widgets/app-shell.test.ts` — новые регрессии и обновлённый локатор
  настроек Manager с сохранением проверок прав.
- `tooling/visual/module-layout.capture.spec.ts` и artifact supplemental harness —
  воспроизводимые кадры; `relevant.diff` содержит точную дельту к R4, включая untracked.

## Снимок и источники

ML-S2: HEAD `4e175e914719f380dcadb05ccf28d34e9de08439` + dirty tree,
685 входов, manifest SHA-256
`5baf3b2458f93e762a1fa3aff76e7fd612b9d2d5175830916cf82202d8afa8e8`.
Runtime/tests не менялись относительно ML-S1: добавлен 31 input полного
inventory, включая index/public/root configs и три capture helpers. Ранее 21
build/config файл не был включён в source manifest; все они git-clean и совпали
с HEAD. Это исправление доказательств, не новая реализация.
Архив `inputs-ML-S2.tar.gz` не содержит opaque env/npm/MCP config: их digests
зафиксированы отдельно без раскрытия содержимого.

Исторический ML-S1: тот же HEAD,
654 входа, manifest SHA-256
`aae9b8b77679dbc74a6c34858e2d3076cd91426f9e91b0a96bee30e2840be3c9`.
Перед началом совпали 651/651 вход предыдущего US-M02-04 R4.
Relevant diff относительно R4 затрагивает 11 входов; STATUS/handoff — объявленные
reporting exclusions. Source archive `inputs-ML-S1.tar.gz`.

[Scope и ML-01–14](scope.md). Канон — approved frames из design-index и
сохранённые exports переноса оболочки от 30.10.2026. Чтение MCP подтвердило
sidebar `27:2766`, header `27:2809`, app bars `1048:9337` / `1048:9359`.
Переиспользованы существующие Vue-компоненты, токены и иконки Radar/UI Kit.

Артефакты: `artifacts/frontend-v2/module-layout/Codex-R1/`.
`capture-R1/`:157 viewport PNG из 90 прошедших capture-сценариев; Chromium
153.0.8010.12, ru-RU, Europe/Moscow, DPR1. Есть focus/drawer, detail, все settings
tabs, loading/error/empty, 320 и границы 767/768/1023/1024, длинные имена и
эквивалент reflow200%. Metadata не выявила горизонтального переполнения.
`reference-files.json`:21 approved export, `compare/`:28 reference/actual/diff
регионов, `visual-manifest.json`:422 визуальных входа.

S2: `visual-manifest-S2.json` включает 598 файлов, SHA
`0823885ce3626be4925ad8723092c96d3525d1f576aa7b02046676371d112e70`.
Прежние 422+10 неизменны; добавлены 69 PNG из 21 прошедшего supplemental case:
видимые payments loading/error/empty на трёх адаптивах, full-page и viewport
списка из 24 контактов/40 сообщений, older-message loading, Settings edit overlay
и PATCH busy, Integrations connect overlay и POST busy. Это синтетические
удержанные запросы без внешнего сервиса. Analytics и диалоги — read-only:
save-overlay/composer для них не придумывались.

Metadata дополнительных кадров ссылается на исходный ML-S1/runtime654 cohort,
который не менялся; S2 дополнительно фиксирует зависимости capture helpers.

Визуальное сравнение ограничено оболочкой и её взаимодействием с содержимым.
Старое содержимое четырёх разделов не переделывалось по демонстрационным телам
Figma; динамические имена, время и счётчики не заменялись демо-значениями.

## Проверки

Финальные результаты ML-S2; результаты, переиспользованные с неизменного
ML-S1, явно указаны:

| Проверка                                              | Exit | Результат                                             |
| ----------------------------------------------------- | ---- | ----------------------------------------------------- |
| Адресные unit                                         | 0    | 12/12                                                 |
| module-shell E2E в трёх проектах                      | 0    | 54/54                                                 |
| Capture                                               | 0    | 90/90, 157 PNG                                        |
| Source format/lint, FSD, API, typecheck, architecture | 0    | Пройдены                                              |
| Coverage                                              | 0    | 1121/1121                                             |
| Build dev/pre-prod/prod                               | 0    | Пройдены                                              |
| audit:release                                         | 0    | Все бюджеты и контракт в норме                        |
| Полная E2E-матрица                                    | 0    | 578 passed, 32 прежних skipped, 0 failed/retry        |
| G07/F03 повтор в отдельном output root                | 0    | 15 passed, 24 новых PNG; контрольные данные сохранены |
| Отдельные FUNCTIONAL runtime probes                   | 0    | 12/12 в Chromium/WebKit/mobile                        |

Coverage, builds, audit и полный E2E прогнаны заново на S2. Адресные unit12,
target54, дополнительный G07/F03 run15 и 12 FUNCTIONAL probes относятся к S1:
их consumed inputs и evidence неизменны; все 54 module cases и G07/F03 также
прошли в свежем полном S2 suite. Supplemental capture21/21 прошёл root,
QA отдельно подтвердил его семантику: 69 PNG, 21 audit PASS, шесть ожидаемых
mock-held mutations, ноль неожиданных, 112 уникальных валидных UUID.
Все 106 production-файлов S2 побайтно равны S1.

Production: JS879144/905600, initial248910/304800, CSS68852/72000,
entry67890/110100, largest76075/110100. R4 baseline: JS878461,
initial248756, CSS68893; изменения +683/+154/−41 байт. Admin вне initial.

FUNCTIONAL подтвердил locationId, timezone/day rollover, переходы/back/reload,
выбор детали диалога, gear всех шести вкладок после загрузки организации,
права Manager, закрытие drawer по переходу, чтение без API mutations и сохранность
системных баннеров. Независимый UI reviewer после обоих PASS просмотрел все 69
новых PNG и повторно использовал собственный просмотр неизменных S1 кадров и
28 reference/actual/diff triples. Тип сравнения shell — approved-pattern,
восьми drawer — exact-frame. Отдельные desktop/tablet/mobile PASS; новых
блокирующих замечаний переноса нет. Итог сохранён в `UI-report.md`.
Все 685 inputs, 598 visual files и 580
historical PNG (SHA-256/mtime_ns/size) совпали после тестов и функциональной
проверки S2. Подробности и commands/exit codes: `qa-S2/report.md`,
`qa-S2/commands.json`; исторический отчёт S1 сохранён в `qa/report.md`.

Low N-ML-01: на 320 px при длинных данных и двух системных баннерах прежний
EmailVerificationBanner даёт scrollWidth321. За viewport выходит 0.578125 px
прозрачного padding action row; текст/кнопки видны. То же воспроизведено на
Radar, компонент не менялся. Строгая диагностическая проверка 0 px сохранена как
FAIL; штатные assertions не ослаблялись. Это небольшое замечание вне переноса
оболочки, не новое перекрытие header/sidebar. Дополнительные 10 файлов в
`visual-supplement.json` доступны UI reviewer.

Прежняя обрезка года в двух date-input аналитики на 320 px подтверждена
сопоставимыми PNG восстановленной R4 и текущего runtime: одинаковые width115,
x37/168; y292→315 отражает другую шапку. `date-baseline/` содержит PNG+metadata.
Изолированная R4 сборка воспроизвела прежние размеры JS878461/initial248756/
CSS68893/entry67736/largest76245. Тело аналитики не менялось.
Собранный baseline сохранён в `r4-baseline-dist.tar.gz`; временный checkout
удалён после архивации, порты 4173/4174 освобождены.

Общий `check` exit1 на прежних пяти
документах m02-step4; full lint exit1 на ignored artifacts, source lint exit0.
Эти внешние причины не исправлялись в рамках переноса.

Live stage, нативное масштабирование macOS и OS select — UNVERIFIED.
720×500 CSS viewport проверяет reflow, эквивалентный 1440×1000 при200% zoom.

Финальная сверка `completion-manifest.json`: все 685 source, 598 visual inputs
и 580 защищённых PNG неизменны; mismatch списки пусты. Собственные STATUS,
scope и handoff прошли Prettier, `git diff --check` — exit0. Следующий шаг перед
выпуском — исправить отдельные внешние format/lint gates и выполнить разрешённый
живой stage QA. Перенос общей оболочки завершён.
