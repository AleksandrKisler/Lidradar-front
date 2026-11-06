# Codex · Проверка структуры 29.10.2026

Область: инструкции, проектные настройки, роли и launcher для продолжения
работы Claude. База: `frontend/v2-implementation`, HEAD `c9e676d`, предыдущий
коммит `3844681`. Исходники frontend этим пакетом не изменены.

## Сохранность

- До правок сохранены SHA-256 всех 34 существовавших modified/untracked файлов.
  После настройки все 34 остались побайтно прежними.
- Все 32 inputs из `access-resume-2026-10-29/checkpoint.json` совпали с рабочими
  файлами; сохранённый snapshot — `44b0b3e6e040cb696a2afa41570667847daedfad38c71e09d2b96cb067a8e037`.
- R1 evidence и чужие proposals сохранены. R1 FAIL остаётся историческим;
  проверка hash не является повторным прогоном приложения.

## Выполненные проверки

| Проверка                                                  | exit | Результат                                                                                         |
| --------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------- |
| `bash -n scripts/codex-frontend.sh`                       | 0    | Синтаксис Bash                                                                                    |
| `bash scripts/codex-frontend.sh doctor`                   | 0    | Node 24.19.0, CLI 0.165.0-alpha.1.2, startup config, пять файлов ролей                            |
| `codex app-server --strict-config --print-startup-config` | 0    | Проверка startup settings без LLM-задачи                                                          |
| Python TOML parse шести `.codex/*.toml` / `agents/*.toml` | 0    | Обязательные поля, уникальные имена, модели/effort из локального каталога                         |
| Smoke launcher с временным CLI stub                       | 0    | login без Node; start/resume с PTY из другого cwd; точные argv/prompt; workspace-write/on-request |
| Неверный режим / лишний аргумент                          | 2    | Ожидаемый отказ, проверен smoke                                                                   |
| Отсутствующий CLI / start и resume без TTY                | 1    | Ожидаемый отказ до запуска CLI, проверен smoke                                                    |
| Prettier затронутых Markdown документов                   | 0    | Форматирование                                                                                    |
| `git diff --check`                                        | 0    | Нет whitespace errors                                                                             |

TOML проверялся локальным `pip._vendor.tomli`, без установки зависимостей.
Модели/effort сверялись с метаданными `models_cache.json`, без чтения credentials.
В smoke реальный login и LLM не вызывались. Предупреждение CLI о невозможности
создать PATH aliases не помешало startup check; глобальная среда не изменялась.

## Ограничения и следующий шаг

Загрузка custom roles в реальной LLM-сессии, фактически использованная модель,
Figma/browser-доступ и независимая приёмка frontend — **UNVERIFIED**. Попытка
прочитать effective config через отдельный stdio app-server не вернула ответ
в отведённое время; по ней загрузка project layer не подтверждена. TOML parse
и startup check не заменяют эту runtime-проверку.

Frontend suites, backend-stage и UI review не запускались: runtime не менялся.
Не заявляются исправления R1, новый TEST/FUNCTIONAL/UI PASS или новый G01.
При продолжении использовать CODEX-START: сверить актуальный snapshot, проверить
доступные роли и адресно воспроизвести оставшиеся findings общей регистрации.
