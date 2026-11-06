# Компания и график · desktop · итог S6

31.10.2026. **US-M02-05/06: TEST PASS, FUNCTIONAL PASS (frontend/mock), desktop UI PASS.**
Tablet/mobile redesign и его UI-приёмка отложены по последнему поручению владельца:
макеты не согласованы и неактуальны. Узкие экраны проверены только как регрессия.
Stage и реальные операции — **UNVERIFIED**. Общий продуктовый release PASS не заявляется.

## Что изменилось

Компания расположена сверху, ниже — выбор точки слева и её график справа.
Сохранена оболочка C. Компания сохраняется отдельно с подтверждением валюты/пояса;
точки создаются и редактируются, активность и выбранный график работают.
Недельный редактор сохраняет всю неделю, проверяет время, копирует первый рабочий
интервал только в рабочие дни. Есть первоначальная загрузка, обновление с сохранением
данных, ошибка и повтор, пустой список, busy и ошибки всех сохранений.

Синхронные submit locks защищают от повторной команды. Контекст команды фиксируется
до async validation; поздние ответы другой организации не меняют текущую форму.
Обновление данных не стирает редактируемую неделю. Смена точки, маршрута и workspace
с несохранённым графиком подтверждается до сброса данных; отмена возвращает фокус.
Онбординг сохраняет собственные правила черновиков и POST → PUT.

Опция общего UiSheetDialog `settingsForm: false` по умолчанию включает новый ритм
и равные кнопки только для desktop-форм настроек. Остальные потребители и узкие
режимы сохраняют прежнюю компоновку. V01–V05 независимого UI-review закрыты.

## Файлы этого поручения

Чужие прежние dirty/untracked изменения в перечисленных и остальных файлах сохранены.

| Область               | Файлы                                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Страница              | `src/pages/settings/ui/SettingsCompanyPage.vue`                                                                                          |
| Компания              | `src/features/edit-organization/ui/OrganizationForm.vue`                                                                                 |
| Неделя                | `src/features/edit-business-hours/ui/BusinessHoursEditor.vue`                                                                            |
| Диалог точки          | `src/features/manage-locations/ui/LocationFormDialog.vue`                                                                                |
| Смена организации     | `src/features/select-workspace/index.ts`, `model/use-switch-workspace.ts`, `ui/WorkspaceSwitcher.vue`                                    |
| Общий диалог          | `src/shared/ui/UiSheetDialog.vue`                                                                                                        |
| Unit                  | `tests/unit/features/organization-settings.test.ts` (новый), `settings-forms.test.ts`, `switch-workspace.test.ts`                        |
| Browser               | `tests/e2e/settings-company.spec.ts` и `fixtures/settings-company.ts` (новые), `workspace.spec.ts`                                       |
| Изоляция polling test | `tests/e2e/sandbox.spec.ts`: только стабильный открытый SSE-mock в одном сценарии; assertions 1/1/2 и 2999+1 мс сохранены                |
| Capture               | `tooling/visual/settings-company.capture.spec.ts` (новый): 11 основных и 6 дополнительных состояний, размеры кнопок проверяются по Figma |
| Документация          | `STATUS.md`, `evidence/settings-company/Codex-R1/scope.md`, этот handoff                                                                 |

Параллельный `RELEASE-PLAN-2026-11-01.md` принадлежит другой задаче. Разовое
форматирование сохраняло Markdown AST; исходная копия и proof сохранены. Последующие
внешние правки не откатывались. План и STATUS — изменяемые outputs, не вычислительные
inputs этого снимка; полный format gate их не исключает.
Backend/API/Figma/lockfile/budgets/baselines не изменены. Commit/push/deploy/merge не выполнялись.

## Snapshot и evidence

Ветка `frontend/v2-implementation`, HEAD `4e175e914719f380dcadb05ccf28d34e9de08439` + dirty.

- **S6, 628 inputs:** `09cedd0ba730cc8f761c4f72055fb03c884fe63e133398e09a208068419f674d`.
  Включены untracked runtime/tests/tooling/config, исходные инструкции, AC и
  fingerprints среды без вывода содержимого секретов.
- **125 visual files:** `1b1639cf3acc8852a1f83c0623bd0a1eff0b03dfaf3af852385606f7db125253`.
- **69 design inputs:** `70e1f08d927d564904271accdf17ad17ebbc2c38864d80c1710d44d74f7a607a`.
- [Source manifest](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/settings-company/Codex-R1/S6/manifest.json),
  [snapshot bundle](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/settings-company/Codex-R1/S6/snapshot-bundle.json),
  [source archive](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/settings-company/Codex-R1/S6/source.tar.gz).
  Archive не содержит env/.npmrc или внешних документов.
- [Матрица всех 33 кадров и результатов](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/settings-company/Codex-R1/S6/acceptance-matrix.json):
  11 desktop PASS, 22 adaptive DEFERRED; scenario → node → fixture → browser PNG → verdict.
- [Desktop preview](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/settings-company/Codex-R1/S6/browser/actual/main-desktop-full.png).

Основной `529:4216` и диалоги `534:4297/4255/4996/5011` сверены как exact-frame.
Остальные desktop nodes: `562:5504/5284/5060`, `564:9310`, `568:7202/7423`.
Они сохраняют старую сетку в Figma; их состояния проверены как approved-state-pattern
в актуальной основной сетке. **Точная новая геометрия этих state frames — UNVERIFIED**,
устаревшую геометрию не выдаём за новый эталон. Длинный Figma frame не фиксирует
высоту страницы: actual full page 1316, source frame 1298; viewport 1440×1000.

## Проверки на конечном S6

Node 24.19.0. Assertions, timeouts, coverage, baselines, budgets и конфигурация retries не ослаблялись.

| Команда                                                                            | Exit | Результат                                                                                               |
| ---------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------- |
| `npm run check`                                                                    | 0    | Format/lint/FSD/API/types/architecture; 1159 unit, 98 файлов                                            |
| `npm run build:dev`                                                                | 0    | Сборка                                                                                                  |
| `npm run build:pre-prod`                                                           | 0    | Сборка                                                                                                  |
| `npm run build:prod`                                                               | 0    | Сборка                                                                                                  |
| `npm run audit:release`                                                            | 0    | JS 905590/905600, CSS 71811/72000, initial 249375/304800                                                |
| `CI=true npm run test:e2e -- --project=chromium --project=webkit --project=mobile` | 0    | Штатные workers2/retries2; 707 passed, 2 прежних skipped; 709 attempts, 0 retries/failed attempts/flaky |
| `npm run visual:capture -- settings-company.capture.spec.ts`                       | 0    | 17 сценариев, 51 PNG; все 4 exact footer 280/280, gap16                                                 |
| Независимые runtime probes                                                         | 0    | 10/10 short/story, 24/24 footer, 14/14 default/narrow consumers                                         |
| Snapshot до/после QA/UI                                                            | 0    | Все 628 inputs и все 125 visual hashes совпали                                                          |

Два skip — прежний keyboard logout WebKit/mobile, новых skip нет. CI-профиль запущен
локально; удалённый GitHub CI этим не объявляется пройденным.

[Независимый TEST/FUNCTIONAL и полная AC-карта](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/settings-company/Codex-R1/S6/qa/report.md).
Покрыты US-M02-05 #1–7, US-M02-06 #1–5 и негативные switch/route/double-submit;
refresh/TTL/retry, captured tenant/late responses, owner/manager/direct URL,
9 ширин ×3 browser projects. US-M02-02/04 проверены регрессией; G01 не принимался заново.
Команды и exit codes — `S6/qa/all-commands.json`, attempts — `ci-attempts.json`.

[Независимый desktop UI PASS](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/settings-company/Codex-R1/S6/ui-report.md):
22 изменённых PNG и 5 overlays просмотрены заново, 29 ранее просмотренных PNG
переиспользованы только после независимого SHA-сравнения. V01–V05 закрыты,
новых подтверждённых визуальных findings нет.

## Ограничения и следующий шаг

Живой stage, revision/API hash/миграции, реальные persistence/authorization/tenant
isolation, доставка писем/Telegram и native OS — UNVERIFIED. Exactly-once создание
после неизвестного сетевого исхода отдельно не доказано; подтверждены frontend
submit lock и повтор определённого отказа. Default consumers проверены функционально,
новый общий pixel PASS онбординга не заявляется; его исходники/макеты не перерабатывались.

В историческом S5a local workers2/retries0 был один WebKit lost-submit (PATCH не ушёл).
Адресный повтор 5/5 и serial 707/2skip прошли. Причина не установлена; текущий S6 CI
прошёл с первой попытки во всех 709 cases. Grid исправляет измеренную геометрию,
его причинная связь с lost-submit не доказана. Этот intermittent риск сохранён,
не скрыт ретраями и не объявлен устранённым. Все исторические FAIL/traces сохранены.

Следующий релизный шаг — отдельный живой stage QA разрешённого контура после сверки
revision/OpenAPI/миграций. Tablet/mobile redesign требует согласованных макетов и
отдельного поручения. Preview остановлен, порт 4173 свободен; код готов к review.
