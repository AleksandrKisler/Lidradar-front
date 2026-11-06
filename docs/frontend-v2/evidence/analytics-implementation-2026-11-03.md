# Аналитика · реализация US-M13-01–04 · 03.11.2026

Реализованы «Обзор», «Риски и качество» и «Оплаты» по согласованию владельца
03.11.2026. Независимый QA: **TEST PASS / FUNCTIONAL PASS** для локального
frontend с синтетическими API fixtures. UI R7: **desktop PASS / tablet PASS / mobile PASS**. Общая регрессия
и итоговая приёмка приложения **DEFERRED до завершения frontend** по поручению
владельца. Stage QA **NOT RUN**; результат не является приёмкой релиза.

После локальной приёмки владелец 03.11.2026 отдельно поручил commit и push
в `stage` без новых тестов и stage smoke. Для передачи повторно сверена только
сохранность625 inputs `analytics-r7`: drift0. Ниже зафиксировано состояние
до commit/push; подтверждение отправки — история `origin/stage`. Штатный
автоматический GitHub CI не изменяется, автодеплой и live QA здесь не заявлены.

## Что реализовано

| Story     | Результат                                                                                                                                                                                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-M13-01 | Три настоящие вкладки, общий контекст организации и периода; KPI, график, атрибуция, активность и оценки сделок                                                                                                                                                  |
| US-M13-02 | Разделены confirmed/recovered, исходы и оценки; точные decimal-суммы, исходные валюты журнала, FX-only; cursor append/dedup/retry/reset; переходы в риск/диалог и возврат с периодом, страницами, scroll и фокусом                                               |
| US-M13-03 | Пресеты 7/30/90, произвольный/однодневный/будущий диапазон, inclusive календарные даты, лимит366; draft/applied, cancel/X/Escape, mobile full-screen, keyboard/focus; URL сохраняет вкладку и остальные query; timezone/DST и исключительный UTC-конец precision |
| US-M13-04 | Шесть типов, независимые события и cohort latest-feedback; KPI ΣTP/(ΣTP+ΣFP), null без фиктивных0%, minimumCoverage/reliable из API, «По дате действия»                                                                                                          |

Используются прежние GET `/api/v1/analytics/summary`,
`/api/v1/analytics/payments`, `/api/v1/risks/precision`. Три query families
независимы; ключи содержат организацию и период, запросы используют AbortSignal.
Смена периода сбрасывает cursor. Ошибка summary не скрывает доступные precision
и journal; next-page error сохраняет строки. Только continuation
`400 INVALID_ARGUMENT` предлагает сброс списка, иной400 повторяет страницу.

Оболочка C для аналитики синхронизирована с утверждёнными кадрами. Общий
UiDialog получил opt-in `analyticsDaily=false` по умолчанию: геометрия D1
используется только аналитическим дневным диалогом. Даты <375px расположены
друг под другом, сохраняя полный год. Огромные суммы переносятся только между
группами разрядов, последняя группа связана с валютой.

Дневная таблица использует загруженный series, включает нулевые дни и90 дней,
доступна клавиатурой и touch. Восстановление журнала опирается на действующий
TanStack cache; после его очистки или смены организации/прав чужой снимок
не восстанавливается. Callback scroll/focus повторно проверяет identity,
permission и текущий URL.

Старые story-подписи заголовка и единая длинная страница заменены утверждённой
композицией трёх вкладок согласно текущему поручению. Контракт и денежные/
lifecycle-правила не переопределялись. Figma использовалась только для чтения.

## Снимок и владение до передачи в stage

- Snapshot: **analytics-r7**.
- HEAD: `2187d5085373865a99c8428c9a14c687134d686f`.
- Ветка: `frontend/v2-implementation`; исходники не закоммичены.
- Manifest: `artifacts/frontend-v2/analytics-implementation-2026-11-03/manifest-r7.json`.
- SHA-256 manifest: `7cf4652636df63ff26bf3268738f3964c04cd5c77a749853a9de6690fd73bcb4`.
- 625 tracked/untracked inputs: QA before/after совпали, drift0, unlisted0.
- Владение всех write sets передано ведущему; во время QA/UI inputs заморожены.
- Dirty документация, index, исходные Figma exports и evidence предыдущей работы сохранены.
- Backend/OpenAPI, lockfile, Figma и production не изменялись; commit/push/merge/deploy не выполнялись.

## Адресные проверки

Node24.19.0 из `.nvmrc`, Playwright1.63.0, Chromium153.0.8010.12, DPR1,
ru-RU. Основные viewport1440×1000/834×1194/390×844, промежуточные320–1440.
Clock `2026-10-25T11:30:00Z`, timezone организации Europe/Moscow; DST NY
проверен unit отдельно. Touch — Chromium context с hasTouch/isMobile,
не утверждение о реальном телефоне.

| Проверка R7                                           | Exit / результат             |
| ----------------------------------------------------- | ---------------------------- |
| Следующий unit-набор                                  | 0; 8 specs, 66 PASS          |
| `npm run typecheck`                                   | 0                            |
| ESLint ровно изменённых .ts/.vue с `--max-warnings 0` | 0                            |
| Prettier --check изменённых исходников/тестов         | 0                            |
| Следующий E2E-набор с `--list`                        | 0;39тестов, только аналитика |
| Тот же E2E-набор без `--list`                         | 0;39/39PASS,44.2s            |
| `git diff --check`                                    | 0                            |

```sh
npm run test:unit -- tests/unit/entities/report.test.ts tests/unit/widgets/analytics.test.ts tests/unit/pages/range-query.test.ts tests/unit/widgets/analytics-overview.test.ts tests/unit/widgets/analytics-quality.test.ts tests/unit/widgets/analytics-payments.test.ts tests/unit/widgets/analytics-error.test.ts tests/unit/widgets/analytics-loading.test.ts
npm run typecheck
E2E_BASE_URL=http://127.0.0.1:4173 npx --no-install playwright test tests/e2e/analytics.spec.ts tests/e2e/workspace.spec.ts tests/e2e/narrow-controls.spec.ts tests/e2e/responsive.spec.ts tests/e2e/module-shell.spec.ts --project=chromium --grep '[Аа]налитика|N-ML-02' --workers=1
```

Перед E2E выполнялась та же команда с `--list`. QA также передал `--output`
в свой каталог; точные env/argv для всех команд, включая полный список lint/
format файлов: `qa-r7/commands.json`. Весь mixed spec не запускался: выборка
19analytics +4analytics shell +9N-ML-02 +6analytics reflow/axe +1analytics workspace.

Полные check/coverage/unit/e2e/stand/browser matrix, release-сборки и audit
не запускались. CI/assertions/thresholds/budgets/baselines не ослаблялись.
Общая проверка UiDialog вне аналитического consumer отложена вместе с общей
регрессией; default ветви сохранены и проверены чтением diff/typecheck.

## Evidence и независимые результаты

Все пути ниже относительно `artifacts/frontend-v2/analytics-implementation-2026-11-03/`:

- `qa-r7/report.md`: TEST/FUNCTIONAL PASS, AC map и ограничения.
- `qa-r7/commands.json`, `unit.log`, `typecheck.log`, `eslint.log`, `prettier.log`, `e2e-list.log`, `e2e.log`.
- `qa-r7/before.json`, `after.json`: целостность 625 inputs.
- `browser-r7/`:78 финальных PNG; `qa-r7/browser-outputs.json` содержит SHA/геометрию каждого.
- `approved-reference-images-r7.json`:37 утверждённых Figma exports, включая D1/P00/PC; `qa-r7/reference-hashes.json` — совпадение 37/37.
- `ui-r7/report.md`: desktop/tablet/mobile PASS; `reviewed-images.json` — фактически просмотренные файлы. Все четыре UI findings предыдущих кругов CLOSED.

История итераций сохранена в `qa-r3`, `qa-r5`, `ui-r5` и логах ведущего.
R3FUNCTIONAL UNVERIFIED закрыт новыми негативными проверками и актуализацией
legacy analytics assertions. R5UI обнаружил два medium и нехватку кадров;
R6 закрыл оба замечания R5, затем выявил расхождения загрузки и ошибок. R7 сохраняет структуру карточек с небольшими skeleton и нейтральные локальные ошибки с retry 240 px; эти изменения имеют 16 дополнительных unit-проверок. Финальные кадры R7 отделены от неизменяемых кадров R6. Старый browser/
был рабочим каталогом итераций, его текущие файлы не доказывают исторический
PASS R5; см. `ui-r5/report.md`. Исходное evidence до этой задачи не затрагивалось.

Утверждённые области Figma: overview1636:7923, quality1656:14471,
payments1690:31301, файл jN8Hhzn6ObIAEi7FoY9kPu. Точные result frames:
S00 1637:12469/12801/13110; R00 docs1657:15712/16133/16531;
B00 docs1692:31298/31630/31802. Reference-kind: approved frames по структуре,
approved-pattern по динамическим данным; различающиеся иллюстративные суммы
Figma не перенесены в API-семантику.

## Изменённые исходники и тесты

- `src/app/styles/main.css`
- `src/features/select-analytics-period/ui/PeriodPicker.vue`
- `src/pages/analytics/model/range-query.ts`
- `src/pages/analytics/model/return-state.ts`
- `src/pages/analytics/ui/AnalyticsPage.vue`
- `src/pages/conversations/ui/ConversationsPage.vue`
- `src/pages/risk/ui/RiskPage.vue`
- `src/shared/ui/UiDialog.vue`
- `src/widgets/analytics/index.ts`
- `src/widgets/analytics/ui/ActivityGrid.vue`
- `src/widgets/analytics/ui/AnalyticsError.vue`
- `src/widgets/analytics/ui/AnalyticsLoading.vue`
- `src/widgets/analytics/ui/AttributionBreakdown.vue`
- `src/widgets/analytics/ui/MetricCards.vue`
- `src/widgets/analytics/ui/OverviewPanel.vue`
- `src/widgets/analytics/ui/PaymentsPanel.vue`
- `src/widgets/analytics/ui/PaymentsTable.vue`
- `src/widgets/analytics/ui/PrecisionTable.vue`
- `src/widgets/analytics/ui/RevenueChart.vue`
- `src/widgets/analytics/ui/RiskQualityPanel.vue`
- `src/widgets/analytics/ui/RiskTypeTable.vue`
- `src/widgets/analytics/ui/StatCard.vue`
- `src/widgets/analytics/ui/assets/quality-heading.svg`
- `src/widgets/analytics/ui/assets/quality-metric.svg`
- `src/widgets/app-shell/ui/RadarShell.vue`
- `src/widgets/risk-workspace/ui/RiskWorkspace.vue`
- `tests/e2e/analytics.spec.ts`
- `tests/e2e/module-shell.spec.ts`
- `tests/e2e/narrow-controls.spec.ts`
- `tests/e2e/responsive.spec.ts`
- `tests/e2e/workspace.spec.ts`
- `tests/unit/entities/report.test.ts`
- `tests/unit/pages/range-query.test.ts`
- `tests/unit/widgets/analytics-error.test.ts`
- `tests/unit/widgets/analytics-loading.test.ts`
- `tests/unit/widgets/analytics-overview.test.ts`
- `tests/unit/widgets/analytics-payments.test.ts`
- `tests/unit/widgets/analytics-quality.test.ts`
- `tests/unit/widgets/analytics.test.ts`

Документация этого поручения: STATUS и данный отчёт. Прежний dirty diff SOURCES/
design-index и ранее подготовленные design evidence/prompts принадлежат
предыдущему этапу и сохранены.

## Осталось

Работа по US-M13-01–04 завершена в согласованных границах. Открытых findings
аналитики нет. Реальный stage, доставка, реальные устройства и общая финальная
приёмка frontend не заявлены. Следующий этап — продолжение frontend по
отдельному поручению, затем отдельно общая регрессия.
