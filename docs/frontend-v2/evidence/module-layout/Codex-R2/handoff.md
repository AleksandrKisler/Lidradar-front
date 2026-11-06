# N-ML-01/02 и format/lint · Codex R2

Поручение от 31.10.2026: исправить два замечания на 320 px, убрать блокеры
format/lint и повторить TEST → FUNCTIONAL → UI. **Независимые TEST и отдельный
FUNCTIONAL frontend/mock scope — PASS. UI desktop/tablet/mobile — PASS.
N-ML-01 и N-ML-02 закрыты, новых findings нет.**

## Что исправлено

- **N-ML-01:** действия баннера ограничены доступной шириной и переносятся.
  На телефоне зазор 8 px, с `sm` — прежние 12 px. Текст, кнопки и уведомления
  не выходят за экран; отправка и скрытие сохранены.
- **N-ML-02:** поля периода не сжимаются ниже принятой desktop-ширины 160 px.
  Когда места не хватает, они занимают отдельные строки. Год и календарь
  видны при прежних 17 px и высоте 46 px; общий UiInput не менялся.
- **Format:** пять m02-step4 документов отформатированы без изменения смысла.
  Worker и независимый QA сравнили Markdown AST: 5/5 одинаковы без source positions.
- **Lint:** исключены сгенерированные `artifacts/**`. Исходники, тесты, tooling,
  scripts и корневой конфиг остаются под правилами. Новый guard проверяет
  области и реальную диагностику unused variable; QA дополнительно проверил
  активность no-explicit-any и FSD на виртуальных нарушениях.

Основные файлы: `EmailVerificationBanner.vue`, `PeriodPicker.vue`,
`eslint.config.js`, `tooling/eslint/fsd.test.mjs`, новый
`tests/e2e/narrow-controls.spec.ts` и пять документов из `format-worker/report.md`.
Точная дельта с путями, включая untracked, — `relevant.diff`.

Backend/API/generated/lockfile/budgets, прежние assertions, browser matrix и
coverage thresholds не менялись. Figma/production не менялись; commit/push/
deploy/merge не выполнялись. Scope — точечные UI и tooling исправления F05/F06,
R2-01–07 в [scope.md](scope.md); предыдущая оболочка сохранена.

## Снимок и доказательства

N320-S1: HEAD `4e175e914719f380dcadb05ccf28d34e9de08439` + dirty tree.
Source: **692 inputs**, SHA
`0477899ae3bcc0303461ce9385c284f18441fcd414e6513dfd51d655d619dd80`.
Visual: **194 файла**, SHA
`345c9818f587996dc019fc6dd3a0f769d9777c71b66f25b3af45073a8cb80e3c`.
Все прежние 685 inputs ML-S2 совпали перед началом. Архив source не содержит
opaque env/auth конфигов; их digests включены в manifest. Дельта — 11 inputs.
STATUS и этот handoff — объявленные reporting exclusions.

`target-results-v3/` и `capture-map.json`: 81 raw viewport PNG + 81 JSON на
девяти ширинах в трёх проектах: banner initial/sent и analytics date.
Locale ru-RU, Europe/Moscow, clock 2026-10-25T11:30Z; browserVersion и штатный
DPR записаны фактически. Есть 1440×1000 / 834×1194 / 390×844 и 320/344/360/375/420/640.
QA независимо получил ещё 81 PNG + 81 JSON в своём target output.

Дополнительно `qa/functional-evidence-sha256.json` фиксирует 35 файлов,
включая 15 PNG + 15 JSON состояний pending/sent/rate-limit/unavailable/failed.
Первый root run остановлен из-за ошибочного exacttext locator подписи периода;
V2/V3 прошли. Первые failures сохранены и не выдаются за PASS.

## Финальные gates

| Проверка                    | Exit      | Результат                                                                  |
| --------------------------- | --------- | -------------------------------------------------------------------------- |
| Полный `npm run check`      | 0         | Format, lint, FSD, API, typecheck, coverage и architecture прошли цепочкой |
| Coverage внутри check       | 0         | 1121/1121                                                                  |
| Независимый narrow-controls | 0         | 54/54, девять ширин × три проекта × два сценария                           |
| Build dev / pre-prod / prod | 0 / 0 / 0 | Пройдены                                                                   |
| audit:release               | 0         | Контракт, CSP/security и бюджеты в норме                                   |
| Полный stock E2E            | 0         | 632 passed, 32 прежних skipped, новых пропусков нет                        |
| Отдельный FUNCTIONAL        | 0         | 18/18 групп плюс независимая lint/Markdown семантика                       |

Production: JS **879163 / 905600**, CSS **68886 / 72000**,
initial **248910 / 304800** байт. К ML-S2: JS +19, CSS +34, initial без роста.
Полные команды и exit codes — `qa/commands.json`, детали — `qa/report.md`.
Прежние format/lint блокеры сняты, не классифицированы как допустимый baseline FAIL.

FUNCTIONAL проверил пять потребителей × три браузера: initial/pending/sent,
Tab/Option+Tab/reverse/Enter-hide; отдельно rate-limit, unavailable и failure.
Во всех состояниях строго scrollWidth=320, тексты и контролы внутри viewport.
Все отправки замоканы. Даты, URL, reload, invalid range и пресеты проверены
stock tests; QA просмотрел actual date320 в трёх браузерах с полным годом.

692 source / 194 visual / прежние 598 visual / 580 protected PNG сохранены.
Сверялись SHA-256, а для исторических G07/F03 также mtime_ns/size. Исходники и
baselines во время приёмки не менялись. Независимый UI после обоих PASS
просмотрел все 81 root PNG и все 15 дополнительных QA-state PNG. Действия и
focus баннера внутри экрана, обе даты показывают полный год. Desktop/tablet/
mobile PASS; source692/visual194/supplement35 совпали до/после просмотра.
Результат сохранён в `UI-report.md`. WebKit сохраняет собственное native date
представление, отдельная Chromium-иконка не навязывалась.

Stage и нативные OS controls/zoom остаются UNVERIFIED. Это не выдача разрешения
на deploy; живой stage проверяется отдельно. Артефакты:
`artifacts/frontend-v2/module-layout/Codex-R2/`.
