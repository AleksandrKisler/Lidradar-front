# US-M01-01/02 · Codex R2

Дата: 29.10.2026. Основание — поручение владельца продолжить работу Claude,
сохраняя текущие изменения. R1 manifest/test-report остаются историческими.

**Итог: frontend/API TEST PASS и FUNCTIONAL PASS; UI desktop/tablet/mobile PASS.**
R1 и все дополнительные подтверждённые findings закрыты. Последний срез:
`5ebcb18f079df495fc9711601d1f06217b33cc3c42f820ce8642be1552f40085`.
Доставка email остаётся UNVERIFIED; ограничения живой среды и provenance ниже.

## Снимок и роли

HEAD `c9e676d`, ветка `frontend/v2-implementation`, сохранённая незакоммиченная
реализация плюс адресные исправления Codex. Изначально все 32 inputs checkpoint
совпали; регистрация не переписывалась заново.

Freeze: `5ebcb18f079df495fc9711601d1f06217b33cc3c42f820ce8642be1552f40085`,
541 input. Manifest: `artifacts/frontend-v2/us-m01-01/R2-codex/frozen-snapshot.json`.
Новые файлы включены в hash. Код не меняется во время независимой проверки.

Роли: Luna/high — read-only карта AC; Sol/medium — ограниченные изменения visual
harness и locale adapter; ведущий — общая регистрация, transport deadline, header,
E2E и живой stage; независимый Sol/high — TEST/FUNCTIONAL, после него Terra/high — UI.
Вложенные агенты не запускались. Владение общими файлами передавалось явно.

## Причины и исправления R1

| Finding    | Исправление и доказательство                                                                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-01       | `onRegisterError` сохраняет ApiError для rejected: оба согласованных кода дают один нейтральный блок. Unit воспроизвёл потерянную ошибку до правки; живой A/B подтвердил текст и сохранение данных |
| F-02       | Ручная проверка того же восстановленного кода сохраняет первый checkedAt. Добавлены service/429 restore→retry→expiry tests                                                                         |
| F-03       | Клиент завершает Promise по собственному deadline, даже если fetch не завершился после abort. Отмена вызывающего остаётся отменой; WebKit timeout проверен в браузере                              |
| F-04       | Полная ru locale заменена узким Intl adapter для шести strict tokens. date-fns сохраняет parsing/выбор единиц/rounding/DST; 255 differential cases совпали с прежней locale. Budgets не менялись   |
| F-05/07/08 | Видимый кодовый feedback отделён от sr-only announcement в locators; live regions сохранены. Ожидания загрузки и повторного действия проверяют нужное состояние, а не поздний новый запрос         |
| F-06       | Отдельный E2E: B3→login→invite требует нового precheck и сохраняет первоначальный TTL; пароль очищен. Переход к обычному A очищает приглашение                                                     |
| F-09       | Имя в AccountHeader доступно на mobile; шапка растёт по содержимому. 200 букв и оба действия проверяются на 320/390/834/1440 без переполнения/обрезки                                              |
| F-10…12    | Capture ждёт видимый aria-describedby message; встроенное B2 действие 44×44 больше не принимается за основную кнопку 46 px. Новые снимки/geometry/compare сохраняются отдельно от R1               |
| F-13/14    | Соответствие новых кадров выбранным эталонам и оставшиеся визуальные отличия проверяет независимый UI; старый regression baseline не доказывает соответствие Figma                                 |
| F-15       | Общий format gate включён. По отдельному разрешению владельца применён только Prettier к чужому us-m02-04-design-audit: текст и назначения ссылок сохранены                                        |

## Живой frontend → backend-stage

Локальный `dev:stage` на 5174 (5173 уже занят чужим процессом), существующий
proxy, revision `0d06d96b62b03947e6cda10615c8c57324a479f4`, migration
`000032_registration_invitation_check`, ready, API SHA-256
`9f9766cc4d23e398268aabc68d8adae6db9bf3358bf14953b151f36c617e3027`, mode=open.
Stage не обновлялся, общий режим/данные/лимиты не сбрасывались.

По предоставленным владельцем приглашениям выполнен адресный прогон: A создаёт
аккаунт и открывает компанию; B получает отказ на занятом адресе и сохраняет
данные/пароль/проверку; исправленный email с тем же кодом успешно создаёт второй
аккаунт без нового precheck; logout работает; использованный код даёт 403/B2.
Отдельно повторён нейтральный отказ A. Четыре POST register: 201/400/201/400;
два precheck: 204/403. Израсходовано одно приглашение, первый предоставленный код.
Артефакты содержат только synthetic emails/names и статусы, без codes/password/cookies.

`stage-report.json`, `logs/07-stage-ready.json`, `logs/08-stage-http.json`,
`stage-{a,b}-created-mobile.png` — в каталоге R2-codex.
Внешняя доставка email **UNVERIFIED**: адреса example.test, реального mailbox нет.
Режим invite_only и employee path проверяются детерминированно, общий stage ENV
ради них не менялся. Backend DB/race/mail-инициация имеют отдельный provenance
в `Lidradar/docs/engineering/evidence/2026-10-29/us-m01-0{1,2}/backend-verification.md`;
эти старые отчёты не являются новым frontend-прогоном или доказательством доставки.

## Независимая приёмка

Первый круг QA сохранён в `qa-report.md`/`qa-summary.json`, исходный freeze —
`frozen-snapshot-qa1.json`. Общие gates, 1058 unit, builds и release audit прошли;
matrix: 426 PASS / 2 FAIL / 32 SKIP (30 stand без конфигурации, два существующих
workspace keyboard skips WebKit/mobile). TEST FAIL, FUNCTIONAL BLOCKED.

QA подтвердил две причины: WebKit требует явного tabindex для обычного Tab к
встроенному действию; TTL, истёкший во время POST, не очищался сразу после отказа.
Добавлены `tabindex="0"` и очистка по окончании busy; при неизвестном исходе
proof удаляется с сохранением блокировки нового POST. Четыре новых regression
unit, включая 400/403/429 и unknown, проходят; оба browser T27 проходят без skip.
На новом freeze выше QA повторяет обязательные gates и независимую приёмку.

Второй круг (`qa2-report.md`/`qa2-summary.json`, `frozen-snapshot-qa2.json`):
TEST PASS — 1062 unit, builds/audit exit0, matrix 428 PASS / 32 SKIP / 0 FAIL.
FUNCTIONAL FAIL выявил два связанных обхода защиты: unknown→TTL и внутренние
переключения A/B/Back/Forward после unknown либо 201/session-error разрешали новый
POST. На третьем срезе lock сохранён в timer, reset-команде и обработчике query;
switch controls отключаются. Новые 79 model tests и 12 browser lock scenarios
проходят. QA3 перепроверяет весь текущий срез; старые результаты не переносятся
на него как новые.

Третий круг (`qa3-report.md`/summary, `frozen-snapshot-qa3.json`) сохранил
прошедшие check/build/audit и адресные locks; полная matrix остановлена после
нового подтверждённого busy→history обхода, exit130/NOT COMPLETED. Общий
`enter(query)` guard теперь защищает и submitting/account-created/reconciling,
и оба locked исхода. Три model regressions и расширенные 18 browser cases
проверяют все эти фазы, query-code privacy и завершение исходного POST.
Адресно: 82 model tests и 18 browser cases PASS. QA4 принимает текущий freeze;
обязательный check уже прошёл 1068 тестов, builds/audit exit0. Полная matrix,
окончательный FUNCTIONAL и UI на момент этой записи ещё выполняются.

Живой stage-прогон выше относится к срезу до QA lock-правок. Его успехи не
выдаются за новый запуск последнего hash: последующие изменения ограничены
Tab, TTL и блокировкой внутренних переходов во время/после отправки; эти ветки
перепроверяются детерминированными browser/model сценариями. Новые реальные
аккаунты/приглашения ради неизменившегося успешного пути не расходуются.

TEST/FUNCTIONAL и capture/compare выполняются на freeze выше. UI запускается
после обоих QA PASS. Итоговые команды, coverage и verdicts будут записаны
после получения независимых результатов; существующие результаты не подменяются.

### QA4 — TEST PASS / FUNCTIONAL PASS (frontend/API)

Срез `21063318bef6c8950360a03ecfd0fca27327e92ab6442f7fee27cb7ec05c62af`,
manifest `frozen-snapshot-qa4.json`: 541 input проверен до и после TEST без расхождений.
Независимый принимающий закрыл QA-R2-01…05, выполнил отдельный review 35+10 AC
после полного TEST. `qa4-functional.json` содержит scope и ограничения.

| Команда / проверка                                            | exit | Результат                                                                                            |
| ------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------- |
| `npm run check`                                               | 0    | 1068 unit, lint/FSD/API/typecheck/architecture/coverage PASS                                         |
| `npm run build:dev`                                           | 0    | PASS                                                                                                 |
| `npm run build:pre-prod`                                      | 0    | PASS                                                                                                 |
| `npm run build:prod`                                          | 0    | PASS                                                                                                 |
| `npm run audit:release`                                       | 0    | JS 904193 ≤ 905600, CSS 62731 ≤ 72000; остальные бюджеты/контракт/CSP PASS                           |
| `npm run test:e2e -- --workers=3 --retries=0 --reporter=list` | 0    | 446 PASS / 32 штатных SKIP / 0 FAIL, все 478 случаев                                                 |
| Независимый state sweep                                       | 0    | A/B × pending/unknown/created, TTL обоих порядков, Back/Forward/query-code, один POST, recovery PASS |

32 SKIP: 30 stand без конфигурации и два прежних workspace sidebar-keyboard
WebKit/mobile. Новый registration keyboard проверяется во всех трёх проектах
и не пропускается. Reporter=list сохраняет coverage тестов; generated HTML
предыдущего круга архивирован с SHA, чтобы служебный JS не загрязнял lint.
Ни ignore, ни assertions/budgets/browser matrix ради PASS не менялись.

Capture/compare и независимый UI — следующий gate; без просмотра изображений
визуальное соответствие пока не объявляется PASS.

### UI1 — FAIL, исправления перед QA5

Terra независимо просмотрела exact-frame и approved-pattern состояния трёх
адаптивов. Подтверждены UI-R2-01…03: desktop neutral-error карточки ниже на28px,
треугольник вместо круга у C warning и radius10 вместо4 у skeleton fields.
Предыдущие 90 actual/reference/diff и `ui1-review.md` сохранены в R2-codex.

Исправления ограничены представлением: typed optional icon у UiAlert с прежним
default, override для C; radius4 у loading-полей; desktop offset только у rejected
регистрации по exact nodes861:4730/5164. В capture/compare добавлены завершённый
paint, radius и y56 checks. Адресно18 кадров PASS, оба desktop y56, все три
placeholder radius4. Повторная полная приёмка выполняется QA5 на новом freeze
сверху. Новые полные кадры — `artifacts/frontend-v2/us-m01-01/R2-codex-final/`.

QA6 на `42247b69…08c50`: TEST/FUNCTIONAL PASS, check1068, matrix446/32/0,
builds/audit exit0 (JS904290/CSS62848). Capture90, compare1533/0. UI2 просмотрела
все90 actual/56 reference и закрыла UI1; единственный оставшийся F-14 P3 —
слишком светлый disabled placeholder пароля C. Этот пакет сохранён без изменений.

F-14 исправлен строго в `RegisterForm.closedField`: общий для трёх C-полей
placeholder:text-secondary. UiPasswordInput использовал browser placeholder mix,
в отличие от UiInput; shared input primitives при этом не менялись.
Адресно четыре viewport подтверждают одинаковый computed placeholder color у всех
трёх полей. Capture/compare теперь требуют наличие и равенство цвета.
Текущий freeze выше относится к QA7; новые кадры и итоговый отчёт —
`artifacts/frontend-v2/us-m01-01/R2-codex-r3/`. Итоговые результаты QA7/UI3 ниже.

## Итоговая QA7 / UI3 приёмка

541 input совпал до и после проверок. Актуальный пакет:
`artifacts/frontend-v2/us-m01-01/R2-codex-r3/`, `qa7-report.md`,
`qa7-summary.json`, `qa7-functional.json`, `qa7-capture-manifest.json`,
`image-delta.json`, `ui3-review.md`. Исходные R1/R2/QA1…6/UI1…2 не перезаписаны.

| Проверка на финальном source snapshot                 | exit  | Итог                                                          |
| ----------------------------------------------------- | ----- | ------------------------------------------------------------- |
| `npm run check`                                       | 0     | 1068 tests, lint/FSD/API/typecheck/architecture/coverage PASS |
| `npm run build:dev` / `build:pre-prod` / `build:prod` | 0/0/0 | PASS                                                          |
| `npm run audit:release`                               | 0     | JS904317 ≤905600; CSS62848 ≤72000; остальные gates PASS       |
| Full `test:e2e`, workers3, retries0, reporter=list    | 0     | 446 PASS / 32 штатных SKIP / 0 FAIL                           |
| Независимый FUNCTIONAL                                | —     | PASS, 35+10 AC, все пять дополнительных state findings closed |
| Capture90 / compare                                   | 0/0   | 1537 geometry/input checks, ошибок0; 56 reference pairs       |
| Single Chromium G07 header                            | 0     | 320/390/834/1440, полное имя200, metadata/SHA                 |
| Независимый UI3 Terra                                 | —     | desktop PASS / tablet PASS / mobile PASS                      |

UI3 реально повторно просмотрела восемь изменившихся actual и соответствующие
reference/pattern: четыре C-default и desktop B2-403, tablet B2-403/429/service.
Новая съёмка остальных82 actual, всех56 reference и четырёх header побайтно
тождественна полностью просмотренному UI2 пакету; это подтверждено image-delta.
Четыре дополнительных B2 SHA отличия не скрыты: reviewer сравнила их с текущими
эталонами/старыми изображениями, визуального дефекта не обнаружила; причина
изменения SHA не устанавливалась. Все UI1 findings и F-14 закрыты.

Exact-frame используется только там, где он есть в source-map. Adaptive neutral
error и B2 service/429 — approved-pattern, 375 — responsive regression без exact
frame. Статические картинки не подменяют отдельные API/keyboard/functional tests.
32 skips раскрыты выше, assertions/coverage/budgets/матрица не ослаблены.

Полная сквозная доставка email **UNVERIFIED**: в живом прогоне разрешены
синтетические example.test адреса. Stage mode C и employee invitation не
переключались/не создавались ради массовой проверки; эти frontend-ветки покрыты
mocks и отдельным backend evidence. Ни один такой пункт не получает фиктивный
real-world PASS. Backend/Figma/production этим frontend-пакетом не изменялись.
