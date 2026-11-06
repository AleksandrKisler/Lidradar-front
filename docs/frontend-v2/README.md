# Запуск агентов для frontend v2

Для Codex используй [инструкцию запуска](CODEX.md),
[правила ролей](CODEX-OPERATING-RULES.md) и корневой [AGENTS.md](../../AGENTS.md).
Codex продолжает существующую рабочую копию после Claude с сохранением изменений.
Ниже сохранена инструкция запуска Claude Code.

## Claude Code

В терминале:

```sh
cd /Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front
bash scripts/claude-frontend.sh doctor
bash scripts/claude-frontend.sh login
bash scripts/claude-frontend.sh start
```

`login` нужен только если doctor сообщает, что CLI не авторизован. Вход проходит
через штатный браузер Claude; пароль/код/токен не передавайте в чат.
Launcher использует существующий Claude Code из PATH или установленного Desktop
bundle; глобальная установка и изменение shell profile не нужны.

`start` и `resume` включают режим Auto через `--permission-mode auto`.
Обычные команды и тесты проходят автоматическую проверку без постоянных запросов
разрешений. Для отдельных действий Claude всё ещё может запросить подтверждение.

По умолчанию backend docs берутся из соседнего `../Lidradar/docs`. Если backend
расположен отдельно, перед запуском задайте `LIDRADAR_BACKEND_DOCS`:

```sh
export LIDRADAR_BACKEND_DOCS="/путь/к/Lidradar/docs"
```

Команда `login` не требует наличия каталогов документации и дизайна.

При первом старте подтвердите доверие этому frontend-каталогу. В `/mcp` подключите
сервер `figma` и пройдите его OAuth, если запрошен. Это штатная авторизация клиента,
её нельзя заменить настройкой проекта. Конфигурация не содержит токенов.
Сервер предназначен для чтения макетов; START запрещает изменение Figma.

`/model` должен показывать Sonnet; `/agents` — lidradar-visual-review,
lidradar-functional-review, lidradar-expert. Проверяющие получают только Read/Glob/Grep;
команды и сбор изображений делает ведущий. Поэтому они не могут исправлять код
или выполнять shell-команды. Подключённый MCP доступен основной сессии.

Для возобновления нужной сессии:

```sh
bash scripts/claude-frontend.sh resume
```

Resume открывает выбор сессии; не начинает вторую реализацию параллельно.
Вариант Desktop: откройте вкладку Code, выберите этот frontend-каталог и передайте
текст START.md. Если внешние папки документации недоступны, используйте launcher:
он добавляет только backend docs и design-пакет.

Первое задание ограничено F00–F02 до приёмки G01. После просмотра результата
напишите Claude продолжать с F03; он должен сохранить контекст в STATUS.md.
Ни агент, ни launcher не включают bypass permissions, Agent Teams или автодеплой.

## Официальная документация

- [Агенты](https://code.claude.com/docs/en/sub-agents)
- [Настройки](https://code.claude.com/docs/en/settings)
- [CLI](https://code.claude.com/docs/en/cli-reference)
- [Figma remote MCP](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/)
- [Контроль расхода](https://code.claude.com/docs/en/costs)
