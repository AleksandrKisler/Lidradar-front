# Настройки S10 · Stage RC8 · 01.11.2026

Владелец принял S10 и поручил коммит и публикацию на stage. Production не входит
в поручение. Это заменяет прежнее ограничение push/deploy для данного кандидата.

Кандидат: N-SNT-REDESIGN-01, N-SN-ADAPTIVE-01, N-ST-ADAPTIVE-01,
N-SHELL-HEADER-01; US-M10-01…07, US-M11-01/04…08.
[Итоговая приёмка](../../settings-notifications-team/implementation-2026-11-01.md):
S10,1096inputs, manifest SHA-256
`aa3ae00a23f8b8acaa9e5758000c729abebacb074ae63a23140ce66b2486520e`.
FUNCTIONAL PASS frontend/mock; UI desktop/tablet/mobile PASS. Raw TEST FAIL:
921PASS/12contrastFAIL/34SKIP, exit1; единственное принятое исключение QA-S8-01.
Макет, тесты и CI не меняются ради PASS.

Перед коммитом исходники/tests/tooling/contracts/scripts совпали с S10.
Параллельные правки Integrations и Codex config сохранены, в runtime-коммит
не включаются. Полный Git-visible dirty backup, diff и SHA записаны в
`artifacts/frontend-v2/settings-notifications-team/Codex-R1/stage-rc7/`.

Read-only preflight stage exit0: frontend RC6 `1df33d785fe8400b5c7eb873aa5b9668c29a7f2f`,
backend `ed577f84e992afb5b0564c685736976c0c3255d9`, оба checkout чистые,
7 services running/health, API SHA-256
`9f9766cc4d23e398268aabc68d8adae6db9bf3358bf14953b151f36c617e3027`,
миграция `000032_registration_invitation_check`, checksum прежний.
Выпуск frontend сохраняет эти backend/API/migration revisions.

## Коммиты и опубликованный кандидат

- `5d026577cb03f3a5d0411b21e3fa2f4cabdafcc4`: принятый S10,76 файлов.
  Annotated tag `release/2026-11-01-rc7` сохранён.
- `26c111ee75834f7c77b2f221b18b5ac5fa30b66b`: только удаление лишней пустой
  строки в `DESIGN.md`; новый annotated tag `release/2026-11-01-rc8`.
- Оба обычных atomic push в stage/feature и новые теги завершились exit0.
  Force push, amend и переназначение тегов не выполнялись.
- Stage опубликован с точного RC8;629 runtime/tests/tooling/contracts/scripts/
  build inputs равны S10. Бюджеты, assertions, CI и lockfile не менялись.

Изменения: Notifications page/preference editor/dialog/model, личный Telegram;
Team page/widgets/invite/member/revoke/date/role/icon primitives; session guards;
ShellLayout/RadarShell/SettingsPageHead/Tabs; opt-in UiAlert/Sheet/Tooltip;
class-strings build transform; unit/E2E/responsive/capture и source/evidence docs.
Полные пути и поведение — в итоговом отчёте S10 выше, точный состав —
`git show --stat 5d02657`, `stage-rc7/selected-paths.json` и `precommit.diff`.

## CI и команды

[RC8 GitHub run 41344194979](https://github.com/AleksandrKisler/Lidradar-front/actions/runs/41344194979)
завершён **FAIL**, auto stage-deploy **SKIPPED**. Все36 failed attempts имеют
единственную принятую причину QA-S8-01; других assertion errors и flaky нет.
Первый shard:484cases/476PASS/8FAIL/0SKIP/0flaky; второй:
483cases/445PASS/4FAIL/34SKIP/0flaky. Итого921PASS/12FAIL/34SKIP.

| Команда / шаг                                            |     Exit | Evidence / результат                                                                     |
| -------------------------------------------------------- | -------: | ---------------------------------------------------------------------------------------- |
| `npm run check` в CI                                     |        0 | 1213 unit/106files,architecture13; format/lint/FSD/API/typecheck/coverage                |
| Python stage-helper guard unittest                       |        0 | 10tests                                                                                  |
| `npm run build:dev`, `build:pre-prod`, `build:prod`      | 0 каждый | Все3 matrix jobs PASS                                                                    |
| `node scripts/release-audit.mjs`                         |        0 | JS903380/905600,CSS71967/72000; бюджеты прежние                                          |
| Container build/health/SPA/CSP/API smoke                 |        0 | CI container PASS                                                                        |
| `npm run test:e2e -- --shard=1/2 --fail-on-flaky-tests`  |        1 | Только8 accepted contrast cases,9.8min                                                   |
| `npm run test:e2e -- --shard=2/2 --fail-on-flaky-tests`  |        1 | Только4 accepted contrast cases,16.4min                                                  |
| Классификация всех36attempts и24error-context shard1     |        0 | Только color-contrast /account,#0071E3/#F5F5F7,4.31:1                                    |
| CI pre-prod bundle против S10                            |        0 | 141/141 uploaded files equal; hidden `.vite/manifest.json` не загружен Actions           |
| Stage `release.sh` exact backend/web SHA/tag `--dry-run` |        0 | План `ed577f84e992-w26c111ee`                                                            |
| Stage unused build cache prune старше24h                 |        0 | 5828348KB available;119 image tags сохранены                                             |
| Stage-only helper `deploy-web 26c111ee…`                 |        0 | Сборка,backup,start,health,штатный smoke; новых миграций нет                             |
| Read-only post-release verifier                          |        0 | 11checks PASS;frontend/image/ready точные;backend/API/миграция прежние;7services healthy |
| Running web container против CI prod                     |        0 | 141/141 files equal; дополнительные `.vite/manifest.json` и nginx `50x.html`             |

Первичный RC7 run41343992022 остановился на format FAIL `DESIGN.md` до тестов;
исправлен отдельным docs-only RC8. Первоначальная проверка Prettier внутри
ignored artifacts была неэффективна; исправлена явным `--ignore-path /dev/null`.
Исходные логи/снимки сохранены. Первичные diagnostic failures отсутствующего
hidden manifest, broad base64 regex и двух concurrently updated чужих docs
разобраны в `operations.jsonl`; это не замена или ослабление assertions тестов.

## Фактическая выкладка

По явному поручению владельца после приёмки S10 и QA-S8-01 выполнен ручной
stage-only выпуск через существующий `/opt/lidradar/stage-deploy.py`.
Обычный CI auto-deploy остался заблокирован; результат CI не переименован в PASS.
Требование зелёного CI из обычного потока не обобщается на другие выпуски:
это публикация конкретного принятого владельцем исключения.
Workflow, environment policies, assertions и health/backup/disk guards сохранены.

Stage: <https://stage.app-lid-radar.ru>, версия **`ed577f84e992-w26c111ee`**.
Резервная копия перед выпуском создана01.11.2026T20:21:36Z; прежние образы RC6
оставлены для штатного отката. Backend SHA, API hash и migration checksum выше
подтверждены до/после. Только staging project/domain; production не затрагивался.

Артефакты: `artifacts/frontend-v2/settings-notifications-team/Codex-R1/stage-rc7/`.
Имя каталога/этого файла историческое, актуальные метаданные — RC8.
Ключевые: `commit-source-proof.json`, `ci-summary.json`, CI logs/classification,
`server-before.json`, `server-after.json`, `deploy.log`, `stage-bundle-proof.json`,
`operations.jsonl`. Чужие исходники/документы сохранены, последующие Integrations
правки остались вне RC8; полный исходный dirty backup и текущие копии двух
параллельно изменённых docs сохранены отдельно.

## Live stage smoke

`node live-qa/live-smoke.mjs --ready-version ed577f84e992-w26c111ee`:
**exit0, PASS**,45checks/15route visits/22PNG. Chromium,ru-RU,Europe/Moscow:
desktop1440×1000,tablet834×1194,mobile390×844. Basic Auth/CSP/contract,
login/auth-me/secureHttpOnly session;5реальных GET200;6notification rules;
местный time draft/discard,Team invite form/cancel без POST/кода;
Privacy header-only и Company/Services route regression. Inter/assets готовы,
horizontal overflow нет; JS/API errors0,blocked business mutations0,logout204.
Login/logout — единственные разрешённые auth-записи; бизнес-данные не менялись.

У demo-аккаунта виден штатный email reminder89px: desktop header y121=89+32.
Сохранён контекстный PNG до скрытия. Нативная «Скрыть» меняет только
sessionStorage, без API. После неё строгие x280/y32/1120×44/accent#0071E3
прошли на всех3desktop routes. Общий auth banner не удалялся/не маскировался.

Первичные попытки сохранены отдельно: attempt1 exit1 до логина — ошибочное
ожидание публичного `/health/ready` вместо штатного404; attempt2/3 exit1 —
неучтённый email banner. Внутренняя readiness взята из строгого server-after
proof; геометрические criteria и бизнес-assertions не ослаблены. Это исправления
нового diagnostic script, runtime/tests кандидата не менялись.

Telegram unlinked: issue/connect/delivery NOT RUN. В демо-команде один owner,
editable member target отсутствует: role form/изменение роли UNVERIFIED live.
Persistence и настоящая email/Telegram delivery остаются UNVERIFIED.
S10 frontend/mock FUNCTIONAL/UI этим не переименовываются в live mutation PASS.

Evidence: `live-qa/report.json`, `command.json`, `report.md`, `png-manifest.json`
и22PNG. Основные Уведомления:
[desktop](../../../../../artifacts/frontend-v2/settings-notifications-team/Codex-R1/stage-rc7/live-qa/desktop-notifications-main.png),
[tablet](../../../../../artifacts/frontend-v2/settings-notifications-team/Codex-R1/stage-rc7/live-qa/tablet-notifications-main.png),
[mobile](../../../../../artifacts/frontend-v2/settings-notifications-team/Codex-R1/stage-rc7/live-qa/mobile-notifications-main.png).
Команда:
[desktop](../../../../../artifacts/frontend-v2/settings-notifications-team/Codex-R1/stage-rc7/live-qa/desktop-team-main.png),
[tablet](../../../../../artifacts/frontend-v2/settings-notifications-team/Codex-R1/stage-rc7/live-qa/tablet-team-main.png),
[mobile](../../../../../artifacts/frontend-v2/settings-notifications-team/Codex-R1/stage-rc7/live-qa/mobile-team-main.png).
Независимый reviewer реально просмотрел все22PNG и сверил их SHA:
**desktop PASS, tablet PASS, mobile UNVERIFIED** на первом post-deploy review.
На `mobile-notification-draft-safe.png` нижняя часть сфокусированного quiet-end
поля и рамки обрезана границей body/footer. Один статичный кадр не подтверждает
длительность/воспроизводимость; это пока не установленный runtime defect.
QA отдельно измеряет natural scroll settle и user-like keyboard sequence,
не меняя stage, runtime, existing tests или исходные22PNG.
Первичный review сохранён в `live-ui/report.md`, все22изображения/хеши —
`live-ui/reviewed-images.json`. Результат follow-up записывается отдельно.

## Новое замечание после выкладки: UI-RC8-01 / P3

Follow-up QA завершился **exit1** по строгому критерию полной видимости focus
outline. Два размера390×844/390×390, exact-fill и реальная Tab/type
последовательность; без forced scroll/CSS/масок. После стабилизации:

- Tab/type390×844: поле и outline полностью видны, clip0/0, PASS.
- Tab/type390×390: поле/значение целиком видны, но нижние4px outline обрезаны
  границей `.sheet-body`; strict visual criterion FAIL.
- Synthetic exact-fill на обоих размерах: поле clipped13px,outline17px;
  это отдельная автоматизированная последовательность, не результат Tab/type.

Независимый UI reviewer лично просмотрел12новых PNG и подтвердил
**desktop PASS, tablet PASS, mobile FAIL** в ограниченном live visual smoke.
UI-RC8-01 — новое открытое P3 visual/accessibility finding, не принятое
владельцем исключение QA-S8-01. Недоступность поля или потеря данных не доказаны.
Историческая приёмка S10 и исходные отчёты не переписаны; текущий post-deploy
результат указан отдельно. Stage сохраняет порученный владельцем S10/RC8;
runtime-fix/новый release внутри задачи публикации не выполнялись.

Evidence: `live-qa/followup-focus/report.json`, strict geometry/commands/12PNG,
`live-ui/followup-focus/report.md`, `reviewed-images.json`.
[Стабильный390×390 кадр](../../../../../artifacts/frontend-v2/settings-notifications-team/Codex-R1/stage-rc7/live-qa/followup-focus/user-tab-type-390x390-after-stable.png).
Все40 исходных QA files, включая22PNG/report/command/manifest, сохранили SHA;
source/tests и deployed candidate не менялись. API/JS errors0,business
mutations0,logout204. Следующая frontend-правка — отдельный точечный fix
UI-RC8-01 с новым snapshot/затронутыми gates и повторной mobile-приёмкой;
production по-прежнему вне поручения.
