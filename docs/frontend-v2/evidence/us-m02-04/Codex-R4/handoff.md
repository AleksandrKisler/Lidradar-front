# US-M02-04 · Кнопка на 320 px и изоляция G07/F03

31.10.2026. Второй этап начат после завершения Radar S3b по согласованной очереди.
[Отчёт Radar](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/evidence/radar-layout/Codex-R1/handoff.md).
Основание — [findings Codex R3](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/evidence/us-m02-04/Codex-R3/review.md),
UI-R3-01 и E-R3-01; аналогичный hardcoded path F03 подтверждён Radar QA.
Backend/API, Figma, budgets, зависимости и lockfile не менялись.

## Изменения

**UI-R3-01:** в footer LocationPage только для ширин меньше360 разрешён перенос
подписи внутри кнопки. Сохранены текст, размер17/20, высота46, ширины и порядок
действий, busy/disabled/aria-связи. Shared UiButton не менялся. На360/375/390 и
шире сохраняется прежняя компоновка. Нет обрезания, многоточия или уменьшения шрифта.

**E-R3-01 / F03:** helper `captureRunEvidence` использует `testInfo.outputPath`,
проверяет расположение до screenshot, затем читает реально созданный PNG,
проверяет signature и прикладывает attachment. G07 и F03 больше не пишут в
historical folders. Изоляция test/project/retry следует штатному output Playwright;
отдельные запуски получают разные output roots. Assertions доступа и длинных
строк сохранены, повторная приёмка всего G01 не проводилась.

Принятое поведение US-M02-04 сохранено: default10:00–19:00, POST→PUT, повтор
только PUT после подтверждённого создания, отдельные черновики, свободное
переключение точек с сохранением ошибок и запрет продолжения при invalid.
Runtime моделей, validation/API adapters и новая оболочка Radar не переписывались.

Ровно три product-файла отличаются от принятого Radar S3b:

- [LocationPage.vue](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/pages/onboarding/ui/LocationPage.vue) — локальный перенос подписи.
- [onboarding.spec.ts](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tests/e2e/onboarding.spec.ts) — 27 новых cases:9 ширин×3 проекта, четыре состояния.
- [access.spec.ts](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tests/e2e/access.spec.ts) — изолированное сохранение G07/F03 и guard/PNG/attachment проверки.

## Регрессии и доказательства

Новый browser-тест измеряет Range каждого видимого текста относительно кнопки,
а не document overflowX. Исключены sr-only строки; проверяются spinner,
отсутствие наложения на «Назад», высота46, стабильные размеры и полная видимость.
Ширины:320/344/360/375/390/768/834/1024/1440. Состояния: enabled, invalid,
saving, retry. Реальная последовательность fixture: initPUT → неверный интервал
→ исправленный dirty draft → удержанный PUT →400 → повторPUT → услуги;
POST не отправляется. На старой версии red: текст x100.06 при границе кнопки110,
тест падает. После правки green42/42, включая G07/F03 во всех трёх проектах.

Защищены **580 historical PNG**: hashes, mtime_ns и sizes сохранены до первого
запуска этапа. Независимый QA подтвердил их неизменность до/между/после двух
output roots. В каждом root реально созданы24 G07/F03 PNG; все265 файлов первого
root сохранили SHA и mtime после второго. Это положительное доказательство
изоляции; неизвестные версии до Codex R3 не восстанавливались.

Канонические captures:55 основных/extra M2,59 Radar regression после CSS-правки,
36 narrow footer viewport в ru-RU/DPR1. Отдельный JSON reporter сохраняет actual
browser/version/environment и измерения девяти viewport; исходная stock E2E
browser-матрица не менялась. En-US картинки обычной матрицы сохранены отдельно,
они не подменяют условия канонической Figma-сверки. Проверка native popup/всех
локалей не заявляется. Original approved exports и baselines сохранены.

## Снимок и TEST / FUNCTIONAL

Ветка `frontend/v2-implementation`, HEAD
`4e175e914719f380dcadb05ccf28d34e9de08439` + сохранённый dirty tree.
R4 manifest651 inputs SHA-256
`44990f2361526328a8e8be923df647015ba4b85d9679f048a252b9ad6f9fd044`.
Включены untracked, project Codex config/roles, актуальные API и canonical
sources. До/после QA651 совпали. Root reporting-документы вне product manifest,
их правки учтены отдельно; root собственный handoff-format исправлен.

Независимый `lidradar-qa` (Sol/high), новые запуски R4 на final product inputs:

| Проверка                                              | Exit | Итог                                                                      |
| ----------------------------------------------------- | ---: | ------------------------------------------------------------------------- |
| Адресные unit                                         |    0 | 85/85                                                                     |
| Адресный browser run                                  |    0 | 42/42, три проекта                                                        |
| Coverage                                              |    0 | 1120/1120                                                                 |
| Typecheck, scoped lint/format, FSD, API, architecture |    0 | Все пройдены                                                              |
| Build dev / pre-prod / prod                           |    0 | Все режимы                                                                |
| Release audit                                         |    0 | Контракт/CSP/security/budgets                                             |
| Полная E2E-матрица                                    |    0 | 524 passed / 32 прежних skipped                                           |
| Manager-denial FUNCTIONAL probe                       |    0 | 3/3: denied, нет формы/Add/записей, возврат в Radar                       |
| Общий check / format:check                            |    1 | После исправления root handoff остались пять внешних m02-step4 документов |
| Полный lint                                           |    1 | Ignored artifacts; source-scoped lint пройден                             |

32 skips не добавлены:30 stand без разрешённой среды и2 прежних WebKit/mobile
Tab cases. Это не пропуск новых27 footer cases. Production сохранён до E2E
pre-prod пересборки; метрики сняты с production, не со случайного текущего dist.

| Бюджет, B без сжатия | Radar S3b | US-M02-04 R4 | Прежний лимит |
| -------------------- | --------: | -----------: | ------------: |
| Total JS             |    878431 |   **878461** |        905600 |
| Initial              |    248756 |   **248756** |        304800 |
| CSS                  |     68802 |    **68893** |         72000 |
| Entry                |     67736 |        67736 |        110100 |
| Largest              |     76245 |        76245 |        110100 |

Admin вне initial. Подсчёт, исключения assets и пороги не ослаблялись.

**TEST PASS / FUNCTIONAL PASS в целевом frontend/mock scope**: оба findings,
аналогичный F03, прежние шесть пунктов и затронутые регрессии. Полная приёмка
всех24 AC остаётся UNVERIFIED для native OS select/стрелок, широких manual
nested-комбинаций и stage; frontend-coverage по AC раскрыто в QA report.
**UI R4: desktop PASS / tablet PASS / mobile PASS; Radar regression PASS.**
Независимый ревьюер (Terra/high) реально просмотрел все36 exact-frame пар,
все36 RU footer viewport и дополнительные focus/scroll/error кадры. На320/344
текст в две строки внутри кнопки, spinner/«Назад» не перекрыты; остальные
ширины сохранены. Проверены12 изменившихся Radar PNG, остальные47 побайтно
совпадают с принятой версией. Source651 и visual416 проверены до/после.
Старые minor N-R7-2/N-R7-6 и Radar titleellipsis320/footerwrap1023 остаются
неблокирующими. Исторический mobile FAIL не переносился на исправление.

## Evidence и ограничения

- [QA R4: команды, AC coverage, isolation и hashes](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/us-m02-04/Codex-R4/qa/report.md).
- [Manifest651](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/us-m02-04/Codex-R4/manifest.json).
- [Protected PNG ledger](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/us-m02-04/Codex-R4/protected-before.json).
- [Red: исходный выход текста](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/us-m02-04/Codex-R4/red.log).
- [UI R4: просмотренные кадры и вердикты](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/us-m02-04/Codex-R4/UI-report.md).
- [Фактические metadata и геометрия footer](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/us-m02-04/Codex-R4/ui-footer-metadata.json).
- [Visual manifest416](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/us-m02-04/Codex-R4/visual-manifest-final.json).
- [Кнопка320 enabled](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/us-m02-04/Codex-R4/ui-narrow-ru-final/footer-320-enabled.png) и [retry](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/us-m02-04/Codex-R4/ui-narrow-ru-final/footer-320-retry.png).

Общий release gate не принят: внешние format/lint FAIL и живой stage UNVERIFIED.
Mock доказательства не подменяют server/worker/OS-проверки. Оба согласованных
этапа завершены в frontend/mock/UI-объёме; далее остаются внешние gates и
живые проверки перед выпуском. Commit/push/deploy/merge
не выполнялись; чужие изменения и evidence предыдущих раундов сохранены.
