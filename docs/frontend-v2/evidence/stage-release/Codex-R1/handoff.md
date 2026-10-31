# Stage release candidate · 31.10.2026

## Дополнение: rc3 strict block и кандидат rc4

[Strict RC3 GitHub41215749019](https://github.com/AleksandrKisler/Lidradar-front/actions/runs/41215749019):
quality1162/Python10/build×3/audit/container PASS; E2E712PASS/1flaky/32skip.
Strictflag вернулexit1 и stage-deploySKIPPED. Native и teamgeometry исправления
прошли, actualstage остался6820rc2 с провереннымиhealth/API/migrations.

CI-RC3-01 — однаmobileflake AccessT28 доfooterchecks: последовательныеgoto/login
с интерваломоколо6ms пересеклисьсlazyimports; traceсодержитstatus-1chunks,
`TypeError: Importing a module script failed`, WebKitinternalerror наmainJS/CSS,
failurePNGпустой. Независимыйexplorerподтвердилnav/bootstraprace; отдельная
WebKit/runtimeпричинаединичнымtraceнеисключается, нуженновыйstrictLinuxrun.

Test-only кандидат `release/2026-11-01-rc4` открываеткаждыйиз8кадровчерез
neutralabout:blank ипрямойцелевойURL вместо лишнегоapp/loginbootstrap. Fixtures,
патчиAPI,всеready/geometry/footerlinkassertionsиtimeouts сохранены. AccessUI,
runtime/API/budgets иG01approval не меняются. CI-FIX3 содержитtrace/diagnosis/
snapshot/независимыеTESTиFUNCTIONAL;actualGitHub/deployфиксируютсяотдельно.

## Дополнение: rc2 и строгий gate rc3

[RC2 GitHub41213723148](https://github.com/AleksandrKisler/Lidradar-front/actions/runs/41213723148),
commit `6820a65`, tag `release/2026-11-01-rc2`: quality1162/Python10,
build×3/audit/container PASS; E2E712PASS/1flaky/32skip,2retryattempts.
Native radio проверки на Linux прошли. Retry команды команды снова проявил
раздельное geometry измерение: avatar/badge axis diff55px при прежнем≤2.
GitHub jobзелёный, поэтому автоматический deployment начал выполняться;
этот результат не объявлен чистым browserPASS.

Кандидат `release/2026-11-01-rc3` сохраняет все численные требования и Axe:
одновременные boxes всей строки, правого края и телефона, fonts.ready и
двухкадровая стабильность; web-first ожидание≤5000ms вместо разовых чтений.
Невидимые/disconnected elements не принимаются. Никаких runtime/CSS/API/budget
изменений. Плюс `--fail-on-flaky-tests` в обоих CI shards: retry сохраняет
диагностику, но делает jobFAIL и блокирует stage-deploy. CLI negative probe
и независимые результаты пишутся в `CI-FIX2/qa`; actualLinux CI отдельно.

## Дополнение: первый GitHub CI и кандидат rc2

`3317d58`/`release/2026-11-01-rc1` отправлены в stage обычным atomic push.
[GitHub run41203856188](https://github.com/AleksandrKisler/Lidradar-front/actions/runs/41203856188):
quality1162unit/Python10, build×3/audit/container PASS; E2E710PASS/2FAIL/1flaky/32skip
(17.1min), stage-deploy SKIPPED. Stage не обновлялся, production не затронут.
Это новый Linux CI FAIL; он не заменяет сохранённые локальные RC2 PASS evidence.

Точечные test/CI fixes следующего immutable tag `release/2026-11-01-rc2`:

- CI-RC1-01: Linux WebKit входит в unselected native radio с другого края по
  Shift+Tab; macOS может пропускать radio при обычном Tab. Независимая native
  fixture задаёт browser policy; продукт проверяется на тот же count группы,
  первый пункт вперёд и допустимый край назад, точный обратный порядок остальных
  элементов и групп. Полный обход, геометрия секций, отсутствие дублей и draft
  resize assertions сохранены. [W3C APG, native radio note](https://www.w3.org/WAI/ARIA/apg/patterns/radio/).
- CI-RC1-02: две раздельные geometry команды попали вокруг WebKit layout commit
  (diff53px, screenshot уже aligned, retryPASS; поздняя загрузка Inter/CSS trace
  не подтверждает причину). Atomic DOM snapshot и web-first ожидание сохраняют
  порог<1px, видимость и все прежние геометрические assertions.
- E2E CI делится на2shards с теми же projects/workers/retries; list proof:
  745cases=373+372, overlap0, exact union. Оба shards обязательны до deployment,
  fail-fastfalse и отдельные artifacts сохраняют оба результата при ошибке.

Runtime/API/build inputs436/436 всё ещё равны S6. Проверка нового тестового
снимка и команды/exits сохраняются в `CI-FIX/qa`, GitHub Linux результат отдельно.
Неизменные UI/build/unit evidence переиспользуются только по hash invariance.
Старый RC tag, первый FAIL, промежуточные локальные failures и traces сохранены.

## Первичная локальная приёмка

Поручение владельца: после PASS настроек заморозить версию, commit/push stage,
включить автодеплой; production исключён. Только точечные исправления до релиза.
Settings US-M02-05/06 S6: TEST/FUNCTIONAL frontend/mock PASS, desktop UI PASS;
tablet/mobile redesign явно deferred. Source checkpoint `ee33540`, merge parent
`2f3dea1`, итоговый annotated tag `release/2026-11-01-rc1`.

Независимый интеграционный RC2: **TEST PASS / FUNCTIONAL PASS**.
Fresh `npm run check`: exit0,1162unit; stock sandbox E2E3browser: exit0,30/30,
30attempts,0retries/failed/flaky. Восстановлены wire API/tenant/key-body,
WCAG Axe, сохранение текста после отказа, PENDING→MATCH по safety refetch и
429→явный повтор→CLOSED (регрессия US-M17-02/03/05, не полный live US-M17 PASS).
RC1-COV-01 закрыт; подтверждённого runtime-дефекта не было.

RC1: полный stock CI E2E707PASS/32штатныхskip,0retries/failed/flaky, exit0;
check1162unit, build:dev/pre-prod/prod, audit:release, Python10 и YAML/shell13 —
exit0. RC2 переиспользует остальные683 E2E и32skip, сборки/audit/guards только
по729 неизменным inputs; все24 прежнихsandbox E2E повторно прошли вместе с6новыми.
Первые sandbox EMFILE/EPERM логи сохранены, те же команды разрешённо повторены
в доступном окружении. Assertions, budgets, coverage, baseline не ослаблялись.

RC2:730inputs aggregate SHA256
`77a51498980cc4a818fc9bb377e694a8f611e6173f612ca55f719cf9e8c7d7af`;
manifest JSON file SHA256
`7b60a2fae5e5a61d24d3323a7c14f4a77739631d8734781355f3ce6d29ebecda`.
До/после QA730/730 неизменны. Runtime/API/build436/436 byte parity S6;
UI S6 переиспользуется в исходном desktop scope. RC3 после QA меняет только
prose STATUS, шаг активации в staging-autodeploy и этот handoff, отдельно
фиксирует delta/manifest и проверяет формат. Будущие prose bytes не входят в RC2 PASS.

Workflow выкатывает только push stage с repo flagtrue после4CIjobs; strict
known_hosts и отдельный restricted SSH key, staging environment branch policy.
Helper SHA256 `db1a2498217866091d55130ec74305c45ec51cbb32d8e44a090886b4a9d262f9`.
Backend pinned к deployed0d06d96b62b0, stage-only guards, exactSHA/tag, dry-run,
backup/smoke/rollback release.sh. Новые backend commits/миграции не продвигаются.

Живой deploy/health после push проверяются отдельно; email/Telegram/AI/persistence
и пользовательский stage путь этим mock PASS не подтверждены. Исторический S5a
WebKit lost-submit не воспроизведён, причина не установлена; evidence сохранено.
Подробные snapshots/commands/exits/logs находятся в локальном ignored каталоге
`artifacts/frontend-v2/stage-freeze-2026-10-31/RC1/qa` и `RC2/qa`.
