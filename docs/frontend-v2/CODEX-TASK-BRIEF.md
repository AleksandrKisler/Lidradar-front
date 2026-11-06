# Codex · Шаблон ограниченной задачи

Создай отдельный brief в `artifacts/frontend-v2/<story>/<round>/`.
Этот файл — шаблон; не перезаписывай его на каждом запуске.

```text
Роль / фактическая модель / effort:
Цель и ожидаемый результат:
Story IDs и точные AC:
Snapshot: HEAD + manifest с SHA-256 всех inputs, включая untracked:
Разрешённые файлы для записи (пусто = без правок):
Владельцы общих файлов и зависимости от других задач:
Нужные файлы/строки, relevant diff, API/ADR:
Figma nodes / exact-frame или approved-pattern / exports / hashes:
Открытые findings, что уже проверено на этом snapshot:
Команды и обязательные gates:
Кто владеет browser/preview, порт и окружение:
Разрешённый каталог артефактов:
Критерии завершения и ограничения:

Не вызывай субагентов и не расширяй write set. При пересечении файлов сообщи
ведущему и жди передачи владения. Не меняй чужие изменения и источники.
Верни результат, файлы, snapshot, команды/exit codes, evidence и остаточные риски.
Finding: ID / severity / AC / file:line / trigger / expected / actual /
evidence / способ проверки исправления.
QA: отдельно TEST и FUNCTIONAL = PASS/FAIL/BLOCKED/UNVERIFIED.
UI: отдельно desktop/tablet/mobile = PASS/FAIL/UNVERIFIED и список изображений.
Если inputs изменились во время проверки, сообщи об этом; PASS недействителен.
Лимит времени/контекста и отсутствие evidence не означают PASS.
```
