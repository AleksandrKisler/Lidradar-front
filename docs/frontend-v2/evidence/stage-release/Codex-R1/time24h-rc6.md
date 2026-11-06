# 24-часовые поля времени · кандидат RC6 · 01.11.2026

По уточнению владельца AM/PM недопустимы в интерфейсе LidRadar. Замечание
UI-RC5-01 касается самого 12-часового отображения, а не только ширины поля.
Предыдущее решение оставить его как отдельный P3 было неверным.

Причина: нативный HTML `input type=time` отображается по правилам браузера/ОС,
хотя его значение и wire API остаются 24-часовыми HH:mm. `locale=ru-RU` в
Playwright не является гарантией формата нативного контрола. Источник:
[MDN input/time](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/time).
Время на backend не переводилось в 12-часовой формат; конвертация данных не нужна.

Исправление: график настроек и отдельный график онбординга используют текстовые
поля с numeric keyboard и явным HH:mm; общий UiInput с логическим type=time
показывает такой же контрол для сводки и тихих часов. При вводе 3–4 цифр
добавляется двоеточие с сохранением курсора. Границы не clamp-ятся, AM/PM
не конвертируется молча: недопустимый ввод остаётся для существующей валидации
формы и не отправляется на сервер. Другие типы UiInput, названия полей,
подписи, ошибки, disabled/busy, tenant guards и API-запросы сохранены.

Объём: US-M02-05/06, регрессия US-M02-02 и M10 preferences; не новая полная
приёмка всех историй M10. Исходники: BusinessHoursEditor/BusinessHoursFields,
shared UiInput/time-input/public export. Геометрические/empty assertions
переведены с type=time на имена полей; проверки сохранены.

Адресные результаты до заморозки: 42 unit PASS; Chromium6/6 — ru-RU/en-US ×
desktop/tablet/mobile. Проверены фактические text controls, ввод 00:00/23:59,
07:30/21:45, notification digest23:00/quiet22:30–07:00 и точные PUT values.
Первичные compiler/test failures сохранены в artifacts, не скрыты.
Финальные gates, независимые TEST/FUNCTIONAL/UI и actual stage записываются
отдельно после выполнения, этот документ не объявляет их PASS заранее.

Локальные evidence: `artifacts/frontend-v2/company-time-24h/Codex-R1/`.
Старый RC5/tag/PNG сохранены. Новый candidate/tag после проверки; production,
backend/API/миграции/зависимости/lockfile/бюджеты не меняются.
Параллельные Figma DESIGN/SOURCES/design-index/STATUS prose сохранены и не
включаются в точечный runtime commit, ими владеет другой автор.
