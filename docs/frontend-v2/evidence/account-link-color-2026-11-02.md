# Единый цвет ссылки «Аккаунт →» · 02.11.2026

**Реализовано. C3: TEST PASS, FUNCTIONAL PASS AC1–6; UI хедеров desktop/tablet/mobile PASS.**
Текущих axe-исключений для ссылки нет. Цвет исправлен в runtime и359актуальных
Figma TEXT bindings. Stage/production не изменялись.

Поручение владельца: P2, N-ACCOUNT-LINK-COLOR-01. Во всех актуальных хедерах
текстовая Account-ссылка использует существующий `text-link` (`#005BB5`,
computed `rgb(0, 91, 181)`) на всех маршрутах/адаптивах,где она отображается.
Это заменяет только цвет из N-SHELL-HEADER-01; desktop top32,1120×44,
горизонтальный40px и вся прочая геометрия/типографика/behavior сохраняются.
Brand/accent токен,аватар с инициалами,кнопки и другие акценты не меняются.

Runtime: `src/widgets/app-shell/ui/RadarShell.vue`,две текстовые RouterLink.
Удалён `correctedDesktopSettings` и оба маршрутных color conditions.
AccountHeader/SidebarBody уже используют text-link; общий main.css не изменён.
Account avatar на mobile не является текстовой ссылкой «Аккаунт →» и сохраняет
прежний brand на своей белой подложке и размер44×44.

QA-S8-01 больше не является исключением текущего кода: обычные axe scans,
WCAG tags,assertions и пороги прежние. Тесты workspace/responsive побайтно
восстановлены к HEAD5a6ec52;policy helpers/guards из незавершённого C1 удалены
из активного дерева в `artifacts/frontend-v2/settings-header-contrast-policy/superseded-by-color-fix/`.
C1(821inputs,SHAa288cfb92e8d8b20b6ad07b98dea2d27bc75b82fd43191b1f3b1d6af50788dfc)
не принят/не опубликован. Исторические S8/S10/RC8 raw FAIL отчёты сохраняются.

Проверки: существующий settings-desktop-header сохраняет все geometric assertions,
ожидаемые desktop/tablet text colors обновлены по решению владельца; mobile
avatar expectation прежний. Новый account-link-color E2E проверяет15routes×
3адаптива×3browserprojects: normal/hover/focus/после перехода в Account,
сохранность geometry/font/href/brand. Метаданные после посещения не обходят
браузерную privacy-защиту `:visited`; дополнительно будут просмотрены реальные
browser PNG,а авторских visited color overrides в приложении нет.
Focused capture:9main headers +hover/focus/после посещения/фон диалогов;
Privacy проверяется по header,без новой приёмки его body/consent.

Первичный адресный Chromium run:43PASS/14FAIL. Все14относились к новому
слишком широкому selector,захватившему одноимённую вкладку `/settings/account`;
он уточнён до реального `/account`,ожидаемые цвета/счётчик1 не ослаблялись.
Первичный output/PNG/traces сохранены в `addressed-initial-results/`.
Последующие команды/exit codes/snapshot/Figma evidence/QA/UI будут записаны
только после их выполнения. UI-RC8-01/P3 остаётся отдельным открытым finding.

Figma: локальные TEXT fill bindings на существующий `color/link`→`palette/link`
`#005BB5`; значения brand/accent/master tokens не меняются. Источники — текущие
approved selections,старые LEGACY/US snapshot images и Access не изменяются.
Новые manifest/native PNG/proofs: `artifacts/frontend-v2/account-link-color/figma/`.
Полная новая Figma-canvas/body приёмка всех разделов не подразумевается.

Границы: frontend/tests/design docs и согласованная Figma sync. Backend/API,
production,push/deploy/merge не входят в это поручение. Stage остаётся RC8.

## Подготовка immutable C1

Второй адресный проход:39PASS/6PlainLayout selectorFAIL — raw textContent
с переносами не совпал с regex. Проверен error-context/доступное имя;
финальный selector сочетает normalised role name и href `/account`,
ожидания1link/color/geometry прежние. Повторены только6затронутых случаев:
6/6PASS. Обычные axe consumer побайтно прежние,адресный Chromium18/18PASS.
Header geometry regression12/12PASS. Typecheck/lint exit0.
Focused capture:8/9PASS,1mobileNotifications comparison выбрал baseline до
естественногоscroll к кнопке. Подтверждена разница6px scroll; сравнение перенесено
на состояние послеscroll/доopen,затем тот же strict bbox equality,повтор1/1PASS.
Все первичные логи/PNG/traces сохранены. Это исправления новых probes,не
изменения исходных assertions/геометрии приложения.

Figma sync завершена:359/359color/link bindings #005BB5,геометрия/font359/359;
normalized five-page fingerprints прежние за исключением targetfills;
Accesswholepage+area+6flows8/8 и проверяемыеlink/brand/HIG variables8/8 стабильны.
Worker manifest157files,validate-evidence.py exit0;25nativePNG+25финальных
headercrops реально просмотрены worker. Sips zero-offset derivative crop bug
диагностирован/исправлен6/6без изменения nativePNG,source/diagnostics сохранены.
Rootcurrentnative map25entries (18Privacy);active selection override добавлен
в design-index.json. Независимый QA/UI ещё не объявленыPASS.

## C1 check: async readiness и новый C3

C1 immutable:979inputs,manifestSHA
`2a23699d8a7ed299eaf291ae6f903226ca6950f3f3739743f4c6debc36391db6`.
Официальные captures27/27PASS,117PNG/145files;25nativeSHA проверены,
оба142served capture bundles равны.
C1check raw exit1:1210unitPASS/3FAIL,105/106filesPASS;existing integration unit
побайтно HEAD/S10 same. Адресный existing8cases:4PASS/4initial-dialog-missingFAIL.
Причина изолирована bounded probe:8исходныхcases/assertions/старыеtimeouts
сохранены,добавлены только6awaitvi.dynamicImportSettled() передexisting
flushPromises. Probe8/8PASS,exit0;normalizedcopySHA равенoriginal:
`d1714e690db15892de64fd939ed538b0b0199a3bbe09348640c18a7c1dd3df6d`.

Root внёс только эти6await в `tests/unit/features/integrations.test.ts` для
ожидания лениво импортируемых UI dialogs. Продуктовый integration runtime,
его API и бизнес-assertions не менялись. Это readiness тестового setup,
не продолжение отменённой реализации M04. C1 raw FAIL не переписывается.

Подготовка C2 не применила unit-fix из-за Python source-encoding error;
непроверенный snapshot сохранён с меткой PREPARATION_NOT_ACCEPTED и SHA
`2211dbf105e62b07ea0a4e78efb465cad9608e111b266b3986b0abbc181d283e`.
Корректный следующий кандидат — C3. Для него нужны full check и pre-prod
142file byteproof;незатронутые C1 builds/audit/stock/captures переносятся
только при строгой identity runtime/build/E2E/capture inputs. Перенос
указывается отдельно,не выдаётся за повторный запуск команд наC3.

## Итоговая приёмка C3

Ветка `frontend/v2-implementation`, HEAD `5a6ec52` плюс сохранённые dirty/untracked.
Snapshot `/private/tmp/lidradar-account-link-color-c3`,979inputs;manifest SHA-256:
`4a5ae2396a1446cdd3b9e05deb23e9ce61b952dec2b0590c19a6f6101a749411`.
`C3/manifest.json`,archive,delta и proofs сохранены. После TEST/UI snapshot
не менялся; финальные правки main report/STATUS/index status — только документация.

| Где / команда                                       |     Exit | Результат                                                                        |
| --------------------------------------------------- | -------: | -------------------------------------------------------------------------------- |
| C3 `npm run check`                                  |        0 | 1213/1213unit,106files,13architecture;format/lint/FSD/API/types/coverage         |
| C3 `npm run build:pre-prod`                         |        0 | Все142files равны C1current/Privacycapture иpoststock                            |
| C1 `npm run build:dev`, `build:prod`                | 0 каждый | Verified reuse:runtime/build inputs C1→C3 прежние                                |
| C1 `npm run audit:release`                          |        0 | JS903248/905600,CSS71967/72000;largest103901/110100;initial237710/304800         |
| C1 `CI=1 npm run test:e2e -- --fail-on-flaky-tests` |        0 | 1102cases:1068PASS/34expectedSKIP,0fail/retry/flaky;10.1min                      |
| C1 focused capture current / Privacy                | 0 каждый | 9/9 +18/18;117PNG/145files                                                       |
| C1→C3 source/PNG/bundle/input guards                |        0 | 976identicalinputs;979+979immutable;142bundleeq;145capture+499stock SHA безdrift |

Незатронутые C1-команды не запускались заново на C3 и не выдаются за новые
запуски. C3 full check покрывает шесть добавленных readiness await; C3 pre-prod
доказывает соответствие перенесённых изображений. Исходный C1 check FAIL сохранён.
34SKIP:30stand без opt-in и4browser-specific;это не PASS непроверенных сценариев.

Все135новыхAccount cases прошли(15routes×3adaptives×3browserprojects).
Все12прежних падавших contrast cases прошли обычным axe без фильтра/waiver.
`workspace.spec.ts`/`responsive.spec.ts` побайтно прежние. Пороги/теги/coverage/
browser coverage/budgets/lock/CI не ослаблялись. Новое ожидание цветов в header
тестах соответствует решению владельца; geometric/href assertions сохранены.

Независимый UI покрыл27точных header pairs:11просмотрены лично,16повторно
использованы внутри C3 после точного совпадения native+actual SHA с уже лично
просмотренной парой. Также реально просмотрены54extra interaction/context PNG,
3полных native контекста по адаптивам и referenceheader1307:13352.
Все3адаптива PASS только в header-color/geometry scope. P3UI-RC8-01 открыт;
существующее затемнение Privacy overlay и R57body не исправлялись/не принимались.

Артефакты: `artifacts/frontend-v2/account-link-color/`:

- `C3/qa/test-report.md` — TEST/FUNCTIONAL,AC1–6,actual vs reuse commands/exit;
- `C3/qa/bundle-142-proof.json`, `test-composition.json`, `ordinary-axe-closure.json`;
- `C3/ui/report.md`, `reviewed-images.json` — независимые три UI verdict;
- `C3/comparisons/index.json` — node IDs/пути/native+actual/SHA/bounds;
- `figma/r1/report.md`, `manifest.json`, `source-map.json` — 359bindings/25native/25crops/Access guards;
- `C1/qa/` — исходные captures,fullstock/build/audit и raw check FAIL/probe;
- `C2/preparation-not-accepted.json` — сохранённый непроверенный preparation.

Основные browser кадры Уведомлений:
[desktop](../../../artifacts/frontend-v2/account-link-color/C1/qa/capture/current/notifications/desktop/main.png),
[tablet](../../../artifacts/frontend-v2/account-link-color/C1/qa/capture/current/notifications/tablet/main.png),
[mobile](../../../artifacts/frontend-v2/account-link-color/C1/qa/capture/current/notifications/mobile/main.png).
Header/hover/focus/послеAccountvisit/фонdialogs и другие разделы перечислены
в comparison index. Внешняя Figma изменена только в явно порученных fill bindings;
backend/API/production/stage,sharedbrand/buttons/avatar и чужие правки сохранены.
Push/deploy/merge не выполнялись; stage остаётся RC8 с прежним кодом.
