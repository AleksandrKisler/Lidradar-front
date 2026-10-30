# US-M02-04 · исправление findings Codex-R1 · handoff Claude R6 (30.10.2026)

Основание: [проверка Codex-R1](../Codex-R1/review.md) — F-01/F-02 (P1), F-03 (P2), AC-23 UNVERIFIED.
Канон: US-M02-04, AC-M02-04-01–24 (`Lidradar/docs/user-stories/11-onboarding.md`), решение без
backend (`Lidradar/docs/engineering/US-M02-04-IMPLEMENTATION.md`). Backend, OpenAPI, generated,
миграции и Figma не менялись. Коммит/push/deploy не выполнялись.

## Snapshot

HEAD `3870d65` + незакоммиченные правки. Артефакты — `artifacts/frontend-v2/us-m02-04/Claude-R6/`
(gitignored).

| Снимок | Manifest (553 входа: src, tests, tooling, scripts, contracts, конфиги, lock) | sha256 manifest                                                    |
| ------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| R6     | `manifest.sha256`                                                            | `5ce20d6ac854e5a375bd356e741ea7cce53693af57fb3983c5b10d35b091b471` |
| R6b    | `manifest-R6b.sha256`; отличие от R6 — только `tests/e2e/onboarding.spec.ts` | `5e13d055668238e8a9594e2c330e69805c2f1549bc8b6f9905dcc1ca04261c9d` |

QA сверял manifest до/после каждого прохода: 553/553 OK.

## Исправления

- **F-01 · tenant команды.** `features/manage-locations/model/use-save-location.ts`: организация —
  часть данных команды (`SaveLocationInput.tenantId`), запрос и инвалидация используют её.
  `features/manage-locations/ui/LocationForm.vue`: tenant фиксируется при нажатии, до асинхронной
  валидации; `saved`/`failed` не эмитятся в сменившемся контексте. `pages/onboarding`: ответ PATCH
  применяется только при прежней метке контекста (`applyPatched(location, startedAt)`), как у POST.
- **F-02 · финальная сверка.** `pages/onboarding/model/location-step.ts`, `saveAll()`: финальный GET
  сравнивается с желаемой неделей (`normalizeWeek(draft.days)` + пояс) **до** слияния. Расхождение:
  `write='diverged'`, черновик пользователя остаётся, baseline — серверная неделя, `failure =
{ kind: 'diverged' }`, переход запрещён, автоматической записи нет; повтор PUT — только по
  следующей команде. `LocationPage.vue`: сообщение «График на сервере отличается от сохранённого»
  с названием точки. Новых CAS/ETag-гарантий нет.
- **F-03 · состав недели.** `entities/location/model/hours.ts`: `isFullWeekdaySet` — ровно целые
  1..7 без пропусков и повторов; в `weekIssues` и `completeWeekFromHours`.

Сохранены: default 10:00–19:00, POST → PUT, повтор только PUT после подтверждённого POST,
черновики по точкам, поведение формы точки в настройках (unit `settings-forms` и e2e workspace).

## Регрессионные тесты

Красные до исправления (`red-before-fix.log`, exit 1; мутационная проверка отката — 3 красных),
зелёные после:

- `tests/unit/entities/setup.test.ts` — F-03: 2..8, 0..6, 1.5, дубль, неполная и пустая неделя;
  корректная и переставленная — валидны.
- `tests/unit/features/settings-forms.test.ts` — F-01 create/update: смена A→B до dispatch,
  `X-Tenant-ID: tenant-a`, инвалидация только A, `saved` не эмитится.
- `tests/unit/pages/location-step.test.ts` — F-01 поздний PATCH; F-02 ACK 11:00 → GET 15:00.
- `tests/unit/pages/location-page.test.ts` — F-02 на странице: сообщение, 11:00 в поле, шаг, один PUT.
- `tests/e2e/onboarding.spec.ts` — AC-23: focus trap Tab/Shift+Tab, возврат фокуса на плюс и
  карандаш, создание и выбор с клавиатуры, мобильный селектор и карандаш. В R6b: явный viewport
  1440 у desktop-сценариев шага 2 (проект mobile) и `Alt+Tab` для WebKit.

## Команды (Node 24.19.0)

| Команда                                                  | exit | Итог                                                                                                                                                                                                                        |
| -------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| адресные unit (5 файлов)                                 | 0    | 64/64 (ведущий и QA)                                                                                                                                                                                                        |
| `npm run typecheck`                                      | 0    |                                                                                                                                                                                                                             |
| `npm run test:coverage` (QA)                             | 0    | 1094/1094                                                                                                                                                                                                                   |
| `lint:fsd`, `api:check`, `test:architecture` (QA)        | 0    |                                                                                                                                                                                                                             |
| `npm run check`                                          | 1    | стоп на `format:check`: внешние файлы другого пакета — 4 `evidence/m02-step4-*.md` при запуске QA; к концу раунда 6 (добавились `design-index.json` и `m02-step4-desktop-review-*.md`, изменённые параллельно, 13:36–13:59) |
| `npm run lint` (полный)                                  | 1    | 56 no-undef только в git-ignored `artifacts/frontend-v2/m0{1,2}-scenarios-*/…-flow.js`                                                                                                                                      |
| eslint/prettier затронутых файлов                        | 0    |                                                                                                                                                                                                                             |
| `build:dev`, `build:pre-prod`, `build:prod`              | 0    |                                                                                                                                                                                                                             |
| `npm run audit:release`                                  | 1    | весь JS 926 601 B > бюджет 905 600 B (HEAD 904 317 B); бюджет не менялся                                                                                                                                                    |
| `npm run test:e2e` (R6, полный)                          | 1    | 462 passed, 8 failed: 3 — помеха моего параллельного запуска, 1 — mobile без viewport, 4 — F-04                                                                                                                             |
| playwright onboarding + workspace, все проекты (R6b, QA) | 1    | 171 passed, 2 skipped (прежний skip HEAD), 4 failed — только AC-23 WebKit/mobile (F-04)                                                                                                                                     |
| playwright onboarding + workspace, chromium              | 0    | 59 passed (до R6b)                                                                                                                                                                                                          |
| visual capture / compare R6                              | 0    | 37 кадров; 30 побайтно = R5, 7 — maxΔ 1/255 (сглаживание)                                                                                                                                                                   |

## Вердикты

| Проверка                     | Результат                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| TEST (сценарий, Chromium)    | **PASS**                                                                                      |
| TEST (WebKit/mobile e2e)     | **FAIL** — только AC-23 из-за F-04                                                            |
| FUNCTIONAL                   | F-01–03 исправлены; AC 01–22, 24 PASS; AC-23 Chromium PASS, WebKit/mobile **FAIL** (F-04)     |
| UI desktop / tablet / mobile | **PASS с замечаниями** ×3 (два прохода, все 12 состояний; новые только minor и не регресс R6) |
| Баннер расхождения           | PASS с замечаниями — approved-pattern danger-баннера 09, без эталона Figma                    |
| Релизные gates               | **FAIL**: `audit:release` (бюджет JS), `test:e2e` (F-04); три build — PASS                    |
| Живой stage                  | **UNVERIFIED** (не запускался)                                                                |

## Новые findings

- **F-04 · medium · AC-23 · общий `UiSheetDialog` (reka-ui FocusScope) в WebKit/Safari.** После
  последнего поля (Tab: WebKit пропускает кнопки) или последней кнопки (Option+Tab: FocusScope
  замыкает только Tab без модификаторов) фокус уходит из окна на BODY и поля страницы за подложкой.
  Shift+Tab удерживается; Chromium — PASS. QA воспроизвёл и в окне точки в настройках
  (`/settings/company`) — дефект общий, R6 его не вносил. Нужно решение владельца: исправить
  общий примитив (затронет все окна) или явно ограничить AC-23 Chromium.
- **B-01 · release · бюджет JS.** Весь JavaScript 926 601 B при бюджете 905 600 B; HEAD — 904 317 B.
  Рост из незакоммиченного пакета (чанки onboarding ≈ +13,8 KB, manage-services ≈ +6 KB); вклад R6
  оценочно ≈ 1 KB. Бюджет не менялся: нужно решение — сократить код или обосновать новый бюджет.
- **UI minor (кадры равны R5):** phone-08 без красной строки «График заполнен неверно» под
  селектором; окно 02 — кнопка «Добавить точку» синяя вместо серой; desktop/tablet-06 — кнопка шага
  под окном бледная (disabled); N-A — «Точек пока нет» / «Загружаем точки…» крупнее и легче эталона.
- **Info (QA N-1):** в форме точки настроек `maxlength=200` заменён схемой (AC-04, изменение до R6).
- **Ограничение AC-23:** нативный `<select>` в WebKit/Chromium на macOS по стрелкам открывает
  системное меню, недоступное автоматизации; проверены фокус по Tab, имя, выбор событием change.

## UNVERIFIED

Живой stage; клавиатурные стрелки нативного селекта (ручная проверка в Safari/Chrome);
«Сохраняем график точки…» и кадр ошибки инициализации визуально; pixel-perfect нового баннера.

## Следующий шаг

Решения владельца по F-04 и B-01; затем новый snapshot, повтор затронутых TEST/FUNCTIONAL и
релизных gates; живой stage с разрешённым synthetic tenant.
