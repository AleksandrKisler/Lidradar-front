# План выпуска LidRadar · 01.11.2026

Сверка: 31.10.2026. Это план оставшихся работ, не разрешение на deploy и не
новая приёмка продукта. Доступ, онбординг и Radar приняты владельцем; повторная
реализация и повтор G01 не требуются. До фактического выпуска действует
[DESIGN-FREEZE.md](DESIGN-FREEZE.md).

Модуль исполнения: [Plane · Dev](https://plane.lid-radar.online/lid-radar/projects/2ce24cd0-4b50-418b-bbd4-6e2f83c7569e/modules/4d414892-37a7-4ffa-b26a-e6f4575bf561/).
Приоритеты ниже — порядок допуска к выпуску, а не оценка сроков. Дата сама по
себе не закрывает обязательные проверки. Ответственные указаны как роли;
персональные назначения требуют распределения команды.

Задачи заведены и проверены в модуле Dev 31.10: **9 новых + 1 существующая**.
LIDRADAR-10 дополнена диагностикой и критериями, её прежнее описание сохранено.
P0 в Plane отмечены Urgent, P1 — High; новые задачи в New, Telegram остаётся Confirmed.

| План | Plane                                                                       | Работа                              |
| ---- | --------------------------------------------------------------------------- | ----------------------------------- |
| R01  | [LIDRADAR-10](https://plane.lid-radar.online/lid-radar/browse/LIDRADAR-10/) | /start и личная доставка            |
| R02  | [LIDRADAR-16](https://plane.lid-radar.online/lid-radar/browse/LIDRADAR-16/) | Квалификация AI tuple               |
| R03  | [LIDRADAR-17](https://plane.lid-radar.online/lid-radar/browse/LIDRADAR-17/) | Сообщения → AI → риск → Radar       |
| R04  | [LIDRADAR-18](https://plane.lid-radar.online/lid-radar/browse/LIDRADAR-18/) | Финальная frontend-приёмка и triage |
| R05  | [LIDRADAR-19](https://plane.lid-radar.online/lid-radar/browse/LIDRADAR-19/) | Юридический допуск                  |
| R06  | [LIDRADAR-20](https://plane.lid-radar.online/lid-radar/browse/LIDRADAR-20/) | Лендинг и заявки                    |
| R07  | [LIDRADAR-21](https://plane.lid-radar.online/lid-radar/browse/LIDRADAR-21/) | Stage и реальная почта              |
| R08  | [LIDRADAR-22](https://plane.lid-radar.online/lid-radar/browse/LIDRADAR-22/) | Restore/rollback/retention          |
| R09  | [LIDRADAR-23](https://plane.lid-radar.online/lid-radar/browse/LIDRADAR-23/) | Эксплуатационные gates              |
| R10  | [LIDRADAR-24](https://plane.lid-radar.online/lid-radar/browse/LIDRADAR-24/) | Manifest и go/no-go                 |

## Что уже есть и что ещё не подтверждено

| Область                         | Подтверждено источниками                                                                                       | Остаток                                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Доступ, онбординг, Radar        | Принятые frontend/mock TEST/FUNCTIONAL/UI; исторический access R1 FAIL заменён более поздним R2/QA7 PASS       | Живой сквозной smoke конечного выпуска; доставка писем отдельно                                                                                   |
| Общая оболочка и узкие контролы | ML-S2 и N320-S1 приняты, format/lint блокеры закрыты                                                           | Не открывать повторно старые findings без воспроизведения на новом снимке                                                                         |
| Компания и график, US-M02-05/06 | Последний QA S2: TEST/FUNCTIONAL PASS; check/build×3/audit exit0, 1159 unit, 707 E2E passed, 2 прежних skipped | Desktop UI ещё UNVERIFIED по последнему найденному отчёту; tablet/mobile design отложен владельцем, narrow — регрессия                            |
| Песочница, US-M17               | Реализация localhost/stage и адресные тесты; production исключён владельцем                                    | Собственная независимая FUNCTIONAL/UI приёмка не найдена. Старый общий E2E FAIL не переносится автоматически: более поздний S2 full suite зелёный |
| Telegram                        | Пользователь подтвердил бизнес-входящие; существует LIDRADAR-10 про молчащий /start                            | Личная привязка и реальная доставка не работают по сообщению пользователя; причина на сервере не установлена                                      |
| AI                              | Данные, prompt, DEV/GOLDEN/HOLDOUT отчёты и предыдущая квалификация существуют                                 | Текущий manifest CANDIDATE; GOLDEN/отдельный HOLDOUT report passed:false, hardwareResult:null; несогласованность HOLDOUT summary с report         |
| Legal                           | Канонические Markdown и сгенерированные страницы приложения/лендинга; реквизиты заполнены                      | Юридическое заключение, подтверждение поданных уведомлений и фактического соответствия инфраструктуры отсутствуют в проверенных evidence          |
| Лендинг                         | Форма /api/lead с записью на свой сервер, legal pages и согласие реализованы                                   | Внешние Google Fonts/icons, дата 15.10 в countdown/copy, актуальность claims, приём и хранение реальных заявок                                    |

Свежий frontend report важнее промежуточного STATUS:
`artifacts/frontend-v2/settings-company/Codex-R1/S2/qa/report.md`.
Не считать более старый sandbox serial FAIL актуальным блокером этого S2.
Новые тесты при подготовке плана не запускались. Проверены SHA-256 **621
публичного input** S2: изменений нет; 7 env inputs исключены, содержимое секретов
не читалось. Это частичная сверка inputs, не новый TEST/FUNCTIONAL/UI PASS.

## Очередь задач и критерии завершения

### R01 · P0 · Telegram: восстановить /start и личную доставку

Использовать существующую **LIDRADAR-10**, не создавать дубликат.
Ответственные: backend/connector + эксплуатация; приёмка QA. US-M10-01/02/07.

Подтверждённое устройство кода: deep link строится по
`LIDRADAR_TELEGRAM_BOT_USERNAME`; исходящие сообщения отправляются токеном
`LIDRADAR_TELEGRAM_TOKEN`; inbound poller выбирает только активные
`CONNECTED_BUSINESS_BOT`. Отдельного входящего обработчика уведомительного
бота в исследованном backend не найдено. Если это разные боты и notification
bot не подключён к приёму, видимого пути обработать его `/start` нет. Это
**обоснованная гипотеза**, не установленная причина на живом сервере.

Порядок диагностики:

1. Зафиксировать среду/revision worker/api и время попытки без секретов.
2. Сверить identity бота из ссылки, исходящего токена и inbound connection
   через безопасный getMe; не сохранять токены или одноразовый payload.
3. Проверить получение `message` с `/start <payload>`, режим webhook/polling,
   отсутствие конкурирующего consumer; не удалять общую очередь обновлений.
4. Проверить redeem одноразового токена и GET статуса привязки. Привязка и
   отправка ответа — разные результаты: сбой sendMessage не доказывает сбой redeem.
5. Проверить исходящий relay из контейнера worker, затем notification → policy
   → delivery attempts → sendMessage → фактическое получение в тестовом чате.
6. Если требуется отдельный inbound для personal bot, оформить контрактное
   решение; frontend не меняет backend/API самостоятельно.

Готово: свежая ссылка → Start → ответ бота и linked:true; повтор/TTL/disable
без чужой перепривязки; одно разрешённое уведомление о риске доставлено ровно
один раз, ссылка и действия соответствуют правам. Сохранены обезличенные
correlation IDs, коды ошибок, версии и результат. Ручной sendMessage отдельно
не закрывает очередь приложения. Источники: backend
`internal/connector/application/polling.go:90`,
`internal/notification/infrastructure/telegram_control.go:66`,
`internal/notification/application/link.go:131`, `cmd/worker/main.go:156`;
docs `runbooks/telegram-manual-checks.md`, ADR 0060/0062, US-M10.

### R02 · P0 · AI: определить и квалифицировать релизный tuple

Ответственные: AI/Risk + QA; RG-AI, US-M13.
Не переписывать подготовленные наборы и не подменять baseline ради PASS.
Сначала сверить актуальный `models/manifests/lidradar-main-v1.json` с report,
selection и previousQualification: документация RG-AI описывает старую FROZEN
ревизию, текущий manifest — CANDIDATE v9r5. HOLDOUT summary и связанный JSON
расходятся. Разделить качество семантических фактов и конечных правил риска.

Готово: выбран конкретный tuple model/prompt/schema/validator/parameters/datasets;
manifest согласован с evidence; выполнены неизменные обязательные границы,
проверены независимые данные без выдачи уже прочитанного GOLDEN за слепой тест;
есть hardware/VRAM/OOM/latency report и сверка реально работающего узла.
Если кандидат не проходит, представить владельцу допустимый вариант поставки
или перенос; ограниченный режим не утверждать автоматически. Синтетические
метрики не выдаются за качество на реальных переписках.

### R03 · P0 · Реальные сообщения → AI → пять типов риска → Radar

Ответственные: backend/AI + QA, frontend только при подтверждённом дефекте.
Связать с существующей **LIDRADAR-9** («Сразу» не показывает риск), после
чтения её актуального описания. US-M04/M05/M07/M13; RG-AI/RG-EXTERNAL/RG-SSE.
Зависимости: R02 для семантических типов; R01 для финальной доставки.

Готово: на выделенном тестовом контуре входящее business-сообщение связано с
raw_event → conversation → AI job/result → risk ID; проверены пять правил,
порог «Сразу», рабочее время, timezone, повтор/редактирование/закрытие и
отсутствие дублей. NO_RESPONSE проверяется отдельно от семантического AI.
Причины, сроки и состояния в Radar соответствуют backend, изменения видны
online/visible не позднее 30 с при доступном сервере; уведомление проверено
по R01. Sandbox только localhost/stage, не включать её в production.

### R04 · P1 · Завершить приёмку конечного frontend снимка и triage открытых bugs

Ответственные: ведущий frontend → QA → visual review.
US-M02-05/06, связанные US-M16; отдельная приёмка US-M17 вне production scope.
Сохранить существующий QA S2 PASS и dirty/untracked inputs. Закончить desktop
UI настроек по реальным reference/browser PNG. Tablet/mobile redesign не
требуется; текущие узкие режимы проверить как регрессию.

Перед freeze разобрать LIDRADAR-11–15 по действующим US/API и текущему коду:
какие уже исправлены, воспроизводятся или требуют решения. В частности,
вопросы ролей и услуг не решать изменением бизнес-правил frontend.
Готово: каждому актуальному блокеру назначен исход и evidence; desktop UI
настроек принят; на конечном release snapshot check/build×3/audit и штатная
browser matrix зелёные без ослабления assertions/budgets. Повторять gates
только после изменения inputs или при подготовке окончательного кандидата.
Запас JS S2 — **178 байт** при прежнем лимите 905600; новые правки учитывать.

### R05 · P0 · Юридический допуск приложения и лендинга

Ответственные: владелец + юрист. RG-DATA; US-M14.
Уже готовые документы повторно не писать. Сверить реквизиты, хосты, провайдеров
VPS/S3/Postbox/Telegram relay/AI с фактической обработкой, проверить требуемые
уведомления и решения по обработке/трансграничной передаче через юриста.
Это исполнение внутреннего legal checklist, не новое юридическое заключение.

Готово: зафиксированы заключение/решения, подтверждения обязательных действий
и версия документов; нет неразрешённых обязательных пунктов. Generated HTML
соответствует канону и strict generator; ссылки и фиксация согласия проверены.
Обучение на реальных переписках не включается без действующего согласия,
revoke/export и отдельного допуска. Источник: backend `docs/legal/README.md`,
`docs/legal/app/ai-data.md`, RG-DATA, ADR 0056.

### R06 · P1 · Довести лендинг и форму к фактическому выпуску

Ответственные: frontend лендинга + эксплуатация + владелец claims.
Зависимости: R02 для AI claims, R05 для legal publication.
Локально разместить Roboto Flex и Material Symbols вместо Google Fonts.
Сверить дату/счётчик: `assets/app.js:11`, `index.html:70` всё ещё 15.10.2026;
историческую дату закрытой беты не подменять без проверки смысла timeline.
Сверить 96%/95% и остальные обещания с действующим `marketing/CLAIMS.md` и
выбранным tuple. Демонстрационные данные можно сохранить с честной подписью;
публиковать реальные клиентские данные для скриншотов не требуется.

Готово: на разрешённом контуре форма валидирует согласие и сохраняет одну
заявку, ошибки и retry понятны; проверены volume, доступ, отдельные backup и
retention `leads.jsonl` (в backup БД он не входит). Подтверждена судьба старого
Apps Script и заявок, если он был опубликован. Legal links работают, внешних
шрифтов нет, release copy актуален, README соответствует файлам.

### R07 · P0 · Stage: сквозная приёмка выпуска и доставка писем

Ответственные: QA + эксплуатация. US-M01/M02/M04/M07–M10/M16, journeys M16.
Зависимости: R01–R04, готовый release candidate.
Вход: `npm run dev:stage` через существующий proxy; сначала revision/OpenAPI
hash/миграции, включая 000032; выделенные accounts и mailbox, без сброса
общих данных/лимитов. Локальный backend не нужен.

Готово: приглашение/вход → восстановление и подтверждение почты с реальным
получением → onboarding → источник → риск → действие/исход/оплата → аналитика
→ личное уведомление проходят с persistence после reload. Проверены owner/
manager, две организации и отсутствие чужих данных. Сохранены версии и
обезличенные evidence; mock PASS не заменяет stage, старый RG-MONEY PASS_LOCAL
повторно не объявляется проверкой новых production образов.

### R08 · P0 · Backup, восстановление, откат и исполнение retention

Ответственные: эксплуатация/backend + QA. RG-DR/RG-DATA.
Переиспользовать прежние подтверждения; учение 19.10 было на почти пустой БД,
оно не подтверждает полный RTO. Не восстанавливать поверх production.

Готово: актуальная внешняя зашифрованная копия проверена восстановлением в
изолированном окружении; роли/RLS/ключи/фоновые процессы и erasure replay
работают; RPO ≤15 мин, RTO ≤4 ч измерены на представительном объёме. Проверены
резервный ключ, матрица сборка×схема и rollback/forward-fix; новые миграции
учтены. Retention/erasure-due/журнал и мониторинг подтверждены на целевом
контуре; журнал стираний применяется до открытия восстановленной БД.

### R09 · P0 · Эксплуатационный допуск: периметр, свежесть, нагрузка, мониторинг

Ответственные: эксплуатация/backend/QA. RG-DEPLOY/RG-SSE/RG-CAPACITY/RG-TESTS.
Готово: заполнена фактическая проверка целевого TLS/proxy/IP/закрытых портов/
readiness, worker/scheduler/AI/mail/relay и тревог. Есть обязательный backend
CI с PostgreSQL без missing-required skips. По согласованному стартовому
профилю измерены latency/errors/backlog/recovery с реальным AI и сетью;
проверены SSE reconnect/lost notifications/online-visible freshness ≤30 с и
tenant isolation. Указаны лимиты первого набора организаций и ответственный
за инцидент. Старые performance цифры не заменяют текущий mixed workload.

### R10 · P0 · Зафиксировать release manifest и выполнить go/no-go

Ответственные: ведущий релиза + владелец. Зависимости: R01–R09.
Готово: выбраны коммиты backend/frontend/landing, image digests, schema и
migration hashes, OpenAPI, AI tuple, конфигурация без секретов; каждому
обязательному gate приложены версия, дата, ответственный и evidence.
Заполненный manifest заменяет шаблон, `NOT_RUN` не превращается в PASS.
Готовность frontend CI проверить отдельно: release-button автоматически
проверяет только backend CI. Подготовить plan и конкретный rollback.

Фактические commit/push/merge/deploy — только по отдельному поручению.
После разрешённого deploy обязательны production smoke, один контролируемый
сквозной путь и мониторинг; при отказе остановить приглашения и исполнить
проверенный rollback/forward-fix. Пострелизные улучшения не смешивать с допуском.

## Порядок исполнения

1. Сразу: R01 и R02; параллельно независимые legal/landing/infra R05/R06/R08/R09
   и завершение текущей frontend-приёмки R04.
2. После фиксации tuple: R03; затем R07 на согласованном snapshot.
3. Все обязательные evidence сведены → R10 → решение владельца → отдельно
   разрешённый выпуск → smoke/наблюдение.

После релиза: новые API timing/activeCounts/полная история/чтение оплат,
крупные дизайн-изменения и несогласованный redesign tablet/mobile настроек.
Не превращать их в новые условия текущего релиза.

## Источники и границы сверки

- Frontend: ветка `frontend/v2-implementation`, HEAD
  `4e175e914719f380dcadb05ccf28d34e9de08439` + dirty/untracked.
- Backend: `stage`, HEAD `0d06d96b62b03947e6cda10615c8c57324a479f4` + dirty
  документация; только чтение. Лендинг: `main`, HEAD
  `d7b0cc3172ce0ee23d8018465cbcd97c97be1be2`.
- S2 frontend manifest: 628 inputs, SHA
  `9bd38b4a6a047f419e8fbf0f4c13cc6f45ad5815ab5e01c2a2ea9b2f94a1a4ee`.
- Evidence этой подготовки: `artifacts/frontend-v2/release-plan-2026-10-31/`;
  `frontend-input-check.json`, scoped briefs. Команды git/rg/cat/python — read-only
  для runtime; exit0. Один поиск отсутствующих файлов завершился exit1, тестом
  не является. TEST/FUNCTIONAL/UI/live stage в этой подготовке **NOT_RUN**.
- Принятые access evidence: `artifacts/frontend-v2/us-m01-01/R2-codex-r3/qa7-report.md`;
  Radar/US-M02-04 и ML/N320 — соответствующие handoff в `docs/frontend-v2/evidence/`.
- Backend: `docs/engineering/RELEASE_GATES.md`,
  `RELEASE_MANIFEST.template.json`, `docs/runbooks/release-button.md`,
  `telegram-manual-checks.md`, `ai-qualification.md`; модели и reports текущего дерева.
- Правило Telegram deep link: [официальная документация](https://core.telegram.org/bots/features#deep-linking);
  webhook/getUpdates: [Telegram Bot API](https://core.telegram.org/bots/api#getupdates).
  Кнопка Start передаёт payload обработчику; сама по себе не создаёт привязку LidRadar.

Исходники, тесты и прежние evidence не менялись этой подготовкой. Конфигурация
серверов и юридический допуск не проверены. Отсутствие evidence трактуется
как UNVERIFIED, а не как доказательство того, что сервер не настроен.
