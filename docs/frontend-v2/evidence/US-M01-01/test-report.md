# US-M01-01 · Test report

## R1 — FAIL (tester), 29.10.2026

Снимок: HEAD `3844681` + `R1/files.sha256` (`1a53a121…cb82`); tester подтвердил 32/32 OK в начале и в конце.
Окружение: Node 24.19.0, npm 11.17.0, Playwright 1.63.0, Chromium 153.0.8010.12, WebKit 26.6, macOS 27.0.1.
Логи: `artifacts/frontend-v2/us-m01-01/R1/logs/`.

| Команда                                                           | exit | Итог                                                       |
| ----------------------------------------------------------------- | ---- | ---------------------------------------------------------- |
| test:unit (10 адресных файлов)                                    | 0    | 191/191                                                    |
| test:e2e access.spec.ts chromium                                  | 1    | 25 failed / 33 passed                                      |
| test:e2e access.spec.ts chromium `--repeat-each=2`                | 1    | 49 failed / 67 passed                                      |
| npm run check                                                     | 1    | format:check (документы ведущего и чужой файл, не R1)      |
| lint / lint:fsd / api:check / typecheck / coverage / architecture | 0    | 797 тестов; 95.27/88.58/96.9/97.25 %                       |
| build:dev / build:pre-prod / build:prod                           | 0    | —                                                          |
| audit:release                                                     | 1    | total JS 916208 > 905600 (HEAD 899661)                     |
| test:e2e (полная матрица)                                         | 1    | 76 failed / 346 passed / 32 skipped — все в access.spec.ts |
| visual capture us-m01-01                                          | 1    | 32 failed / 58 passed                                      |
| us-m01-01-compare                                                 | 1    | 36 ошибок (32 нет кадра, 4 ложные geometry)                |
| visual:capture / visual:compare (регрессия)                       | 0/0  | 204 / 207 пар                                              |
| Real backend T29–T31                                              | —    | BLOCKED: локальный backend на 8080/8081 не запущен         |

Findings R1: F-01 нейтральный отказ показывает «Что-то пошло не так»; F-02 продление TTL при
ручном повторе после сбоя restore; F-03 WebKit AbortError → бесконечный skeleton; F-04 бюджет JS;
F-05 дубли live region / strict locators; F-06 конфликт G01/B14 (решение ведущего: явный клик
на /login → новый вход B2); F-07/F-08 нестабильные/неверные тесты; F-09 имя скрыто в шапке mobile
(pre-existing, решение ведущего: шапку не менять, тест адаптировать); F-10 32 кадра не сняты;
F-11/F-12 evidence; F-13 старые пары F01/F03 (ограничение); F-14 placeholder пароля/сдвиг C 1 px
(на UI-приёмку); F-15 форматирование документов (исправлено ведущим).

Решение: возврат implementer → R2. Приёмка R1 не запускалась.
