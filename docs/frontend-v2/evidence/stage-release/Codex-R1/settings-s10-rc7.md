# Настройки S10 · Stage RC7 · 01.11.2026

Владелец принял S10 и поручил коммит и публикацию на stage. Production не входит
в поручение. Это заменяет прежнее ограничение push/deploy для данного кандидата.

Кандидат: N-SNT-REDESIGN-01, N-SN-ADAPTIVE-01, N-ST-ADAPTIVE-01,
N-SHELL-HEADER-01; US-M10-01…07, US-M11-01/04…08.
[Итоговая приёмка](../../settings-notifications-team/implementation-2026-11-01.md):
S10,1096inputs, manifest SHA-256
`aa3ae00a23f8b8acaa9e5758000c729abebacb074ae63a23140ce66b2486520e`.
FUNCTIONAL PASS frontend/mock; UI desktop/tablet/mobile PASS. Raw TEST FAIL:
921PASS/12contrastFAIL/34SKIP, exit1; единственное принятое исключение QA-S8-01.
Макет, тесты и CI не меняются ради PASS.

Перед коммитом исходники/tests/tooling/contracts/scripts совпали с S10.
Параллельные правки Integrations и Codex config сохранены, в runtime-коммит
не включаются. Полный Git-visible dirty backup, diff и SHA записаны в
`artifacts/frontend-v2/settings-notifications-team/Codex-R1/stage-rc7/`.

Read-only preflight stage exit0: frontend RC6 `1df33d785fe8400b5c7eb873aa5b9668c29a7f2f`,
backend `ed577f84e992afb5b0564c685736976c0c3255d9`, оба checkout чистые,
7 services running/health, API SHA-256
`9f9766cc4d23e398268aabc68d8adae6db9bf3358bf14953b151f36c617e3027`,
миграция `000032_registration_invitation_check`, checksum прежний.
Выпуск frontend сохраняет эти backend/API/migration revisions.

Commit/tag, фактический CI, deploy и live smoke будут записаны после выполнения.
Согласованный FAIL не считается зелёным CI. Обычный автодеплой требует PASS;
известное исключение и явное поручение владельца на stage учитываются отдельно.
