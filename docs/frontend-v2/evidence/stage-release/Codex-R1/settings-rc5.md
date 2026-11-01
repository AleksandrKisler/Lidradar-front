# Stage · весь frontend · RC5 · 01.11.2026

Поручение владельца: отправить на stage весь актуальный frontend с новыми
разделами. Production исключён. Публикуется полный Git-visible снимок,
включая ранее незакоммиченные исходники, тесты и документацию; локальные
секреты и ignored artifacts в Git не включаются.

Компания и график: N-SC-ADAPTIVE-01, US-M02-05 #1–7, US-M02-06 #1–5,
регрессия M02-02/04/shared. Принятый Company S7 сохранён.
Услуги и цены: N-SS-ADAPTIVE-01, US-M03-01 #1–5 и negative,
US-M03-02 #1–3, US-M03-03 #1–3/6, регрессия US-M02-03/shared.

Принятый Services S4 включает итоговый интегрированный frontend:
1006 inputs, manifest SHA-256
`6b15cd89a934e186f59b6475d95b7c4b9a7cd7805b4a8789daa9212425016635`.
Перед подготовкой RC5 все эти inputs повторно сверены: drift 0.
Независимые TEST/FUNCTIONAL PASS; UI desktop/tablet/mobile PASS.
Check: 1184 unit и 13 architecture cases; build dev/pre-prod/prod и audit
exit 0. Stock browser matrix: 801 PASS + 4 ожидаемых skip, 0 failures,
flaky и retry; Services capture 67/67, Company capture 73/73,
controlled shared capture 4/4 PASS. Бюджеты и assertions не ослаблены.

Полные локальные evidence и неизменные снимки:
`artifacts/frontend-v2/settings-company-adaptive/Codex-R1/S7/`,
`artifacts/frontend-v2/settings-services-adaptive/Codex-R1/S4/`.
Снимок до публикации, команды и операционные проверки RC5:
`artifacts/frontend-v2/stage-settings-release-2026-11-01/RC5/`.

Stage до публикации: frontend `1040aa1`, backend
`ed577f84e992afb5b0564c685736976c0c3255d9`, readiness ready,
семь сервисов работают, пять healthchecks healthy. Контракт API SHA-256
`9f9766cc4d23e398268aabc68d8adae6db9bf3358bf14953b151f36c617e3027`,
миграция `000032_registration_invitation_check` (applied=latest).
Оба серверных checkout чистые. Backend остаётся на этой deployed revision;
контракт, миграции и данные не меняются фронтенд-публикацией.

Автодеплой включён; новый annotated tag `release/2026-11-01-rc5`
публикуется вместе с обычным fast-forward push в stage. GitHub CI заново
проверяет quality, три сборки/audit, оба browser shards с
`--fail-on-flaky-tests` и container smoke. Только их успех разрешает
stage-deploy точного SHA. Фактическая выкладка и live smoke записываются
отдельно после завершения workflow; этот документ не объявляет их PASS.

Email/Telegram delivery, исторические диалоги/сделки M03-03 #4–5,
M03-04 AI и физическая OS keyboard остаются за пределами frontend/mock
приёмки. Ни main, ни production этой публикацией не затрагиваются.
