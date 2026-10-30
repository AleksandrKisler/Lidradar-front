# Диалоги, Аналитика, Интеграции · Оболочка Radar C · 30.10.2026

По прямому поручению владельца согласованная оболочка Radar C перенесена на
основные макеты трёх разделов в Figma. Story IDs: межмодульный дизайн shell/layout;
канонические продуктовые US и API не изменялись.

## Результат

| Раздел     | Desktop | Tablet | Phone | Всего |
| ---------- | ------- | ------ | ----- | ----- |
| Диалоги    | 16      | 16     | 24    | 56    |
| Аналитика  | 29      | 29     | 29    | 87    |
| Интеграции | 13      | 12     | 12    | 37    |
| Всего      | 58      | 57     | 65    | 180   |

Обновлены default, skeleton, refreshing, error, empty, recovery и полные страницы
в пределах существующих основных семейств. Сохранены original frame IDs и размеры
всех 180 экранов. Legacy, audit, локальные operation fragments без глобальной
оболочки и отдельная невыбранная accent-проба аналитики не менялись.

- Desktop: sidebar 240 px, белая группа четырёх разделов с разделителями,
  активен текущий модуль. Компактный workspace снизу с inset 24 px. Header
  1120×44, x40/y32: локальный контекст/дата, имя, «Аккаунт →», icon-only settings,
  разделитель, plain «Выйти». Прежняя Telegram-карточка и подпись роли убраны.
- Tablet: appbar 72 px, menu/brand слева, полное имя, прозрачная ссылка аккаунта
  и settings справа. Phone: appbar 64 px, menu/brand, круглый аккаунт 44×44
  и settings 44×44. Локальные контекст/дата, пользователь и workspace сохранены;
  NoPermission интеграций по-прежнему содержит Марию Орлову/«МО».
- Добавлены 6 module navigation drawers, по tablet/phone для каждого раздела.
  Roots 834×1194 / 390×844, panels 360/344, workspace 68 px снизу24.
  Menu buttons открывают соответствующий модульный drawer, закрытие сохранено.
  Scrim alpha 46/255 ≈18%, остальные элементы не приглушены.
- Контентные back/search/thread controls диалогов, графики и таблицы аналитики,
  действия подключения и локальные состояния интеграций сохранены. Бизнес-блоки
  desktop целиком смещены на18 px после увеличения header; внутренности не менялись.

## Figma и снимки

File `jN8Hhzn6ObIAEi7FoY9kPu`, session `c4bb384b-2c34-4592-abdc-13b8de974dd8`.
Источник: Radar page `21:2`, Adaptive C overview `1050:16001`;
sidebar `27:2766`, header `27:2809`, tablet/phone appbars `1050:16006` / `1050:16075`.
Это перенос выбранной оболочки, не миграция на отдельные draft UI Kit App/Slots.

- [Диалоги](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/?node-id=342-8909)
  и [Аналитика](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/?node-id=306-2918):
  page `299:12337`. Новые drawers аналитики `1115:23558` / `1115:23597`,
  диалогов `1115:23636` / `1115:23675`.
- [Интеграции](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/?node-id=387-2858):
  page `380:11886`, drawers `1115:23048` / `1115:23087`.

Каталог `artifacts/frontend-v2/module-shell-rollout-2026-10-30/`:

- `target-map.json`, `integrated-audit.json` — все180 IDs и итоговая live-проверка
  heights/presence хедеров. Findings 0. Первоначальный поиск по точному имени
  не находил module-qualified названия интеграций; query уточнён без canvas правок.
- `dialogs-analytics/` — preflight, mutations, final-audit, manifest и11 PNG.
  Snapshot `module-shell-rollout-dialogs-analytics-2026-10-30-final`.
  Manifest SHA256 `3d2d6a15d1df2a106ed4b75b3816f45138d3a48706f199123a4480d0fa70fd26`.
- `integrations/` — preflight, mutations, final-audit, manifest и5 PNG.
  Freeze `2026-10-30T15:24:25.147227+00:00`.
  Manifest SHA256 `f0fb9e8bb3a253240a1a4b0d705c773c06ff38dc779d55a364dd6c748e2756a8`.
- `reviews/` — briefs и независимые `dialogs-analytics-review.md`,
  `integrations-review.md`. Все16 новых PNG реально просмотрены; hashes совпали
  до и после review. Inputs после freeze не менялись.
- `source-protection-before.json`, `source-protection-final.json` — 6/6 Radar
  source subtrees неизменны. Это лёгкие FNV1a32 checks, SHA-256 snapshots файлов
  находятся отдельно в manifests и `final-snapshot.json`.

## Проверки

| Проверка                                     | Результат                                                      |
| -------------------------------------------- | -------------------------------------------------------------- |
| Root IDs/W/H                                 | 180/180 сохранены                                              |
| Диалоги/аналитика: original business subtree | 143/143 digests совпали; IDs/hierarchy/text/reactions/geometry |
| Интеграции: business blocks                  | 104/104 fingerprints совпали; нет выхода business за root      |
| Source Radar                                 | 6/6 subtree digests совпали                                    |
| CANVAS desktop/tablet/phone, menus           | PASS независимо по всем трём модулям, findings0                |
| TEST / FUNCTIONAL / browser UI / stage       | NOT_RUN                                                        |

Прозрачность новых drawer PNG проверена по фактическому RGBA: [28,28,33,46].
Потеря paint alpha при переносе исправлена отдельным ABSOLUTE rectangle с
node opacity0.18; размеры roots и panels восстановлены до freeze.

Финальные адресные команды/exit codes и SHA-256 сохранены в `validation.json`
и `final-snapshot.json`: Prettier, `git diff --check`, проверка28 manifest inputs.
Новый код и тесты приложения не писались, продуктовые gates не запускались.
Git baseline: `frontend/v2-implementation`, HEAD `3870d65a23cc50912af7411c3bb7368fda99f1b7`.
Существующие dirty tracked/untracked изменения других задач сохранены.

## Ограничения и завершение

PASS относится к статическим representative PNG и указанным критериям оболочки.
Остальные состояния охвачены структурой и fingerprints, а не отдельным визуальным
просмотром каждого экрана. Реальные prototype interactions, scrolling, keyboard,
screen reader, 320 px и text scaling — UNVERIFIED. Fixed viewport crop внизу phone
thread не доказывает реальную прокрутку; внутренний business content сохранён.

Figma-поручение завершено. Runtime/API/бизнес-правила и canonical US не менялись;
дальнейшая реализация и её TEST/FUNCTIONAL/browser UI проверяются отдельно.
