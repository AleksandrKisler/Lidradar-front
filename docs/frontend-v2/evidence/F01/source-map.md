# F01 source-map (Доступ)

Получено 2026-10-26 через Figma MCP (`get_design_context` + `get_screenshot`, 1×).
Локальные экспорты: `artifacts/frontend-v2/F01/reference/` (игнорируется git; воспроизведение —
`tooling/visual/README.md`). Исправление индекса: `login-phone-reference-correction.md`.

| Node         | Имя / состояние                                                   | Viewport  | Экспорт                           | Кадр реализации                             |
| ------------ | ----------------------------------------------------------------- | --------- | --------------------------------- | ------------------------------------------- |
| 462:5453     | Вход · desktop                                                    | 1440×1000 | reference/login-desktop.png       | actual/login-desktop.png                    |
| 464:6336     | Вход · tablet                                                     | 834×1194  | reference/login-tablet.png        | actual/login-tablet.png                     |
| **464:8980** | **Вход · phone · Исходное** (viewport 390×844, документ 390×1154) | 390×844   | reference/login-phone.png         | actual/login-phone.png (full-page 390×1154) |
| 464:9085     | Вход · phone · Ошибка (документ 390×1258)                         | 390×844   | reference/login-phone-error.png   | actual/login-phone-error.png (390×1258)     |
| 464:9205     | Вход · phone · Отправка                                           | 390×844   | reference/login-phone-busy.png    | actual/login-phone-busy.png                 |
| 464:9319     | Вход · phone · Первичная загрузка                                 | 390×844   | reference/login-phone-loading.png | actual/login-phone-loading.png              |
| 464:8859     | **Регистрация** · phone (не вход)                                 | 390×844   | reference/register-phone.png      | actual/register-phone.png                   |

История: ранее 464:8859 ошибочно считался входом на телефоне (ошибка индекса, исправлена
Codex); он используется только как register-phone.

Условия съёмки: Chromium 1243, DPR 1, `ru-RU`, `Europe/Moscow`, reduced-motion,
`document.fonts.ready`, мок гостя (401), фокус снят, курсор убран (иначе hover на кнопке).
Видимая область 844 сравнивается попиксельно (порог 24/255); full-page высота сверяется
по метаданным Figma (1154 и 1258 — совпадают). Доля расхождения не критерий качества:
остаток — подпиксельный антиалиасинг глифов.

Намеренные отличия: заголовок «Вход в LidRadar» вместо «Войдите в своё рабочее пространство»
из US-M01-03; значение email во вводе — цвет ink (в Figma серый, как у placeholder);
«Входим…» показано визуально, доступное имя кнопки остаётся «Войти»; первичная загрузка
показывает каркас входа только при открытии адреса `/login`.
