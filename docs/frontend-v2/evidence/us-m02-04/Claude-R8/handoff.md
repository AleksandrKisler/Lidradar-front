# US-M02-04 · Шесть пунктов Codex-R2 · handoff Claude R8 (30.10.2026)

Основание: [Codex-R2](../Codex-R2/review.md), решение владельца — выполнить все шесть рекомендаций. Канон —
US-M02-04 (AC-M02-04-01–24) и US-M02-02 ветка B (`Lidradar/docs/user-stories/11-onboarding.md`). Backend,
OpenAPI, generated, миграции, Figma, `bundle-budgets.json` и игноры не менялись. Коммит, push, deploy и merge
не выполнялись. Прежние раунды R7 и Codex-R2 не трогались.

## Снимки

HEAD `3870d65` + незакоммиченные правки. Артефакты лежат в `artifacts/frontend-v2/us-m02-04/Claude-R8/`
(gitignored). В manifest входят src, tests, tooling, scripts, contracts, конфиги и lock (556 файлов).

| Снимок      | Что                                                    | sha256 manifest                                                    |
| ----------- | ------------------------------------------------------ | ------------------------------------------------------------------ |
| start (R7c) | `manifest-start.sha256`, исходное состояние раунда     | `74f2c4e0911439ff6e0d42cc76ce6745cbf2258531d3a7551bcb91dcc2c54288` |
| R8          | шесть пунктов; полный набор gates                      | `e7e18fe1864bad625c568aa725f7558e4afd556cb24264a97b7cf84499774959` |
| R8c         | + дополнительные кадры в capture-спеке; съёмка, QA     | `f53d92f90bf63b2758838663967d12bac2ffffad45a0720966c15bc766a4fd90` |
| R8d (итог)  | + F-R8-01 (предупреждения lint в тесте); QA-дельта, UI | `06ccd1292a88c9d692f5ec633345d78c16aa3784245c3562a9b01915d10b0d93` |

Каждый снимок сверялся до и после проверок: OK.

## Результат по пунктам

1. **B-01 закрыт без повышения бюджета.** Весь JS 928 529 → **870 190 B** (бюджет 905 600), критическая
   загрузка 287 348 → **248 725 B** (304 800), вход 81 329 → 67 705. Найден и убран реально неиспользуемый код:
   - `__VUE_OPTIONS_API__: false` (`vite.config.ts`): Options API нигде не используется — −4 065 B;
   - `tooling/vite/tree-shaking-fixes.ts` (только сборка): Rolldown не распознаёт JSDoc-форму
     `/** #__PURE__ */` vee-validate → неиспользуемые Field/Form/FieldArray/ErrorMessage оставались — −15 509 B;
     reka-ui `useId` через `"useId" in vue` удерживал все экспорты Vue — именованный импорт, −39 473 B.
     Правка применяется только при полном совпадении текста; тест сверяет установленные версии.
   - Пошаговые замеры и отвергнутые варианты — `Claude-R8/bundle-steps.md`. Файлы из подсчёта не исключались,
     аудит не ослаблялся. Удаление en-US из date-fns (−6 869 B) измерено, но не применено: противоречит
     решению US-M01-01 Codex-R2 F-04.
2. **UiDialog: фокус по кругу.** `keepTabInside` — в обычном `<script>` `UiDialog.vue`, подключён к
   `DialogContent`; `UiSheetDialog` импортирует его оттуда (дубликат удалён). Список селекторов — литерал:
   вызов `[...].join()` на верхнем уровне снова затягивал чанк `ui` в критическую загрузку (329 691 B, замер).
   Сохранены initial focus, focus return, Escape, outside-dismiss, busy; скрытые, `inert`, disabled
   пропускаются; вложенное окно (свой портал) ведёт обход само.
3. **«Добавить точку»** — код не менялся (кнопка уже доступна, блокируется только отправкой); добавлены
   регрессии: клик и Enter без POST, вид не «недоступный», исправление → один POST, блокировка при отправке.
4. **Имя владельца в мобильной шапке** — без изменений; T25/G07 зелёный во всех трёх проектах.
5. **Подсказка phone-08.** `blockReason` — структура `BlockReason`; текст — `blockReasonText(reason,
'desktop' | 'phone')`. Desktop/планшет: «Исправьте время в понедельник/во вторник, чтобы продолжить.»
   (Figma desktop/tablet 08), телефон: «Исправьте график: <точка>.» (Figma phone-08 `928:19526`). Два span с
   `md:hidden`/`max-md:hidden` только при различии текстов; `aria-describedby` кнопки — один видимый текст.
6. **M-1.** Оба порога: «Порог — целое число минут.» и «От 1 до 1440 минут.»; диапазоны, defaults 45/120 и формат
   API прежние. Проверено в мастере (без POST) и настройках (без PATCH).

## Регрессионные тесты

- `tests/unit/ui/primitives.test.ts` — «UiDialog: фокус не покидает окно» (4 теста). Красные до исправления:
  `Claude-R8/uidialog/red-unit-before-fix.log`.
- `tests/e2e/workspace.spec.ts` — «окна UiDialog…» (меню телефона, «Фильтры», «Пригласить в команду»; Tab,
  Shift+Tab, в WebKit ещё Option+Tab; возврат фокуса; клик снаружи). Красный WebKit без обработчика:
  `Claude-R8/uidialog/red-e2e-without-handler.log`.
- `tests/unit/pages/location-page.test.ts` — «Codex-R2 п.3 / AC-04…», «M-1 / US-M02-02 B1–B3…», AC-07–11
  (phone/desktop подсказка); `tests/e2e/onboarding.spec.ts` — «Codex-R2 п.3 / AC-04…» (клик и Enter).
- `tests/unit/pages/location-step.test.ts` — «Codex-R2 п.5…»; `tests/e2e/workspace.spec.ts` «онбординг: график с
  ошибкой…» — текст по ширине.
- `tests/unit/features/settings-forms.test.ts` — M-1 в настройках и таблица схемы. Красные до исправления:
  `Claude-R8/m1/red-before-fix.log`.
- `tooling/vite/tree-shaking-fixes.test.ts` — правки сборки.

## Команды (Node 24.19.0, последовательно)

| Команда                                                           | exit | Итог                                                                  |
| ----------------------------------------------------------------- | ---- | --------------------------------------------------------------------- |
| `npm run typecheck`, `lint:fsd`, `api:check`, `test:architecture` | 0    | R8; typecheck повторён на R8c/R8d                                     |
| `npm run test:coverage`                                           | 0    | 94 файла, 1108/1108 (R8, повтор на R8d)                               |
| `build:dev`, `build:pre-prod`, `build:prod`                       | 0    |                                                                       |
| `npm run audit:release`                                           | 0    | все бюджеты прежние, см. п. 1                                         |
| `npm run test:e2e` (полный)                                       | 0    | 476 passed, 32 skipped (прежние), 0 failed                            |
| eslint `--max-warnings 0` / prettier src, tests, tooling          | 0    | R8d                                                                   |
| `npm run check`                                                   | 1    | внешнее: `format:check` 5 чужих `m02-step4-*.md`; звенья отдельно — 0 |
| `npm run lint` (полный)                                           | 1    | 225 ошибок только в git-ignored `artifacts/**` (чужие скрипты)        |
| visual capture / compare R8c                                      | 0    | 37 + 18 доп. кадров; доли как R7c, кроме phone-08 10.79 → 10.59 %     |

Логи: `Claude-R8/release/`, `Claude-R8/release/R8d/`, `Claude-R8/targeted/`, `Claude-R8/qa/`.

## Вердикты

| Проверка                     | Результат                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------ |
| TEST (R8c, дельта R8d)       | **PASS** (QA); F-R8-01 исправлен в R8d                                         |
| FUNCTIONAL                   | **PASS**: AC-M02-04-01–23, US-M02-02 B1–B3 в обоих контекстах, шесть пунктов   |
| UI desktop / tablet / mobile | **PASS с замечаниями** ×3, регрессий нет; N-R7-7 и F-S4 закрыты                |
| Релизные gates               | `audit:release`, три build, `test:e2e` — PASS; `check` и `lint` красные внешне |
| Живой stage                  | **UNVERIFIED** (не запускался)                                                 |

## Открыто

- Внешние gates: `format:check` пяти чужих документов и `lint` git-ignored `artifacts/**` — не исправлялись.
- F-R8-02 (QA, вне сценария): mobile-тест «аналитика: окно дат…» один раз упал по таймауту, повтор 3/3 зелёный.
- UI minor: N-R7-2 (+2–4 px правой панели), N-R7-6 (тексты окон и подсказки порогов на телефоне), F-M2 (сознательно).
- UNVERIFIED: живой stage; E2E AC-24 для менеджера (по коду маршрут закрыт правом); стрелки нативного select;
  pixel-perfect для ошибки инициализации и шагов 1/3/4 (нет кадров Figma в reference); часть доп. кадров tablet.
