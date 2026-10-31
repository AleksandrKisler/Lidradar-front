# Автодеплой frontend на stage

Решение владельца 31.10.2026: после локальной приёмки отправлять изменения в stage и автоматически собирать/выкатывать проверенную версию на stage. Production остаётся ручным отдельным выпуском. Это заменяет прежнее ограничение «стейдж только вручную» для frontend; backend/API и migrations не меняются.

## Поток

Feature → локальные TEST/FUNCTIONAL/UI по scope → merge stage → push stage → GitHub quality/builds/e2e/container → stage-deploy. Выкатывается конкретный github.sha последнего stage push. Устаревший SHA отвергается, очередь не прерывает уже идущий выпуск. Main/PR/workflow_dispatch автоматически ничего не выкатывают.

Backend остаётся на текущем deployed commit. Серверный helper переиспользует release.sh: dry-run, exact web-suffix tag, сборка, backup, запуск, smoke и штатный rollback при допустимой схеме. Не подавлять ошибки здоровья/копий/места на диске. Песочница только stage/local; Basic Auth и тестовые данные сохраняются.

## Одноразовая настройка

На stage есть исходящие deploy_lidradar/deploy_lidradar-front для чтения GitHub. Для входящей команды Actions нужен собственный ограниченный ключ. Не переносить общий личный ключ deploy или ключ production в GitHub.

1. Проверить локальный gh auth status. Установить scripts/stage-deploy.py на stage вне checkout: /opt/lidradar/stage-deploy.py, owner deploy, mode700. Не менять backend/scripts/release-ssh.sh.
2. Создать отдельную пару Ed25519 на локальном Mac в защищённом временном каталоге. Приватную часть не печатать и не коммитить. Добавить только публичную часть в stage authorized_keys со строго таким префиксом:

   restrict,command="/opt/lidradar/stage-deploy.py" ssh-ed25519 <PUBLIC_KEY> lidradar-stage-actions

3. GitHub environment staging: разрешена только ветка stage, без ручного approval каждого stage deploy. Отдельные environment secrets: STAGING_SSH_KEY (приватная часть только этого ключа), STAGING_SSH_KNOWN_HOSTS (закреплённый ключ уже проверенного stage хоста). Не использовать ssh-keyscan как доверие без сверки отпечатка.
4. Variables environment staging: STAGING_SSH_HOST=168.222.202.72, STAGING_SSH_USER=deploy, STAGING_SSH_PORT=22. Активационный repository variable STAGING_AUTODEPLOY_ENABLED пока отсутствует/false.
5. Проверить ограничения ключа: пустой запрос/status/shell/другой SHA отказываются, current stage SHA допускается только к release script. Само успешное SSH-соединение не доказывает live delivery/deploy.
6. После локальных gates и приёмки, проверки environment/ключа/known_hosts включить repository variable STAGING_AUTODEPLOY_ENABLED=true. Следующий push stage запустит полный GitHub CI; deployment начнётся только после успешных quality/builds/e2e/container для этого SHA. Первый выпуск допускается вручную через тот же forced command только для точного SHA с уже успешным CI; факт успеха фиксируется отдельно.

Secrets передавать gh secret set через stdin, не через argv и не в чат. Environment branch policies и обязательные CI checks не ослаблять. Если GitHub план не поддерживает нужный environment, это открытая зависимость, а не повод молча перенести секреты в широкую область.

## Заморозка релизного кандидата

После завершения текущей задачи настроек сохранить полный Git-visible snapshot, включая untracked исходники/тесты/evidence, исключив env/secrets и ignored artifacts. Создать обычные commits и annotated RC tag. Старые снимки/PNG/логи не переписывать. В stage интегрировать существующую историю CI/старой песочницы; не применять force push/reset/stash.

После RC tag — только точечные исправления с issue/воспроизведением/evidence и затронутыми проверками. Крупные изменения — после релиза. Новые фиксы отдельными commits и новыми RC tags, не amend/переназначение прежнего тега. Merge stage→main и production deploy по отдельному поручению после stage-приёмки.

## Проверка

Адресно: python3 -m unittest discover -s scripts/tests -p test_stage_deploy.py -v; Python guard tests и YAML/shell syntax. Финальные frontend gates — docs/frontend-v2/WORKFLOW.md. Для stage отдельно версии frontend/backend, health/basic-auth smoke, auth/me и один разрешённый пользовательский путь. Отчёт должен различать подготовленный workflow, активный автодеплой, выполненный deploy и live functional проверку.

Источники: backend scripts/release.sh, docs/runbooks/staging.md §9, ADR0065; https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments и https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency.
