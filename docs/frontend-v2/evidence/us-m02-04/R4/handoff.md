# US-M02-04 · исправление шага 2 «Точки и графики» · handoff R4 (30.10.2026)

ТЗ: [US-M02-04-CLAUDE-TASK](../../../US-M02-04-CLAUDE-TASK.md). Канон: US-M02-04, AC-M02-04-01–24
(`Lidradar/docs/user-stories/11-onboarding.md`), решение без backend
(`Lidradar/docs/engineering/US-M02-04-IMPLEMENTATION.md`). Backend, OpenAPI, generated и Figma не менялись.

## Snapshot

HEAD `3870d65` + незакоммиченные правки; манифест SHA-256 всех входов —
`artifacts/frontend-v2/us-m02-04/R4/manifest.txt` (gitignored). Раунды R1→R4 и отчёты QA/UI — там же.

## Что исправлено относительно прежнего шага

- Единый экран: точки слева (карточки 76 px, карандаш 44×44, плюс 46×46), график справа;
  телефон — селектор, график ниже, закреплённая нижняя панель. Встроенная «Первая точка» убрана.
- Настоящие модалки настроек «Добавить/Изменить точку» в контексте онбординга.
- Модель страницы `src/pages/onboarding/model/location-step.ts`: черновики по ID, контекст
  user+tenant+экземпляр, POST → PUT стандартной недели 10:00–19:00 (маска Пн–Сб, Вс выходной),
  после POST 201 повтор только PUT, unknown POST/PUT — свежая сверка без автозаписи, очередь PUT
  со стопом на первом сбое и пропуском подтверждённых, финальная сверка точек + LOCATION,
  восстановление пустой недели при открытии шага.
- Управляемое представление недели `BusinessHoursFields.vue`; редактор настроек не изменён.
- Строгая неделя и сравнение в `entities/location/model/hours.ts`; default настроек 09–20 прежний.
- Длина названия точки — в символах (AC-04); tenant команды фиксируется в момент отправки.

## Результаты (mock/frontend; Node 24.19.0)

| Проверка                | R4                                                                                                                                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| lidradar-qa TEST        | **PASS** по diff US-M02-04: typecheck, lint:fsd, api:check, test:architecture, test:coverage (1087), build:pre-prod, e2e chromium onboarding 15/15, responsive 67/67, workspace/workspaces/access/retention 118/118 — exit 0 |
| lidradar-qa FUNCTIONAL  | **PASS** 24/24 AC (mock/unit/e2e/геометрия)                                                                                                                                                                                  |
| lidradar-visual-review  | desktop **PASS с замечаниями**, tablet **PASS с замечаниями**, mobile **PASS с замечаниями** (только minor)                                                                                                                  |
| `npm run check` агрегат | exit 1 только из-за внешних файлов: prettier `docs/frontend-v2/evidence/m02-step4-*.md` (другой автор), eslint gitignored `artifacts/frontend-v2/m01-scenarios-2026-10-30/*.js`                                              |
| Живой stage             | **BLOCKED/UNVERIFIED** (цель/реквизиты в `.env.stage.local`, секреты не читались)                                                                                                                                            |
| Релизные gates          | не запускались: три build, `audit:release`, полная матрица `test:e2e`                                                                                                                                                        |

Кадры: 36 состояний (12 × desktop 1440×1000 / tablet 834×1194 / phone 390×844) + phone scroll-end;
эталоны Figma (SHA-256) — `artifacts/frontend-v2/us-m02-04/reference/`. Состояния 03/04 —
`reference-kind = approved-pattern + behaviorClarification 2026-10-30`.

## Открытые замечания (minor)

- R4-N1: под открытым окном при отсутствии точек кнопка шага бледно-синяя вместо серой disabled.
- F-D1: от ряда шагов до заголовка на 3–4 px меньше Figma (DOM-ритм 28/12/30 по AC выдержан).
- F-D2: нативные disabled-чекбоксы серые, в Figma бледно-синие.
- Общие компоненты: имя владельца в шапке телефона (F-M2), вертикальный центр модалки (F-S2),
  зазор подсказки в модалке (F-S3), описание модалки на телефоне (F-S6).
- UNVERIFIED изображениями: кадр ошибки инициализации, фокус/клавиатура, autofocus модалок.

## Следующий шаг

Решение владельца по minor-замечаниям и визуальная приёмка пользователем; затем релизные gates
WORKFLOW и живой stage-прогон с разрешённым synthetic tenant. Коммит/push не выполнялись.
