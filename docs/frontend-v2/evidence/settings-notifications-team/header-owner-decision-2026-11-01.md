# N-SHELL-HEADER-01 · Решение владельца по контрасту

01.11.2026 владелец ответил на предложение белой подложки ссылки «Аккаунт →»:
**«оставь как в макете»**. Сохраняются accent `#0071E3`, фон `#F5F5F7`, desktop
header top32,1120×44 и отступ40. Белая подложка не применяется; Figma не меняется.

Runtime остаётся как в immutable S8: HEAD1df33d7,1090inputs, manifest SHA-256
`7718050fd527f052208f1c136b542838702141cc3866475646aef17b40f93e3f`.

Замечание QA-S8-01 сохраняется: contrast4.3134:1 ниже4.5 для14pxnormal. Решение
о визуале не объявляется успешным axe-тестом. Проверки/пороги/assertions не
ослабляются. По WORKFLOW при TEST FAIL функциональная приёмка BLOCKED,
независимая UI-приёмка desktop/tablet/mobile не может получить PASS.

Предварительно S8 прошёл check1213tests/106files,build×3/audit и255capture,
preprod142files совпали с served bundle. Первая browser matrix была остановлена
361PASS/8FAIL/2interrupted/596notrun. После решения владельца полная штатная
матрица завершена без исключения contrast cases:921PASS/12FAIL/34SKIP,exit1,
36failed attempts,flaky0. Все12FAIL связаны с QA-S8-01;результаты записаны отдельно
в `artifacts/frontend-v2/settings-notifications-team/Codex-R1/S8/final-matrix/`.

Предложенный прототип и его3greenaxe/geometry probes сохраняются в
`header-correction/contrast-proposal/` как отклонённое предложение, не как runtime
и не как приёмка. Source PNG/старые отчёты сохранены. Production/backend/API/Figma,
зависимости/lockfile не менялись; push/deploy/merge не выполнялись.

## Последующее уточнение владельца

Позднее01.11.2026 владелец явно принял contrast как согласованное исключение и
разрешил продолжить FUNCTIONAL/UI при сохранённом FAIL. Актуальное решение:
[accepted-contrast-exception-2026-11-01.md](accepted-contrast-exception-2026-11-01.md).
Приведённое выше описание прежней блокировки сохраняется как история, а не
как действующий запрет новой приёмки. Цвет/фон/макет/тесты остаются прежними.
