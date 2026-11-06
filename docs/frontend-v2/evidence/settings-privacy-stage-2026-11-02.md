# Settings Privacy · stage delivery · 02.11.2026

Пользователь поручил commit/push/stage без повторного локального тестирования и
исправление deploy blockers. Production не затрагивать. Отправлен полный Git-visible
снимок837files,46changedfiles:6654678bec45ae421be92015f18c09189e802544, tag
release/2026-11-02-rc1. Source hashes до/после commit unchanged; env/ignoredartifacts
не включались. Runtime R6 принят ранее, новые локальные tests не запускались.

Автодеплой STAGING_AUTODEPLOY_ENABLED=true. Run41439289032:
https://github.com/AleksandrKisler/Lidradar-front/actions/runs/41439289032
quality/builds3/container PASS. CI E2E shard1:703PASS1FAIL — nativeChromiumpinch
Input.synthesizePinchGesture(touch) оставляет visualViewport.scale1 во всех3attempts,
expected>1.5. Failure logs/artifact13141251267/rawtrace сохранены в
artifacts/frontend-v2/settings-privacy-redesign/stage-2026-11-02/. Предыдущие R6 PASS
не переименовываются в доказательство нового CI окружения.

Адресная гипотеза исправления: только native-pinch test запускает полный headless
Chrome через channel:'chromium' вместо default headless-shell. Touch gesture,
scale>1.5, focus/wholeoutline bounds, keyboardcancel и0mutations assertions прежние;
ни skip, ни timeout, ни retry, ни matrix/budget/coverage не ослаблены. Полный browser
уже устанавливается штатным playwright install --with-deps; зависимости не меняются.
Runtime/UI/Figma/API не меняются. Проверка гипотезы — новый штатный CI, без локального
прогона по просьбе пользователя. Primary source:
https://playwright.dev/docs/browsers#chromium-new-headless-mode

Серверный blocker предыдущего deploy41365900708 — свободно4GB при required5GB.
После исправления VPN SSH доступен. На stage проверены env/domain/composeproject,
deployed release ed577f84e992-we7940037; свободно4.8GB. Unusedbuildercache>168h0B;
builder prune -a --filter until=24h удалил2.747GB, df теперь6.6GB. Images145,
volumes4 иcontainers8 не изменились; release images/backups/данные не удалялись.
Stage deploy guard5GB сохранён. Backend commit/source/migrations не менялись.

Новый fix должен быть отдельным commit и новым RC tag; старые tags не переназначать.
Итоговый deploy/run outcome сохраняется в stage artifacts/delivery.json и финальном
ответе. Этот документ фиксирует подготовку/диагностику, а не ещё не полученный deployPASS.

## Второй CI blocker: legacy WebKit fixture

Shard2 завершился663PASS1FLAKY40SKIP, stage-deploy SKIPPED. Исходный workspace1598
не открыл grant dialog после primary click. Trace: dispatch11:57:22.360…397UTC,
SSE reconnect22.353, consentGET22.368…382; guard/native disabled включается между
mouseDown иmouseUp. Legacy mockOwner отдаёт конечное SSE body и непрерывно закрывает
соединение, что создаёт искусственные reconnect/resync в ordinary command flow.
Raw artifact13140738204/trace сохранены, первоначальный FAIL не переписан.

Точечный fixture fix: только этот workspace command flow получает opt-in живой
ReadableStream с connected comment и AbortSignal cleanup, как уже утверждённые
settings fixtures. Existing API routes/state/commands/assertions/mouse actions прежние.
Explicit event/unavailable/reconnect cases по-прежнему используют старые конечные
routes; dedicated heldGET/permission/late-response/retry regressions сохранены.
Runtime guards не ослаблены, timeout/retry/coverage/budget/CI matrix не менялись.
Новый commit/RC3 проверяется штатным CI; локальные tests не запускаются по поручению.
