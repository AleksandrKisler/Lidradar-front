# US-M02-04 · Независимая проверка шести пунктов после Claude R8

Дата: 30.10.2026. **Все шесть пунктов подтверждены в адресном TEST/FUNCTIONAL
scope; бюджет JS соблюдён без повышения лимитов. Общий UI — FAIL:** на 320 px
подпись основной кнопки выходит за её поверхность. Desktop и tablet прошли с
minor. Полный release PASS не присваивается: общий check красный, stage не проверен.
Код, тесты, build-конфиги, API, backend, Figma и бюджеты в этой проверке не менялись.

## Снимок и организация проверки

Ветка `frontend/v2-implementation`, HEAD
`4e175e914719f380dcadb05ccf28d34e9de08439`, Node 24.19.0. Старый handoff Claude
описывает pre-commit HEAD `3870d65` + dirty tree; текущие файлы соответствуют
финальному R8d manifest **556/556**. Отличие HEAD не принято за новый runtime diff.

Артефакты нового раунда:
`artifacts/frontend-v2/us-m02-04/Codex-R3/`. Отдельные роли:
`lidradar-explorer` — build-transform review; `lidradar-qa` — TEST, затем
FUNCTIONAL; `lidradar-visual-review` — готовые изображения после адресных PASS.
UI role файлы не меняла, её окончательный результат сохранён ведущим.

| Manifest                  | SHA-256                                                            | Проверено        |
| ------------------------- | ------------------------------------------------------------------ | ---------------- |
| Claude R8d                | `06ccd1292a88c9d692f5ec633345d78c16aa3784245c3562a9b01915d10b0d93` | 556/556          |
| Codex R3b inputs          | `92f561c933c2581e92aebfb4597767496adcbfba6afa4a59ed0480e2e7a66a7c` | 721/721 до/после |
| Supplementary UI evidence | `192b8e4f0820c47419172036743435a76119ca896333c8618d1bd33964fad554` | 138/138          |

Во время TEST параллельная сессия добавила design-freeze в AGENTS/WORKFLOW.
Исходному snapshot 715 inputs PASS не присвоен; документационная дельта прочитана,
создан R3b. Executable inputs и step2 references остались прежними, поэтому
повторять уже успешные suites без изменения кода не потребовалось. История и
обоснование переноса сохранены в `snapshot-policy-rebase.md`; текущие untracked
документы учтены в inventory. Другие авторы продолжали документацию оболочки.

Уточнение владельца учтено: новый sidebar/header относится к AppShell на Radar,
dialogs, analytics, integrations и settings. Onboarding/AccountHeader принимаются
отдельно по `onboarding.step2`. Старые AppShell размеры не использованы как
эталон шага 2; новую оболочку этот отчёт не реализует и не принимает.

## Все шесть пунктов

| Пункт                                       | Результат                | Подтверждение и граница                                                                                                                                                                                      |
| ------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Оптимизация JS, прежние лимиты              | **PASS**                 | Свежий production build + check-bundle. Budgets, checker, release-audit и lockfile не ослаблены; JS assets не исключены из подсчёта.                                                                         |
| UiDialog: фокус внутри окна                 | **PASS в целевых путях** | Unit + Chromium/WebKit/mobile: Tab/Shift/Option+Tab, initial/return focus, Escape/outside, busy; Ctrl/Meta не перехватываются. Nested guards покрыты unit; все вложенные комбинации браузерами не проверены. |
| «Добавить точку» до пустого submit          | **PASS**                 | Кнопка доступна; click/Enter показывает «Введите название точки.», не делает POST; исправление даёт один POST, busy предотвращает повтор.                                                                    |
| Имя владельца на телефоне                   | **PASS**                 | G07/T25 на 320/390/834/1440, включая длинное имя, во всех трёх browser projects. Не является приёмкой нового AppShell.                                                                                       |
| Responsive copy ошибки графика              | **PASS**                 | Desktop/tablet «Исправьте время в …», phone «Исправьте график: …». Одна BlockReason-модель и валидация, имя точки и aria-связь сохранены; переход к другой точке не теряет неверный draft.                   |
| Тексты обоих порогов, onboarding и settings | **PASS**                 | «Порог — целое число минут.» / «От 1 до 1440 минут.». Ошибки каждого поля, отсутствие POST/PATCH при invalid, исправление и числовые 1/1440 проверены. Defaults 45/120 сохранены.                            |

Дополнительно проверено сохранение принятого решения: график предзаполнен
10:00–19:00; создание POST → PUT, при отказе графика повторяется только PUT
созданного ID. Независимые черновики, переключение A→B→A с ошибкой, частичное
сохранение, финальное подтверждение и ранее исправленные F-01–03 покрыты адресными
проверками. Нового backend/API изменения не требуется.

Оптимизация реальная: отключена неиспользуемая Options API, build-plugin
нормализует существующие PURE-аннотации и снимает namespace-retention у
установленного Reka useId. При текущих Vue 3.5.42 / Reka 2.10.4 / vee-validate
4.15.1 конкретного блокирующего нарушения не найдено. Это зависимое от версий
решение: PURE regex не AST, exact-string guard может перестать совпадать при
обновлении, shared-компоненты требуют регрессий. При обновлении зависимостей
перепроверять transform, весь bundle graph и потребителей; бюджеты не повышать
для обхода этой проверки.

## Свежие проверки и budgets

Все ниже — новые запуски Codex на совпавших executable inputs, не пересказ Claude.

| Команда / проверка                                                                    |  Exit | Итог                                                                                        |
| ------------------------------------------------------------------------------------- | ----: | ------------------------------------------------------------------------------------------- |
| `test:unit` шести целевых файлов, включая build plugin                                |     0 | **83/83**                                                                                   |
| `build:prod -- --outDir artifacts/frontend-v2/us-m02-04/Codex-R3/qa/dist-prod`        |     0 | Production + typecheck                                                                      |
| `node scripts/check-bundle.mjs artifacts/frontend-v2/us-m02-04/Codex-R3/qa/dist-prod` |     0 | Все пороги, admin вне critical load                                                         |
| ESLint `src tests tooling vite.config.ts --max-warnings 0`                            |     0 | Нет ошибок/предупреждений                                                                   |
| `api:check`                                                                           |     0 | Контракт сохранён                                                                           |
| Адресный Playwright, Chromium/WebKit/mobile                                           |     0 | **45/45**, 0 skipped                                                                        |
| FUNCTIONAL manager-denial probe, три browser projects                                 |     0 | **3/3**: denied, нет формы и location writes, возврат в Radar                               |
| Visual capture существующим runner                                                    |     0 | **55/55**: 37 основных +18 extra                                                            |
| Дополнительные narrow probes                                                          |     0 | 5 ширин, 15 PNG; overflowX=0, ошибка читается после scroll                                  |
| `npm run check`                                                                       | **1** | Остановлен format:check на шести документах; последующие звенья этой команды не запускались |

Первый sandbox browser/preview запуск завершился permission errors; эти попытки
не засчитывались как тест приложения. Последующий разрешённый запуск дал 45/45.
Preview остановлен. Все browser API fixtures синтетические, stage не затрагивался.
Полные команды, параметры и логи — в QA report.

| Метрика production, B без сжатия |        Факт | Прежний лимит |      Запас |
| -------------------------------- | ----------: | ------------: | ---------: |
| Total JS                         | **870 190** |   **905 600** | **35 410** |
| Initial static load              | **248 725** |   **304 800** | **56 075** |
| Entry                            |      67 705 |       110 100 |     42 395 |
| Largest chunk                    |      76 245 |       110 100 |     33 855 |
| CSS                              |      66 874 |        72 000 |      5 126 |

Измерен `qa/dist-prod`, не случайный repository dist. Поздний capture штатно
пересобрал repository dist как pre-prod; он не выдаётся за production evidence.
Отдельная резервная папка `qa/dist-production` отличается на 1 B; её замер
раскрыт в capture-addendum и не подменяет приведённые production числа.

**Переиспользовано, а не запущено заново:** R8d coverage **1108/1108**; полный
R8 E2E **476 passed / 32 прежних skipped / 0 failed**; три build, архитектура,
FSD и release-audit — exit 0 в сохранённых логах. Runtime/build/API inputs
совпадают; различия R8→R8d локализованы в unit primitives и visual capture.
Прежние skips разобраны, обязательные новые сценарии ими не скрыты. Release-audit
заново не запускался; свежие production build и bundle check выполнены отдельно.

Общий свежий check красный на пяти `m02-step4-*.md` и новом DESIGN-FREEZE.md
(форматирование других авторов). Полный lint в сохранённом R8d логе имел 225
ошибок в ignored artifacts; сейчас он целиком не повторялся, это число историческое.
Адресный ESLint зелёный не делает общий gate зелёным.

## UI-R3-01 · P2 · AC-M02-04-22

**При 320×844 текст «Сохранить и продолжить» выступает за поверхность кнопки.**
Воспроизведено на экране неверного графика до и после прокрутки. Источник —
[footer LocationPage](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/pages/onboarding/ui/LocationPage.vue:492),
где фиксированная «Назад» и остаточная flex-ширина недостаточны для подписи
основной кнопки. Shared button центрирует непереносимую строку. Это причина по
прочитанному коду, исправление не выполнялось.

[Первый viewport](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/us-m02-04/Codex-R3/qa/narrow/invalid-320-first.png),
[после прокрутки](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/us-m02-04/Codex-R3/qa/narrow/invalid-320-scroll-end.png).
Expected: надпись целиком внутри кнопки, читаема на поддерживаемой ширине 320.
Actual: выходит слева и справа; document overflowX=0 этот дефект не обнаруживает.

Следующее ограниченное исправление: footer шага 2 и регрессия на bounds текста
внутри кнопки на 320/375/390, проверка enabled/disabled/saving/retry и прежних
834/1440. Не менять backend, тексты или Figma для подгонки реализации.

UI role просмотрела все 36 R8 browser/Figma пар, scroll-end и 18 extra, затем
девять изменившихся новых PNG и 15 narrow PNG. Остальные 46 новых кадров
побайтно равны просмотренным. Chromium 153.0.8010.12/version и binary hash
зафиксированы до/после; metadata, fixture, scale и reference-kind раскрыты.
Phone-11, init-error, фокус окон и дополнительные шаги 1/3/4 просмотрены с
оговорками точности эталонов в UI report. N-R7-2 и N-R7-6 остаются minor.
Часть ошибки под sticky footer в первом viewport полностью читается после
прокрутки; предполагаемый блокирующий дефект её доступности не подтверждён.

## Итог TEST / FUNCTIONAL / UI и ограничения

| Область                                 | Вердикт                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| TEST шести пунктов и адресных регрессий | **PASS**                                                                                                           |
| FUNCTIONAL шести пунктов                | **PASS**, после адресного TEST                                                                                     |
| Все 24 AC полностью                     | **UNVERIFIED**: покрытие по каждому AC в QA report; native select Arrow и широкий nested browser scope не доказаны |
| UI desktop / tablet / mobile            | **PASS с minor / PASS с minor / FAIL**                                                                             |
| Общий release TEST                      | **FAIL** из-за общего check; полного release PASS нет                                                              |
| Живой stage                             | **UNVERIFIED**, не запускался                                                                                      |

Manager denial дополнительно подтверждён 3/3 synthetic probes, но постоянного
регрессионного теста пока нет. Native macOS select popup/Arrow и все сочетания
вложенных окон не проверялись вручную. Unit nested guards не объявляются
доказательством всей browser matrix. UI изображений не доказывает API/stage.

### E-R3-01 · Побочный эффект существующего G07 теста

При свежем запуске G07 существующий screenshot path в
[access.spec.ts](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tests/e2e/access.spec.ts:1220)
перезаписал четыре PNG `artifacts/frontend-v2/us-m01-01/R2-codex/header-*.png`,
несмотря на новый Playwright output. Этот побочный эффект до запуска не был
выявлен. Пользователь уведомлён; исходники и принятый результат G01 не менялись,
повторная приёмка G01 не проводилась.

Текущие PNG, hashes и mtime сохранены в `qa/g07/` и `qa/g07-side-effects.json`.
Отдельные исторические копии в `qa4-header-evidence`, `R2-codex-final` и
`R2-codex-r3` сохранены. Их наличие не доказывает точный pre-run hash четырёх
перезаписанных файлов; восстановление наугад не выполнялось. Для следующего
поручения рекомендуется параметризовать screenshot destination; в текущем
read-only review тест не правился.

## Evidence и следующий шаг

- [QA report: команды, AC matrix, snapshot и ограничения](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/us-m02-04/Codex-R3/qa/report.md).
- [UI report: итог независимой роли](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/us-m02-04/Codex-R3/ui/report.md).
- [Capture addendum и provenance](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/us-m02-04/Codex-R3/qa/capture-addendum.md).
- [Build-transform audit](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/us-m02-04/Codex-R3/build-audit/report.md).
- [Source manifest R3b](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/us-m02-04/Codex-R3/manifest-R3b.json) и [UI manifest](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/us-m02-04/Codex-R3/ui-evidence-manifest.json).
- [Исходный handoff Claude R8](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/evidence/us-m02-04/Claude-R8/handoff.md).

Следующий шаг — отдельное исправление UI-R3-01 с новым snapshot и затронутой
приёмкой; общие format/lint gates учитывать отдельно. Текущий запрос разрешает
проверку: реализация исправления, сообщения Claude, commit/push/deploy/merge
не выполнялись. Review изменил только свои отчёты/артефакты и запись STATUS.
