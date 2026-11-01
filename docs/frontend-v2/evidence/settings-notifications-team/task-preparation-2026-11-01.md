# N-SNT-REDESIGN-01 · Подготовка ТЗ · 01.11.2026

Задача: [SETTINGS-NOTIFICATIONS-TEAM-REDESIGN-CODEX.md](../../tasks/SETTINGS-NOTIFICATIONS-TEAM-REDESIGN-CODEX.md).
Статус: подготовлена, реализация не запущена. Пакеты `N-SN-ADAPTIVE-01` и
`N-ST-ADAPTIVE-01`; US-M10-01…07, US-M11-01/04…08, регрессии M01/accept
и shared consumers. Backend/API/Figma/production не менялись; push/deploy/merge
не выполнялись. Субагенты не запускались для подготовки документа.

## Источники и снимок

- Ветка `frontend/v2-implementation`, HEAD
  `6e7b340e683998a1d7f582360ec3e9bbf954b41c` + dirty.
- Manifest подготовки: 780 Git-visible inputs, включая untracked, после
  внешнего commit исправления времени. `inputs-before.json` SHA-256:
  `92f218a22d972bfbbca24af8f2b407a9bd67fa3894389cbd9ad9486b7dd21cd4`.
- Figma session `bbf477f0-5ad9-4f0b-ab0a-6a4be5189557`, только чтение.
  Live metadata областей `1392:15150` R47 и `1426:18281` R54 подтвердили
  87/141 node IDs. Приложение ТЗ содержит все 228 точных указателей;
  текущий index совпадает с source-check по всем этим ID.
- `get_design_context` со screenshot прочитан для двух desktop main:
  `1393:15150`, `1427:18286`. Полные properties/screenshots всех адаптивов
  получать при реализации. Approved FNV fingerprints повторно не вычислялись.
- Артефакты: `artifacts/frontend-v2/settings-notifications-team/`
  `Codex-preparation-2026-11-01/`: inputs-before/final, metadata XML,
  primary-context TXT, source-check JSON, validation JSON и команды.

## Изменения и проверки

Автор подготовки создал ТЗ и этот отчёт, добавил одну запись в STATUS.
Runtime/тесты/config не менялись относительно manifest подготовки.
Параллельная сессия обновляла DESIGN/SOURCES/design-index/STATUS; эти изменения
сохранены. Общий нулевой drift документации не заявляется.

| Проверка                                                      | Exit | Результат                                                                                  |
| ------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------ |
| Первая Prettier write/check через shell Node20.19.0           | 1    | ТЗ отформатировано; новая запись STATUS требовала исправления Markdown `+ dirty`           |
| Node24.19.0, Prettier check ТЗ + STATUS после точечной правки | 0    | Оба файла соответствуют формату                                                            |
| `git diff --check`                                            | 0    | Ошибок whitespace нет                                                                      |
| Python: все IDs приложения / live metadata / актуальный index | 0    | 87+141, missing0                                                                           |
| Python: SHA-256 inputs относительно inputs-before             | 0    | Все runtime/test/config inputs сохранены; внешние docs delta перечислены в validation.json |

Команды/exit codes относятся к подготовке документа. Build/unit/E2E,
runtime TEST, FUNCTIONAL и UI desktop/tablet/mobile — **NOT_RUN**.
Дизайн утверждён ранее; новый runtime PASS не присваивался.
Открытых findings подготовки нет. Следующий шаг — отдельное поручение
выполнить ТЗ, сверить актуальный snapshot/владение и начать реализацию.
