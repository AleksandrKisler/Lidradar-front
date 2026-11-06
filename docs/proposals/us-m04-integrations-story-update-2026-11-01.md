# US-M04 · Backend-документация · 01.11.2026

По явному поручению владельца канонические истории синхронизированы с
согласованными макетами R1+R2 и историями Figma. Изменения API и backend-кода
запрещены и не выполнялись.

В `Lidradar/docs/user-stories/13-channels.md` обновлены US-M04-01/02/04/05:
дата/ссылки согласования, обычный Telegram/Secretary Mode, Empty с логотипом,
бейджи и ошибки чтения, удалённая проверка и сохранённые данные, CheckError
со значком над кнопками, SourceError, полное/частичное отключение и повтор.
Интервалы живого наблюдения10–30 секунд и одна минута сохранены.
UI-подписи отделены от существующего машинного контракта: новые provider,
значения API-статусов или endpoints не вводились.

Все20 прежних AC сохранены. Добавлены21: AC-M04-02-13–16,
AC-M04-04-01–09, AC-M04-05-01–08. Итого41 уникальный критерий:
8/16/9/8 по историям01/02/04/05; все REQUIRED_NOT_VERIFIED.
US-M04-03/06 сохранены побайтно. В `30-journeys.md` изменена только строка
J1/шаг4: подтверждённое подключение, «Активно» и независимые личные уведомления.

Источники: [M04 в Figma](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=689-3926),
[основные состояния](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=403-3265),
[локальные результаты](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=403-3266).
Принятый снимок историй SHA4a1eb8b64ab1; новое read-only чтение всех6 текстов
совпало с ним6/6. Session `fe87d335-9ec0-4ce9-b9a2-1bbe0850d731`.
BACKEND_SPEC/DOCS_GOVERNANCE прочитаны как ограничения; контракты не изменены.

Backend: ветка `codex/stage-telegram-notifications`, прежний HEAD
`e7f87671ab6cf47baade7f809c3497d8e2e84ca4`. До задачи clean, после — diff
только двух указанных Markdown-файлов, новых untracked backend-файлов нет.
API/OpenAPI, backend-код, миграции, схема/generated/тесты не менялись.
Figma только читалась. Production не затронут; commit/push/deploy/merge не было.
Параллельная frontend/stage работа и чужая dirty tree сохранены.

Проверки документации Python — exit0:41 уникальный AC с непрерывными номерами,
20 старых строк AC сохранены,03/06 побайтно прежние, J1 отличается одной строкой,
42 локальных назначения ссылок существуют; backend diff ограничен двумя docs.
`git -C ../Lidradar diff --check` — exit0. Это DOC CHECK PASS.
`go test ./...`, TEST/FUNCTIONAL/browser UI/stage и живой Telegram не запускались:
изменена только документация, продуктовый PASS не присваивается.

Evidence: `artifacts/frontend-v2/integrations-backend-stories-2026-11-01/` —
before/after обоих документов, live Figma read, validation.json и manifest/SHA.
Manifest SHA-256 `c3443dc8e94f5937fa2457c55e30f792444512341af83a29805625bc257e6e26`.
Исходный channels SHA2485050c…; итоговый
`ab44a972bdf877746a30ef56ca60d00bd652debe2ea1cae4184ceb864346a0e6`.
Служебные изменения frontend-документации этой задачи: этот отчёт,
`docs/frontend-v2/STATUS.md`, `SOURCES.md`, `design-index.json`.

Этап обновления канонических историй завершён. Следующий этап — решение
и границы реализации с сохранением запрета на изменение backend/API;
реализация и продуктовая приёмка этой редакцией не запускаются.
