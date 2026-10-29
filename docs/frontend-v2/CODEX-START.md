# Codex · Продолжение доступа

Текст для поручения продолжить frontend после подготовки конфигурации.
Применяй к существующей рабочей копии, не создавай чистый worktree без её правок.

```text
Продолжи незавершённый frontend LidRadar после Claude по AGENTS.md и
docs/frontend-v2/CODEX-OPERATING-RULES.md. Сохрани текущие изменения.

Прочитай актуальный STATUS, ACCESS-RESUME, последний test-report/manifest,
WORKFLOW и утверждённые ТЗ/матрицы US-M01-01 и US-M01-02 в docs/frontend-v2/tasks/.
G01 уже принят, F03 начат. Не начинай регистрацию или архитектуру заново.
Сначала сверь HEAD и hashes всех inputs, включая untracked, с checkpoint.
Составь карту AC → реализовано / проверено на этом snapshot / дефект / нет evidence.
После инвентаризации исправляй подтверждённые оставшиеся findings R1.

Основная сессия Sol пишет код. Независимые ограниченные задачи можно передать
lidradar-explorer или lidradar-worker с коротким brief и отдельным write set.
Общая регистрация US-M01-01/02 остаётся у одного автора. После интеграции
заморозь snapshot: lidradar-qa выполняет TEST, затем FUNCTIONAL; после обоих
PASS lidradar-visual-review проверяет реальные desktop/tablet/mobile изображения.
Не вызывай LEGACY-агентов Claude, вложенных агентов и Astra автоматически.

Живой QA: локальный dev:stage через proxy к backend-stage; сначала проверь
revision/API hash/миграцию. Локальный backend не нужен. Unit/mock и живые
доказательства учитывай отдельно. Сохрани бюджеты/coverage/browser matrix.
Не меняй backend/Figma/production и не отправляй реальные письма вне разрешённого
тестового контура. Не перезаписывай R1 и чужие proposals.

Продолжай до проверенного результата в разрешённом scope. Обнови STATUS и
новый evidence manifest: snapshot, команды/exit codes, TEST/FUNCTIONAL/UI,
исправленные и открытые findings, ограничения и следующий шаг.
```
