# Backend-stage · ADR0067/0068 ·29.10.2026

Поручение владельца: перед дальнейшим frontend-QA обновить backend-stage;
frontend остаётся локальным. Frontend-реализация/её агенты в этой работе
не запускались. Этот отчёт — deploy/контрактные probes, не приёмка US A/B/C.

## Выпуск

| Параметр                                      | Подтверждено                                                                                                                                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stage                                         | `https://stage.app-lid-radar.ru`, VPS из runbook staging, пользователь deploy                                                                                                                 |
| Backend до → после                            | `14891671ffb3d5cf03dff0f9cd2aae17654bbc33` → `0d06d96b62b03947e6cda10615c8c57324a479f4`                                                                                                       |
| Отправка Git                                  | `origin/stage` fast-forward1489167..0d06d96, два готовых коммита ADR0067/0068; main/production не менялись                                                                                    |
| Frontend на VPS                               | Закреплён `2f3dea172e6443b0894e1ea212905a057052bddc` до и после; OCI revision web-образа тот же, новая локальная реализация не выкатывалась                                                   |
| Release tag                                   | `0d06d96b62b0`                                                                                                                                                                                |
| OpenAPI на VPS и опубликованный за Basic Auth | SHA256 `9f9766cc4d23e398268aabc68d8adae6db9bf3358bf14953b151f36c617e3027`                                                                                                                     |
| Migration/readiness                           | `000032_registration_invitation_check`, applied=latest, status ready, build modified=false                                                                                                    |
| Запуск                                        | `scripts/release.sh --branch stage --commit 0d06d96b62b03947e6cda10615c8c57324a479f4 --web-commit 2f3dea172e6443b0894e1ea212905a057052bddc --expect-tag 0d06d96b62b0 --yes` с штатным web-dir |
| План                                          | Dry-run прошёл до запуска; показал ровно один новый SQL 000032 и неизменный web commit                                                                                                        |
| Вывод оператора                               | `/home/deploy/lidradar-releases/adr0067-0068-20261029T155536Z.out`                                                                                                                            |
| Копия перед миграцией                         | `/var/backups/lidradar/lidradar-20261029T155942Z-XXx4RK.dump`                                                                                                                                 |

Штатный release завершился «Выпуск 0d06d96b62b0 принят»: seven services,
API/edge/web/backup/postgres здоровы, worker/scheduler running, внутренний
ready сообщает нужные revision/миграцию. Basic Auth, внешний live/закрытый ready,
HTTP→HTTPS, HSTS, webhooks/AI auth, роли DB и свежая off-host копия проверены
release smoke без отключения проверок. Raw credentials и дампы в Git не включены.

## Устранённая блокировка backup

До выпуска backup был unhealthy: последняя точка 25.10.2026,106 неудач,
ошибка защиты полного дампа RLS. Проверено: backup_runner состоит в
`lidradar_backup`, superuser/BYPASSRLS отсутствуют; не хватало только
`backup_read_all` на `public.sandbox_conversations`/`public.sandbox_messages`.

В одной транзакции восстановлены штатные SELECT grants/policies для backup-роли
на этих двух таблицах по образцу `scripts/sql/bootstrap-roles.sql`.
RLS/FORCE RLS и права приложения не отключались, строковые данные не менялись.
`lidradar-backup once` создал/загрузил/сверил off-host копию
`frequent/20261029T155103Z`; ошибок подряд 0, backup снова healthy.
После этого штатный release снял отдельную локальную копию перед миграцией.

Источник проблемы sandbox-таблиц отдельно в коде не исправлялся. При их
пересоздании нужно сохранить штатные backup-политики; не использовать
новый demo/sandbox reset как способ подготовки frontend-QA.

## Внешние контрактные probes

Доступ через уже настроенные credentials `.env.stage.local`, только в памяти
Node, с корректным Origin. Секреты/заголовки/cookie не печатались.

| Probe                                                          | Фактический ответ                                                                                              |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| GET `/api/v1/auth/registration`                                | 200, `mode=open`                                                                                               |
| GET `/api-docs/openapi.yaml`                                   | 200, hash совпал с целевым                                                                                     |
| POST precheck с пустым code                                    | 400 INVALID_ARGUMENT, no-store, без Set-Cookie                                                                 |
| POST precheck с непригодным code                               | 403 INVITATION_INVALID, no-store, без Set-Cookie                                                               |
| POST precheck с 43-символьным synthetic base64url code         | 403 INVITATION_INVALID, no-store, без Set-Cookie                                                               |
| POST register с заранее подтверждённым существующим demo email | 400 REGISTRATION_FAILED, `Registration could not be completed`, traceId есть, details/Set-Cookie нет, no-store |

Перед последним probe в БД read-only подтверждены существование указанного
демо-аккаунта и 21 пользователь; после отказа число пользователей осталось 21. Проверка отказа не предназначена для создания
аккаунта/отправки письма. Одна попытка register и проверки непригодного code
расходуют обычные лимиты stage; лимиты не сбрасывались и не обходились.
Реальный успешный 204 с приглашением, успешная регистрация, UI/адаптивы и
доставка письма этим deploy-smoke не проверялись; они относятся к QA US.

## Ограничения доказательств

GitHub Actions через API вернул 404; `gh` локально не авторизован. Удалённый CI
не объявляется успешным. Для этих неизменённых backend-коммитов ранее сохранены
локальные API/полный PostgreSQL/race/независимый review; перед коммитом 0068
source hash был сверен с report. Штатный stage release не обходился и прошёл
свои deploy-smoke gates. Production workflow не запускался.

Дальше: локальный frontend `npm run dev:stage`, предварительно подтвердить
актуальность stage и выделенные данные. Режим сейчас open; не менять общий
stage ENV ради закрытого сценария без согласованного окна. Mock-проверки C
не объявлять живым прохождением C на open-stage.
