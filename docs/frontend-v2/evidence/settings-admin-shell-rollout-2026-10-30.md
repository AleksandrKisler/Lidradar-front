# Настройки и Администрирование · Оболочка C · 30.10.2026

По прямому поручению владельца выбранный layout Radar C перенесён на настройки
и администрирование. Это межмодульная Figma-задача оболочки: канонические US,
API, бизнес-правила и runtime не изменялись.

## Результат

| Раздел            | Desktop | Tablet | Phone | Всего |
| ----------------- | ------- | ------ | ----- | ----- |
| Настройки         | 44      | 44     | 44    | 132   |
| Администрирование | 51      | 51     | 51    | 153   |
| Всего             | 95      | 95     | 95    | 285   |

Во всех 285 основных full-shell frames сохранены original root IDs и размеры.
Перенесены C sidebar/header, профиль и account/settings actions; локальные
тексты, бизнес-блоки, состояния, вкладки и их действия сохранены. Desktop header
1120×44 с x40/y32, tablet appbar72, phone appbar64; account/settings targets44.
Radar sample-даты в эти разделы не добавлялись: имеющееся время остаётся в своих
локальных business snapshot blocks.

Настройки сохраняют четыре нейтральных appnav пункта и активную шестерёнку,
шесть вкладок/compact selector под хедером, workspace внизу и локальную
«Студию Блик /1точка». Самые свежие desktop company/schedule blocks не менялись,
существующие бизнес-отличия адаптивов не исправлялись в рамках этой задачи.

Администрирование сохраняет все девять платформенных разделов, их selected
states, labels и actions. Роль «Администратор платформы» перенесена в navigation
zone; «Платформа / Только метаданные» и UTC snapshots сохранены. Внизу закреплён
существующий переход «В рабочее пространство» с inset24. Tenant-карточка из
Radar не добавлялась. Logout имеет plain-формат в header, остальные admin actions
и permissions не переопределялись.

Четыре исходных drawer root IDs сохранены. Настройки используют два нейтральных
appnav menu, Admin — два исходных neutral и18 новых selected overlays для девяти
разделов×двух адаптивов. Итого22 menu frames. Menu destinations соответствуют
выбранному разделу; close/return/logout reactions сохранены структурно.
Panel widths360/344, roots834×1194/390×844, bottom inset24. PNG scrim RGBA
`[28,28,33,46]` — alpha≈18%, отдельный ABSOLUTE rectangle; controls opacity1.

## Сохранность и приёмка

- Settings:132/132 business subtree digests и W/H совпали;139/139 local-frame
  fingerprints вне переноса совпали. Вкладки, selector и свежие schedule nodes
  сохранены. Во всех132 screens gear active, selected appnav отсутствует,
  sample date count0, шрифт Inter.
- Admin:153/153 root IDs/W/H совпали,726/726 business hashes, nav labels/selected/
  reaction hashes и локальные contexts совпали. Во всех153 visible business
  bounds помещаются в root; скрытые legacy data layers skeleton не считались
  видимым overflow. Scroll/clipping semantics не менялись ради этой проверки.
- Admin menus:20 roots проверены структурно,18 selected mappings и102 adaptive
  screen→menu destinations соответствуют текущему разделу; все9 routes совпали
  с neutral base. Nav не пересекается с footer на representative phone PNG.
- Итоговая live-сверка ведущего:285/285 C headers найдены с ожидаемой геометрией,
  findings0. Поиск использует фактические platform-qualified имена хедеров.
- Независимый **CANVAS desktop/tablet/phone и menus PASS** для обоих разделов,
  findings нет. Реально просмотрены10 новых PNG; hashes совпали до/после review.

Local dialogs/forms без global shell и legacy не получали новую оболочку.
В Admin также исключены6 access/expired frames с брендом и карточкой доступа:
они не должны получать платформенную навигацию. Worker сообщил их сохранность,
но для excluded admin frames пакет содержит summary, без отдельных before/after
fingerprints. Независимая сохранность этой исключённой области — UNVERIFIED.

## Figma и evidence

File `jN8Hhzn6ObIAEi7FoY9kPu`, session `ff8d9c58-b97a-4d23-a187-efab7f0cb0d4`.

- [Настройки · Компания и график](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/?node-id=529-4216),
  page523:54633. Drawers `599:12748` / `599:15847`.
- [Администрирование · Обзор](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/?node-id=551-3798),
  page530:56440. Исходные drawers `599:58146` / `599:61027`; новые selected
  variants и section mapping — в `admin/final-audit-menus.json`.

Артефакты `artifacts/frontend-v2/settings-admin-shell-rollout-2026-10-30/`:

- `target-map.json`, `integrated-audit.json` — все285 target IDs и live census.
- `settings/`: preflight, mutations, final-audit, manifest и5 PNG.
  Snapshot `settings-shell-rollout-2026-10-30-final`; manifest SHA256
  `824489bcc7b3ac4e63e657a0a26bcf9a1d0e635294fb8675d25ca883321c36a9`.
- `admin/`: preflight, mutations, final-audit, per-device/menu audits,
  manifest и5 PNG. Freeze `2026-10-30T15:57:54.072392+00:00`; manifest SHA256
  `9c69f868b678f22d79313fe892798a08e5d5eec5ec8a8090e8cd77ce08518e21`.
- `reviews/settings-review.md`, `reviews/admin-review.md` — независимые отчёты;
  reviewers открыли все10 PNG и сверили данные до/после freeze.
- `validation.json`, `final-snapshot.json` — финальные commands/exit codes,
  SHA256 inputs включая untracked/evidence и Git HEAD. Baseline —
  `frontend/v2-implementation`, HEAD `3870d65a23cc50912af7411c3bb7368fda99f1b7`;
  существующие чужие dirty tracked/untracked файлы сохранены.

### Актуальные источники после удаления тестовых секций

В начале задачи присутствовали source appbars в тестовом обзоре `1050:16001`.
При финальной сверке секции632/1021/1026/1050 оказались удалены целиком.
Эти удаления отсутствуют в mutation logs текущих исполнителей; оба исполнителя
подтвердили только read/clone исходников Radar. Автор удаления не атрибутируется.
Удалённые секции не восстанавливались и чужие изменения не откатывались.

4/4 оставшихся baseline source fingerprints — desktop sidebar/header и оба
Radar drawer — совпали. Canonical appbars сохранились: tablet `1048:9337`
в `630:6182`, phone `1048:9359` в `630:7204`, размеры834×72/390×64.
Они записаны в design-index как текущие источники; исторические proposal IDs
сохранены как provenance. Before/after fingerprints двух удалённых overview
appbars проверить невозможно; `source-protection-final.json` явно отмечает предел.
Для Canvas review использованы ранее сохранённые reference PNG согласованной C.

## Проверки и ограничения

Адресные Prettier и `git diff --check`, проверка двух manifests/43 inputs и
target coverage записаны в `validation.json`. Ранний read-only census был уточнён
после ошибки predicate/несовпадения имён platform headers и missing source nodes;
canvas inputs не менялись, итоговый census285/285 без findings.

TEST/FUNCTIONAL/browserUI/stage — NOT_RUN. Static CANVAS PASS относится к
representative screenshots и указанным AC оболочки; все состояния охвачены
структурой/fingerprints, а не отдельным визуальным просмотром каждого экрана.
Prototype interactions, real scrolling, accessibility/contrast compliance,
keyboard/screen reader,320px и text scaling — UNVERIFIED.

Figma-поручение завершено. Код приложения, API, canonical US и production не
менялись; реализация и её runtime gates остаются отдельной задачей.
