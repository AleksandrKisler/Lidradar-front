# US-M01-01 · Source-map визуальных эталонов

Файл Figma `jN8Hhzn6ObIAEi7FoY9kPu`, страница «01 · Доступ». Экспорт выполнен ведущей
сессией 29.10.2026 через Figma MCP `get_screenshot` (read-only, `contentsOnly=true`,
масштаб 1:1, размер = исходный размер кадра). Figma не изменялась.
Эталоны: `artifacts/frontend-v2/us-m01-01/reference/<имя>.png`,
SHA-256 — `artifacts/frontend-v2/us-m01-01/reference.sha256`.

Состояния кадров найдены в сетках `461:5460` (desktop), `461:5475` (tablet), `461:5490` (mobile)
по названию кадра верхнего уровня; вложенные слои за экраны не выдаются.

## Desktop 1440×1000 (сетка 461:5460)

| Имя эталона                  | Node       | Состояние                         |
| ---------------------------- | ---------- | --------------------------------- |
| desktop-login                | `773:6361` | Вход, две ссылки                  |
| desktop-b2-default           | `777:6397` | B2 исходное                       |
| desktop-b2-format            | `462:6402` | B2 ошибка формата                 |
| desktop-b2-check             | `811:7463` | B2 проверка кода                  |
| desktop-b2-skeleton          | `811:7551` | B2 плейсхолдер                    |
| desktop-b2-403               | `811:7613` | B2 INVITATION_INVALID             |
| desktop-b3-default           | `783:6429` | B3 обычное                        |
| desktop-b3-email-error       | `811:7874` | B3 локальная ошибка почты         |
| desktop-b3-submitting        | `462:6521` | B3 отправка                       |
| desktop-b3-skeleton          | `462:6648` | B3 плейсхолдер                    |
| desktop-a-default            | `784:6465` | A обычное (mode=open)             |
| desktop-a-email-error        | `811:7876` | A локальная ошибка почты          |
| desktop-a-submitting         | `811:7877` | A отправка                        |
| desktop-a-skeleton           | `811:7677` | A плейсхолдер                     |
| desktop-c-default            | `788:6501` | C закрытая регистрация            |
| desktop-c-skeleton           | `811:7751` | C плейсхолдер                     |
| desktop-b3-generic-error     | `861:4730` | US-M01-02 нейтральный отказ B     |
| desktop-a-generic-error      | `861:5164` | US-M01-02 нейтральный отказ A     |
| desktop-footer-forgot        | `462:5677` | Footer-регрессия: forgot-password |
| desktop-footer-reset-invalid | `462:5880` | Footer-регрессия: reset-invalid   |
| desktop-footer-reset         | `462:5767` | Footer-регрессия: reset-password  |
| desktop-footer-verify        | `462:5966` | Footer-регрессия: verify-email    |

Service-сбой и 429 B2 отдельных кадров не имеют: сверка по паттерну B2 default/format
(синяя стрелка, текст подсказки), без заявления pixel-эталона.

## Tablet 834×1194 (сетка 461:5475)

| Имя эталона           | Node       | Состояние                                                              |
| --------------------- | ---------- | ---------------------------------------------------------------------- |
| tablet-login          | `464:6336` | Вход (кадр «Актуально», вторая ссылка — pattern по desktop `773:6361`) |
| tablet-b2-default     | `795:6740` | B2 исходное                                                            |
| tablet-b2-format      | `811:7891` | B2 ошибка формата                                                      |
| tablet-b2-check       | `811:7892` | B2 проверка                                                            |
| tablet-b2-skeleton    | `811:7893` | B2 плейсхолдер                                                         |
| tablet-b2-403         | `820:7301` | B2 403                                                                 |
| tablet-b3-default     | `464:6792` | B3 обычное                                                             |
| tablet-b3-email-error | `464:6911` | B3 ошибка почты                                                        |
| tablet-b3-submitting  | `464:7031` | B3 отправка                                                            |
| tablet-b3-skeleton    | `464:7159` | B3 плейсхолдер                                                         |
| tablet-a-default      | `822:7756` | A обычное                                                              |
| tablet-a-email-error  | `822:7847` | A ошибка почты                                                         |
| tablet-a-submitting   | `822:7940` | A отправка                                                             |
| tablet-a-skeleton     | `822:8035` | A плейсхолдер                                                          |
| tablet-c-default      | `822:8131` | C основное                                                             |
| tablet-c-skeleton     | `822:8230` | C плейсхолдер                                                          |
| tablet-footer-forgot  | `464:7298` | Регрессия оболочки: forgot-password                                    |

Generic error (US-M01-02) — pattern-based сверка, pixel-эталона tablet нет.

## Mobile 390×844 (сетка 461:5490)

Кадры Figma 390×844 обрезают документ (полная высота до 1037 px): эталон покрывает
первый viewport; хвост документа сверяется по измерениям и прокрутке, не pixel-diff.

| Имя эталона           | Node       | Состояние                      |
| --------------------- | ---------- | ------------------------------ |
| mobile-login          | `464:8980` | Вход (вторая ссылка — pattern) |
| mobile-b2-default     | `795:6848` | B2 исходное                    |
| mobile-b2-format      | `811:7895` | B2 ошибка формата              |
| mobile-b2-check       | `811:7896` | B2 проверка                    |
| mobile-b2-skeleton    | `811:7897` | B2 плейсхолдер                 |
| mobile-b2-403         | `820:7617` | B2 403                         |
| mobile-b3-default     | `464:8859` | B3 обычное                     |
| mobile-b3-email-error | `464:9435` | B3 ошибка почты                |
| mobile-b3-submitting  | `464:9555` | B3 отправка                    |
| mobile-b3-skeleton    | `464:9683` | B3 плейсхолдер                 |
| mobile-a-default      | `822:8699` | A обычное                      |
| mobile-a-email-error  | `822:8790` | A ошибка почты                 |
| mobile-a-submitting   | `822:8883` | A отправка                     |
| mobile-a-skeleton     | `822:8978` | A плейсхолдер                  |
| mobile-c-default      | `822:9074` | C основное                     |
| mobile-c-skeleton     | `822:9173` | C плейсхолдер                  |
| mobile-footer-forgot  | `464:9823` | Регрессия оболочки             |

375 px и промежуточные ширины — responsive regression без Figma-кадра.
Generic error — pattern-based.
