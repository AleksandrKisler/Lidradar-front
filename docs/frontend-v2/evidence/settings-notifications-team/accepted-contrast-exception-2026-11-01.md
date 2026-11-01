# S8 · Согласованное исключение QA-S8-01

01.11.2026 владелец явно поручил:

> Принимаю контраст как согласованное исключение. Не меняй макет и тесты,
> сохрани FAIL в отчёте и продолжай FUNCTIONAL и UI-приёмку всех трёх адаптивов.
> Production не трогай.

Это уточняет предыдущее решение «оставь как в макете» и разрешает продолжить
FUNCTIONAL → независимый UI desktop/tablet/mobile при известном TEST FAIL.
Решение относится только к QA-S8-01: desktop-ссылка «Аккаунт →», `#0071E3`
на `#F5F5F7`,14px normal, contrast4.31:1 вместо4.5:1. Цвет, фон, размеры,
макет, тесты и assertions не меняются. Другие дефекты исключением не покрываются.

Raw TEST остаётся **FAIL**: полный S8 CI exit1,921PASS/12FAIL/34SKIP,
36failed attempts,flaky0. Старые test reports/логи не переписываются и не
переименовываются в PASS. Статус finding: **ACCEPTED EXCEPTION**, не исправлен.

Проверяемая реализация остаётся immutable S8:
`/private/tmp/lidradar-notifications-team-s8`, HEAD1df33d7,1090inputs,
manifest SHA-256 `7718050fd527f052208f1c136b542838702141cc3866475646aef17b40f93e3f`.
Новая приёмка пишет отдельные отчёты в `S8/functional/` и `S8/ui/`, явно
ссылаясь на это решение. Существующие255captures и228+18comparison pairs
относятся к той же побайтно проверенной сборке (142/142preprod files equal).

Порядок по этому поручению: FUNCTIONAL по всем согласованным frontend AC;
после его завершения независимая UI-приёмка всех трёх адаптивов. В каждом
отчёте указываются фактический результат, исключение, ограничения и evidence.
Контраст не маскируется и не используется как причина повторной остановки
разрешённой приёмки. Общий WORKFLOW для остальных задач не меняется.

Production/Figma/backend/API не менять, push/deploy/merge не выполнять.
Live stage persistence и реальная email/Telegram delivery не выводятся из mocks.

## Итоговый принятый кандидат

Приёмка завершена на S10:1096inputs,manifest SHA-256
`aa3ae00a23f8b8acaa9e5758000c729abebacb074ae63a23140ce66b2486520e`.
Сочетание цветов и desktopheader не менялись относительноS8; исключение относится
к тому жеQA-S8-01. FUNCTIONAL PASS вfrontend/mock scope;UIdesktop/tablet/mobile
PASS. RawTEST остаётсяFAIL(12contrastcases),не WCAG AA PASS. Все другие
подтверждённые UI/functional findings исправлены и перепроверены. Подробности:
[итоговый отчёт](implementation-2026-11-01.md). Макеты и существующие тесты
сохранены, production не затрагивался.
