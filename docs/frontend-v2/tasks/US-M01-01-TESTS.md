# US-M01-01 · Матрица тестирования и приёмки

Приложение к [согласованному ТЗ](US-M01-01.md), принято владельцем проекта
29.10.2026. Статус всех будущих прогонов —
**NOT RUN**. Таблица задаёт обязательства, не результаты.
Порядок: основная сессия Sonnet пишет код/тесты → QA тестирует и функционально
принимает → один UI-агент принимает все три размера. Бизнес-AC сохраняются.

Уточнение 29.10.2026: T29–T31 выполняются с локальным frontend dev:stage
и актуальным backend-stage; не требовать локального backend8080/8081.
Режимы/данные/почта и версия stage проверяются по
[общим правилам](../CLAUDE-OPERATING-RULES.md). Исторический BLOCKED из R1
из-за отсутствия локального backend не переносится на новую среду автоматически.

## Проверки и соответствие AC

В test-report для каждого ID нужны AC, fixture, точная команда/шаги,
expected/actual, exit code и revision. Канонические формулировки AC не сокращать
до списка счастливых путей. Unit покрывает переходы/гонки, component —
доступные действия, E2E — реальную сборку и navigation. Mock не доказывает БД.

| ID  | Уровень / проверка                                                                                                                                                                                              | AC                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| T01 | E2E: обе ссылки login, A/C по ответу режима, invite в обоих режимах                                                                                                                                             | G01, A01, B01, C02         |
| T02 | Unit/E2E: skeleton до свежего GET, cached open не открывает A; 5xx/timeout, ручной retry; B2 доступен при недоступном GET режима                                                                                | G09, G12, C04              |
| T03 | Component: единые поля A/B3, разные пояснения/ссылки, нет code field                                                                                                                                            | G02, A01, B07              |
| T04 | Unit/component: имя пустое/200 русских символов/201; password 11/12/1024/1025; неверная почта и точный текст; POST не уходит                                                                                    | G03                        |
| T05 | E2E: A без inviteCode, успех → session → company step; без создания организации                                                                                                                                 | A02, G06                   |
| T06 | E2E: A → B2 и C → B2 без прежнего proof/пароля; B3 → пустой B2 → другой код; Back/Forward                                                                                                                       | A03, B08, B14, C02         |
| T07 | Component/E2E: warning над карточкой C; disabled input/reveal/submit; Enter/клик не отправляет; login/legal/invite активны                                                                                      | C01–C04                    |
| T08 | E2E: open закрылся до POST, INVITATION_REQUIRED → fresh mode → C; нельзя повторить без кода                                                                                                                     | A04, G12                   |
| T09 | Component: 46/44/36/20, одна рамка 1 px, accessible name, placeholder/helpers, нет отдельной кнопки                                                                                                             | B02, G10                   |
| T10 | Unit/component: пустое manual, 42/44 символа, кириллица/недопустимый знак; normalization пробелов без lowercase; нет запроса                                                                                    | B03                        |
| T11 | Unit fake timers: ровно 400 мс; paste; IME; Enter/arrow до таймера; один inflight; нет resend при render/focus/error                                                                                            | B04–B06, G09               |
| T12 | E2E: задержанный 204, поле и действие disabled, значение сохранено, spinner20 центрирован; затем B3 без кода                                                                                                    | B06–B07                    |
| T13 | E2E/component: INVITATION_INVALID → красная граница/helper/!, код сохранён; edit → синяя стрелка; всех четырёх причин одинаковый UI                                                                             | B09, B15                   |
| T14 | Unit/E2E: 400, ORIGIN_NOT_ALLOWED, unexpected401, 404, timeout/offline/500 → service state, без красного !, B3 и session-loss redirect                                                                          | G09, B09                   |
| T15 | Unit/E2E: 429 с Retry-After, reload countdown, неверный header→60; другой код не обходит ожидание; по окончании нет auto request                                                                                | G09, B05                   |
| T16 | Unit/E2E: поздние success/error после route leave/reset/new code не возвращают прежний шаг; abort проверок                                                                                                      | G09, B08, B14              |
| T17 | E2E: обе персональные query-ссылки, replace code только один раз, flow сохраняется; query важнее storage; пустой/дублированный code→B2/error                                                                    | B01, B14                   |
| T18 | Unit/E2E: initial App loading до bootstrap не очищает query/контекст и не дублирует precheck при настоящем mount                                                                                                | B01, B14, G12              |
| T19 | Unit/E2E: F5 в B3 → server recheck перед B3; TTL 30 минут на границе, не продлевается; invalid JSON/schema/time, future/NaN/expired, storage throws→B2                                                          | B14, G09                   |
| T20 | Unit/E2E: clear context на другом коде/A/C/final403/успехе/logout/TTL; validated=true бесполезен; нет хранения пароля/PII/proof в запрещённых местах                                                            | B08, B14–B15               |
| T21 | Component/E2E: submitting «Создаём аккаунт…», запрет повторного POST, возврат из обычного отказа с сохранёнными данными                                                                                         | G04, G05                   |
| T22 | Unit/E2E A/B: новый 400 REGISTRATION_FAILED и legacy409 показывают одинаковый нейтральный блок; email не marked occupied; имя/email/скрытый password/context B сохранены, исправленный email и один явный retry | G05, B12; US-M01-02        |
| T23 | E2E: final INVITATION_INVALID после precheck → B2 красный!, без password/proof; revoked/expired/consumed, а не generic registration failure                                                                     | B11–B12                    |
| T24 | Unit/E2E: 201 + /me500 → retry только /me; /me guest не успех; timeout/потеря POST-response → reconcile, без второго POST; safe unknown outcome/login/recovery                                                  | G04, G09                   |
| T25 | E2E: platform/no membership + permission→company; employee membership→организация; account/logout, данные шапки; старые guards не обходятся                                                                     | G06–G07, B13               |
| T26 | E2E mock: frontend не вызывает повторную отправку почты на успехе; переход не ждёт почты; real delivery помечена отдельно                                                                                       | G08                        |
| T27 | E2E/visual/a11y: вся матрица A/B2/B3/C на трёх размерах, 375 px и промежуточные ширины; scroll/focus/Tab/Enter/labels/error association; busy без layout shift                                                  | G10, B02, C04              |
| T28 | E2E/visual: desktop footer на одной линии/64/24, legal target новой вкладки, C активен; все потребители AuthLayout                                                                                              | G11                        |
| T29 | Реальный backend: обе разновидности кода в open/invite_only; precheck204 без cookie/доменных эффектов; несколько check → одна регистрация; оба ответа совместимы с контрактом                                   | B01, B10–B13               |
| T30 | Реальный backend: revoke/expire/use между check/register; две вкладки с одним кодом → один успех; occupiedemail не расходует код; logout/reuse→403                                                              | B09–B12, B15               |
| T31 | Реальный backend: отдельные precheck/register/login limits, no-store, Retry-After; backend/схема нужной версии; письмо в разрешённом локальном mail sink независимо от онбординга                               | G08–G09, B10; US-M01-04/05 |

Тестовые коды синтетические, 43 base64url символа. Unit/mocks не выдают
случайный синтетический код за валидный на настоящем сервере. Для real QA
приглашения выдаются штатным способом в отдельном разрешённом локальном контуре;
подмены production ENV, прямых изменений БД и реальных внешних писем нет.
Если real QA недоступен, отметить T29–T31 BLOCKED, не запускать финальную
полную приёмку и не утверждать сквозной PASS. Mock-результат предъявить отдельно.

## Обязательные регрессии

| Связанные US                 | Что проверить                                                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| US-M01-02                    | Нейтральный отказ, сохранение формы и B, исправление почты, один успешный повтор; не раскрывать причину через общий error mapper |
| US-M01-03/04                 | Login/logout/session, обе ссылки; независимые лимиты, существующая глобальная HTTP-защита                                        |
| US-M01-05                    | Независимая отправка/подтверждение/явный resend, без дублирующего запроса из frontend                                            |
| US-M02-01/07                 | Переход клиента к компании и восстановление существующего пути; создание организации не выполняется на регистрации               |
| US-M11-01/02/03/08           | Сотрудник/платформенный код, выпуск/одноразовость/отзыв, отдельный accept для вошедшего пользователя                             |
| US-M16-03/04/05/06; J1/J3    | Offline/errors, прямые URL/F5/back, браузеры, адаптивы/клавиатура; owner и employee имеют разные конечные маршруты               |
| Все access-экраны AuthLayout | Footer и переносы на login/register/forgot/reset/verify-email; при изменении shared password/schema дополнительно US-M01-06/07   |

## Команды тестировщика

Из frontend, Node 24.19.0. Записывать фактический exit code и snapshot;
не запускать команды одновременно, если они делят preview server/порт 4173.
Обнаруженный в исходной базе сбой не скрывать; для сравнения нужен сохранённый
baseline, без stash/reset чужой работы. Новые unit-пути выбираются из diff.

```sh
npm run test:unit -- tests/unit/features/register-form.test.ts tests/unit/pages/invitation-registration.test.ts tests/unit/entities/session-store.test.ts tests/unit/app/guards.test.ts tests/unit/shared/client.test.ts tests/unit/shared/api-error.test.ts tests/unit/features/accept-invitation.test.ts
npm run test:e2e -- tests/e2e/access.spec.ts --project=chromium
npm run check
npm run build:dev
npm run build:pre-prod
npm run build:prod
npm run audit:release
npm run test:e2e
```

Дополнительно выполнить новые unit/model/context cases из diff и адресные
responsive/a11y suites; browser-матрицу сохранить штатную. `test:stand` только
для заранее выбранной разрешённой среды. Full suite не включает real stand
автоматически. Для визуального пакета адаптировать существующий capture под
состояния US, затем `npm run visual:capture` и `npm run visual:compare`;
не считать exit0 инструмента вердиктом о соответствии Figma.

Скриншоты: `document.fonts.ready`, синтетические стабильные данные/время,
зафиксированные анимации, ожидание конкретного состояния без arbitrary sleeps.
Сохранить Figma reference + browser actual + overlay/diff и измерения.
Capture и тесты не должны сохранять реальные коды/пароли/cookie; mock и real
контуры раздельные. Недостающий test/capture-код дописывает implementer,
после чего tester начинает проверку нового snapshot.
