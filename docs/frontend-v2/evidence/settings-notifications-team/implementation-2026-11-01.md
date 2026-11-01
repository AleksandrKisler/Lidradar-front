# Настройки · Уведомления и команда · Итоговая приёмка S10

Согласованный frontend/mock-объём реализован и принят:
**FUNCTIONAL PASS; UI desktop PASS, tablet PASS, mobile PASS**.
**Raw TEST остаётся FAIL** только по принятому владельцем исключению QA-S8-01.

Пакеты: N-SNT-REDESIGN-01, N-SN-ADAPTIVE-01, N-ST-ADAPTIVE-01,
N-SHELL-HEADER-01. Stories: US-M10-01…07, US-M11-01/04…08; связанные регрессии
M01/M11-02/03, Company/Services, onboarding/integrations и Privacy header.
[ТЗ](../../tasks/SETTINGS-NOTIFICATIONS-TEAM-REDESIGN-CODEX.md).

## Исключение владельца

[Решение 01.11.2026](accepted-contrast-exception-2026-11-01.md) разрешает
FUNCTIONAL/UI-приёмку при сохранённом FAIL. Desktop-ссылка «Аккаунт →» остаётся
`#0071E3` на `#F5F5F7`,14px normal: контраст4.31:1 вместо4.5:1.
Белая подложка не применяется. QA-S8-01 — **ACCEPTED EXCEPTION**, не исправлен.
Макеты, существующие тесты, assertions, coverage, browser coverage и бюджеты
ради PASS не изменялись. Других принятых дефектов нет.

## Принятый снимок

- Ветка `frontend/v2-implementation`; HEAD
  `1df33d785fe8400b5c7eb873aa5b9668c29a7f2f` плюс сохранённый dirty/untracked код.
- Immutable source: `/private/tmp/lidradar-notifications-team-s10`,1096inputs.
- Manifest SHA-256:
  `aa3ae00a23f8b8acaa9e5758000c729abebacb074ae63a23140ce66b2486520e`.
- Manifest/archive/relevant.diff находятся в
  `artifacts/frontend-v2/settings-notifications-team/Codex-R1/S10/`.
- После QA и UI все1096inputs совпали; основной runtime/tests/tooling/contracts/
  scripts соответствует снимку. `S10/final-after-ui-proof.json` — mismatches0.
- После поручения сохранить тесты172guarded tests/tooling/contracts/scripts
  побайтно совпадают с S8. Зависимости и lockfile не менялись.

Старые S1…S9 snapshots/отчёты/PNG/диагностика сохранены. Параллельные изменения
других задач, включая Codex config и design docs, не затирались и не выдаются
за авторство этой реализации. Новых commits/push/deploy/merge не выполнялось.

## Реализация и файлы

Уведомления: шесть правил, effective summaries режимов/каналов/quiet hours и
происхождения; clean/dirty/validation/loading/initial/stale/saved/error states.
Полные PUT и reset выбранного типа, раздельные command ACK/read recovery,
защита от поздних ответов. Личный Telegram: issue/check/pending/TTL/reissue/
disconnect, safe URL, ограниченный polling и очистка при закрытии/смене контекста.

Команда: active/disabled/history, роль и last-owner guards, invitation code
только в открытом success-окне, clipboard recovery, неизвестный POST без blind
retry. Подтверждённые команды не повторяются после failed GET; self-demotion/
self-revoke обновляют session и очищают tenant cache. MANAGER limited view
не запрашивает данные владельца и не предлагает его действия/маршруты.

| Область                                                    | Основные файлы                                                                                                                                                                   |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Notifications                                              | `src/pages/settings/ui/SettingsNotificationsPage.vue`; `src/features/edit-notification-preference/`; `src/features/link-telegram/`; `src/entities/notification/`                 |
| Team                                                       | `src/pages/settings/ui/SettingsTeamPage.vue`; `src/widgets/team/`; `src/features/team/`; `src/entities/team/model/date.ts`; `src/entities/team/ui/`                              |
| Session и layout                                           | `src/entities/session/model/session-store.ts`; `src/app/layouts/ShellLayout.vue`; `src/widgets/app-shell/ui/RadarShell.vue`; `SettingsPageHead.vue`; `SettingsTabs.vue`          |
| Shared/build                                               | `src/shared/ui/UiAlert.vue`; `UiSheetDialog.vue`; `UiTooltip.vue`; `tooling/vite/class-strings.ts`                                                                               |
| Проверки, созданные до запрета дальнейших изменений тестов | `tests/e2e/settings-notifications.spec.ts`; `settings-team.spec.ts`; `settings-desktop-header.spec.ts`; fixtures/unit/regression selectors; три capture spec в `tooling/visual/` |

Общий layout использует существующие токены. Desktop header на1440:
x280/y32,1120×44, отступ40 от sidebar; accent указан выше. Содержимое
Notifications/Team сдвинуто8px с сохранением интервалов. Tablet/mobile geometry
сохранена. В Privacy изменён только desktop header: полный body/dialog R57
вне поручения; старые overlay и tablet-ссылка не редизайнились.

## Закрытые замечания независимого UI

S8 был полностью просмотрен и получил FAIL по пяти группам. Они исправлены
в runtime без изменения макетов и существующих тестов:

1. Общая validation summary уведомлений видна над полями; inline errors
   сохранены. Прокрутка к summary выполняется только при submit.
2. Invite показывает summary и серую disabled create после invalid submit;
   исправление заметки восстанавливает доступность команды.
3. Telegram disconnect использует существующий danger token.
4. Busy Save/Create остаётся синим, Cancel серый; opacity0.45 для controls/
   checkbox row Notifications и0.65 для Team cards/textarea. Два exact SVG16×16
   экспортированы read-only из Figma, пути не перерисовывались; HTML inputs
   остаются настоящими disabled controls. Shared UiButton не менялся.
5. Mobile refresh retry растянут на доступную ширину в обоих разделах.

QA-S9-01 дополнительно выявил13px clipping поля при посимвольной коррекции
времени на малой высоте. S10 перенёс автоскролл из watcher в submit-handler.
Пять прежних keyboard probes прошли с теми же критериями, включая390×390
и1440×600; finding закрыт функционально и проверен в визуальной приёмке.

## Выполненные команды и результаты

Node24.19.0/npm11.17.0. Полные provenance/логи — `S10/qa/test-report.md`.

| Команда / проверка                               |                Exit | Результат                                                                                                            |
| ------------------------------------------------ | ------------------: | -------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                  |                   0 | 1213tests/106files; format/lint/FSD/API/types/coverage; architecture13cases                                          |
| `npm run build:dev`                              |                   0 | Local development build                                                                                              |
| `npm run build:pre-prod`                         |                   0 | 142файла равны capture и повторной штатной pre-prod сборке                                                           |
| `npm run build:prod`                             |                   0 | Local production-mode build, без deployment                                                                          |
| `npm run audit:release`                          |                   0 | JS903380/905600;CSS71967/72000;largest103901/110100;initial237710/304800                                             |
| Capture неизменёнными тремя spec                 |                   0 | 255/255,2.3min;228exact+9responsive+18Privacyheader                                                                  |
| Keyboard correction probes                       |                   0 | 5/5, включая обе low-height, критерии S9 неизменны                                                                   |
| Остальные focused probes                         | 0 после render wait | 15/15 meaningful cases;3первичных timing-diagnostics FAIL сохранены в QA-отчёте;ожидаемое opacity0.65 не ослаблялось |
| `CI=1 npm run test:e2e -- --fail-on-flaky-tests` |                   1 | 967cases;921PASS/12contrastFAIL/34SKIP;8.6min;36failed attempts,24retries,flaky0                                     |
| SHA/evidence/bundle guards                       |                   0 | 1096inputs/774capturefiles/142bundlefiles сохранены;old evidence без изменений                                       |

Все12failed cases и36failed attempts содержат единственную принятую причину
контраста. Raw FAIL не заменён PASS.34skips:30stand без выделенного opt-in
контура и4исходных browser-specific пропуска; они не объявляются проверенными.
Scoped Notifications42/42,Team30/30,Header36/36,time-format18/18 прошли во всех
трёх browser projects. Полная семантическая AC-матрица и границы live scope
приведены в QA-отчёте; зелёные команды не использовались как замена review.

## Независимые verdicts и изображения

QA: **FUNCTIONAL PASS в согласованном frontend/mock scope** с единственным
контрастным исключением. UI: **desktop PASS; tablet PASS; mobile PASS**.

Новые Source/Browser материалы находятся в `S10/capture/`, `S10/comparisons/`
и `S10/header-comparisons/`. UI reviewer проверил274основных пункта и5context:

- 228exact pairs, по76 на адаптив:50изменившихся пар просмотрены наS10,
  178перенесены из личного полного S8 просмотра после независимого пересчёта
  и строгого совпадения обоих native/actual SHA. Это не выдано за новый просмотр.
- 18Privacy header-only пар и5полных context просмотрены.
- 9Notifications responsive состояний (full+viewport),18Team CI PNG трёх
  browser projects и1functional390×390 PNG просмотрены.

Все пять групп S8 визуально закрыты. Новых in-scope замечаний нет. В Team
mobile loading сохранено927native/926browser: около1px в skeleton, без потери
или обрезания содержимого; независимым reviewer не назначен blocker.

Основные артефакты относительно
`artifacts/frontend-v2/settings-notifications-team/Codex-R1/`:

- `S10/qa/test-report.md`: TEST, FUNCTIONAL, AC matrix, commands/exits и proofs.
- `S10/ui/report.md`: три UI verdict и closure.
- `S10/ui/review-progress.json`: фактически просмотренные и hash-reused files/nodeIds.
- `S10/comparisons/index.json`, `S10/header-comparisons/index.json`: Native/Browser пары.
- `S10/ui/responsive-notifications.json`, `team-responsive/index.json`,
  `functional-extra.json`: дополнительные реальные browser PNG.
- `S10/final-after-ui-proof.json`: последний immutable/source equivalence guard.

Figma sources:228historical PNG/map сохранены;48updated desktop sources
применяются через desktopHeaderCorrection поверх approvedSnapshot. Их map SHA
`4a3140c5ee6ae184117e584894a20a085165a718dd944987ac165301bf99b515`;
два Privacy adaptive native — map SHA
`fc897515a05e712ffffed1419da7b378fec6b1d48009d494c9ded77023303ee7`.
Busy SVG metadata/hashes — `S9-preparation/busy-assets/`, только read-only export.

## Ограничения и handoff

Эта приёмка не доказывает live stage revision/readiness/OpenAPI hash/migrations,
реальное persistence/history/чужую сессию, invite redeem/expiry, Telegram Start/
one-use/delivery/quiet/digest workers/callbacks. Они **UNVERIFIED**, отдельно от
frontend mocks. Physical OS keyboard/native zoom не выводятся из browser emulation.
Privacy R57 body не принимался. Принятое исключение не является WCAG AA PASS.

Production, Figma, backend/API/generated, деньги/роли/lifecycle, зависимости и
lockfile не менялись. Preview остановлены,4173 освобождён; чужой4174 не трогался.
Изменения и evidence сохранены для review в текущем checkout. Согласованный
frontend/mock-объём завершён; живая интеграционная и выпускная приёмка остаются
отдельным объёмом. Push/deploy/merge и production этим результатом не выполнялись.
