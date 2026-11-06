# Интеграции · правки дизайна · 01.11.2026

01.11.2026 владелец явно согласовал макеты R1+R2 и поручил обновить истории
в Figma. Записи ниже описывают подготовку до согласования; актуальное решение
и результат — [согласование/истории](integrations-stories-2026-11-01.md),
manifest `artifacts/frontend-v2/integrations-story-update-2026-11-01/manifest.json`.

## Уточнение R2 · восстановлен значок ошибки проверки

По замечанию владельца в CheckError `404:4301` возвращён утраченный при
переносе в баннер восклицательный знак слева от текста. US-M04-04.
Исправление применено к desktop/tablet/mobile `404:4301`/`404:4405`/`404:4510`.
Значок20×20 — экземпляр существующего critical icon, gap8; текст и кнопки
сохраняют компоновку. Размеры карточек760×329/770×329/358×539 прежние.
У баннера1539:4226 добавлено BOOLEAN-свойство
`Показать значок ошибки#1549:0`, включённое только в трёх CheckError masters.
Тексты и размеры трёх SourceError баннеров до/после совпали.

Новый снимок — `artifacts/frontend-v2/integrations-design-2026-11-01/icon-fix-r2/`:
fix.js, mutation.json, audit.json, три реально просмотренных PNG и manifest.json
с SHA-256. Предыдущий снимок и его индекс сохранены. Структурная проверка
видимости/размера значка и положения текста PASS3/3; визуальный просмотр
desktop/tablet/mobile PASS. Независимые продуктовые TEST/FUNCTIONAL/browser UI
не запускались; runtime/API/production не менялись.
`curl` exit0, просмотр `view_image` выполнен; JSON-валидация и diff-check exit0.
Первое чтение Figma завершилось transport error до любых изменений;
повторное чтение успешно, мутация выполнена один раз. Макеты готовы к просмотру.

## Исходная итерация R1

`N-INTEGRATIONS-DESIGN-01`: все шесть замечаний владельца внесены в существующую
Figma. Статус — готово к просмотру владельцем; новое согласование не присвоено.
Связанные истории: US-M04-01/02/04/05; ограничения US-M04-03/06 сохранены.
Истории, backend/API, runtime и тесты этим поручением не менялись.

## Результат

1. Индикация источников приведена к формату Уведомлений `1393:15640`: цельный
   семантический бейдж высотой28px, иконка14px, Inter Regular12/18, gap6,
   горизонтальные отступы10. Success/danger/warning/neutral сохраняют смысл
   состояния. Обновлены30 Source masters, на странице проверен41 бейдж,
   включая локальные результаты операций и адаптивные viewport-примеры.
2. FirstError: иконка и текст находятся в одной горизонтальной auto-layout
   группе; заголовок не начинает отдельный блок после иконки. Все три адаптива.
3. CheckError: ошибка вынесена баннером над действиями по эталону `1398:16378`.
   На desktop/tablet все три кнопки находятся в одной строке. Mobile сохраняет
   штатную раскладку: основное действие и пара вторичных, без влияния ошибки
   на перенос кнопок.
4. SourceError использует тот же баннер с заголовком и сохранённым пояснением.
5. «Telegram Business» заменён на «Telegram». На всей странице Интеграций
   не осталось Business/Buisness. Регистрация бота и сценарии не изменены.
6. Кнопка Empty «Подключить Telegram» содержит существующий векторный логотип
   Telegram. Desktop/tablet268×46; mobile — по ширине карточки.

Общие компоненты кнопок/иконок/токены не изменены. Добавлены изолированные
`HIG / Integration / Error banner`1539:4226 и
`HIG / Integration / Telegram connect`1539:4227. Баннер имеет TEXT properties
для заголовка/пояснения и BOOLEAN для видимости пояснения; кнопка — TEXT подпись.
В Source/Panel обновлено36 вариантов из39; NoPermission не перерабатывался.
Новые размеры четырёх полных страниц: CheckError tablet1253/mobile1627,
SourceError tablet1297/mobile1735. В UI Kit устранены пересечения выросших
карточек. Основные root IDs сохранены.

## Ссылки

- [Основные состояния и адаптивы](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=403-3265).
- [Локальные результаты](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=403-3266).
- [Desktop · ошибка проверки](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=404-4230).
- [Tablet · ошибка источника](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=404-4735).
- [Mobile · ошибка источника](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=404-4846).

## Снимок и проверки

Каталог `artifacts/frontend-v2/integrations-design-2026-11-01/`:
`manifest.json`, scripts01–07, raw mutation/audit results, 21 финальный PNG,
референсы и первоначальные изображения. SHA-256 всех файлов — `sha256.json`.
Figma session `9d14b55e-98ff-428d-98a7-71449143aaff`.
Индекс снимка SHA-256:
`f3e6c3c93e5a51fdcda98b69c5e7d34edc45b64af67338d4645ac45ca8c01c70`;
50 файлов в индексе, в том числе21 итоговый PNG; сам sha256.json не включён.

- Структурная проверка `07-audit-token.js` — PASS:41 бейдж,38 именованных
  source/panel instances с editable layers/Inter и без полного UI raster,
  36 основных frames без выхода непосредственных детей за нижнюю границу,
  desktop/tablet CheckError —3 кнопки на одной строке, Business-упоминаний0.
- Реально просмотрены15 карточек: Default/FirstError/CheckError/SourceError/Empty
  ×desktop/tablet/mobile; ещё3 полные страницы SourceError и3 локальных результата
  с warning/neutral/partial-disconnect. Scoped Figma visual: три адаптива PASS.
  Это просмотр ведущим, без независимого продуктового UI verdict.
- Доступ: до/после7292 узла, FNV1a32 `fb95b7a0`, без изменений. Экземпляров
  Integration Source/Panel в Доступе нет; frozen scope сохранён.
- Первоначальный audit FAIL сохранён: скрипт ожидал literal radius999 как
  у референса, но выбранный существующий token `radius/full` равен9999.
  Проверка уточнена на точное9999 + binding `VariableID:4:58`, без новых
  изменений canvas. Оба значения дают тот же pill при высоте28.
- При первом просмотре исправлены лишняя заливка в frame иконки ошибки и
  высота FirstError. Сохранены initial PNG/scripts. Один screenshot mobile
  SourceError завершился MCP timeout; повтор успешно получен и просмотрен.
- В raw `mastersResult.createdNodeIds` также попали существующие перенесённые
  потомки FirstError; исходные IDs не являются вновь созданными. Точный состав
  определяется mutation scripts и отдельными списками mutated/removed IDs.

Локальные команды: скачивание PNG через `curl` exit0; просмотр через
`view_image` выполнен. Необязательная сборка contact sheet через Python
завершилась exit1 из-за отсутствия PIL; изображения затем просмотрены
по отдельности. Продуктовые TEST/FUNCTIONAL/browser UI, npm gates, stage —
NOT RUN (Figma-only). Push/deploy/merge не выполнялись, production не затронут.
Финальная JSON-валидация design-index/manifest/verifiedAudit и построение
SHA-256 индекса через Python — exit0; `git diff --check` четырёх изменённых
tracked docs и нового отчёта — exit0.

Локальные изменения этой задачи: DESIGN.md, SOURCES.md, STATUS.md,
design-index.json, этот отчёт и новый каталог artifacts. Незакоммиченные
исходники/тесты/evidence других задач сохранены; ветка frontend/v2-implementation.
Следующий шаг — просмотр макетов владельцем, затем обычный workflow
согласования/историй/границ; реализация автоматически не запускается.
