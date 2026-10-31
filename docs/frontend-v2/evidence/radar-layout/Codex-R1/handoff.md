# Radar · Завершение работы Claude через Codex

Дата: 31.10.2026. Реализация Claude сохранена; Codex продолжил её в существующей
рабочей копии по [ТЗ](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/RADAR-LAYOUT-CLAUDE-TASK.md).
Область — Radar и деталь риска, AC-RADAR-LAYOUT-01–17. Новый layout остальных
разделов, backend/API, Figma, budgets и lockfile не менялись этим продолжением.

## Что завершено

- Пересняты все состояния оболочки после последних исправлений Claude.
  Добавлены проверки активного видимого фокуса в capture; подготовлены реальные
  viewport-кадры верха/низа, 320–390 и границ 768/1024.
- Добавлена регрессия выравнивания финансовых значений и заголовка. Визуальная
  проверка выявила пересечение сумм на 320; исправлено в RadarSummary по шкале
  UI kit 20/28 для узкого контейнера. На 375/390 и выше прежняя типографика.
  Дополнительная проверка 344 выявила выход на 1,14 px; порог адаптации уточнён
  до 340 px контейнера. Постоянный E2E проверяет 320/344/360/375/390/834/1440,
  текст внутри своей колонки, общую линию значений и desktop-высоту сводки.
- Добавлен тест фактического позднего ответа A после переключения на B:
  настоящий QueryClient/useQuery, отменённый транспорт намеренно продолжает
  Promise и возвращает 999; на экране и в кэше остаются данные B. Runtime
  механизма переключения не переписывался.

Сохранены правки Claude: subgrid сводки и высота 138 px, двухстрочный заголовок,
canvas-кнопка фильтров, отступ под шеврон workspace и 16 px под phone back-link.
Оболочка изолирована на маршрутах Radar/risk; доступ и онбординг сохраняют
AccountHeader, остальные разделы — прежний AppShell.

Файлы продолжения Codex:
[RadarSummary.vue](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/widgets/radar-summary/ui/RadarSummary.vue),
[workspace.spec.ts](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tests/e2e/workspace.spec.ts),
[switch-workspace.test.ts](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tests/unit/features/switch-workspace.test.ts),
[radar-layout.capture.spec.ts](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tooling/visual/radar-layout.capture.spec.ts).
Остальные runtime-изменения — сохранённая реализация Claude, включая новые
RadarShell/RadarNav и ранее изменённые общие компоненты.

## Снимок и доказательства

Ветка `frontend/v2-implementation`, HEAD
`4e175e914719f380dcadb05ccf28d34e9de08439` + dirty tree.
Финальный на этом этапе **Radar S3b**, 604 inputs, manifest SHA-256
`91fe0caa7c57add06db200d66e0a6a1af2f0a014a5076e17649e9775f25d4e1e`.
До/после QA все 604 совпали; прочитанные backend stories проверены отдельно.
Архив исходного продолжения содержит 574 inputs; исходники не восстанавливались
поверх рабочей копии. Политики/документы других авторов сохранены.

Артефакты: `artifacts/frontend-v2/radar-layout/Codex-R1/`.
Основные capture — 36 tests / 59 PNG; дополнительные — 10 tests / 22 viewport
PNG. Source map и 27 approved exports переиспользованы из Claude-R1, оригиналы
неизменны. Chromium 153.0.8010.12, DPR1, ru-RU, Europe/Moscow, fixture F02,
clock 23.10.2026 15:40 МСК. S3b-visual-manifest фиксирует 158 файлов.

Первоначальные sips-кропы имели неверные координаты; они сохранены как история
и исключены из достоверного сопоставления. `reference-crops-v2` получены Pillow
с проверкой размеров и декодированных пикселей. Это производные для просмотра,
а не новые эталоны или изменение исходников Figma.

## Проверки

Независимая роль `lidradar-qa` (Sol/high):

| Проверка S3b                                          | Exit | Результат                                              |
| ----------------------------------------------------- | ---: | ------------------------------------------------------ |
| Адресные unit                                         |    0 | 35/35                                                  |
| Coverage                                              |    0 | 1120/1120, пороги сохранены                            |
| Typecheck, scoped lint/format, FSD, API, architecture |    0 | Все пройдены                                           |
| Build dev / pre-prod / prod                           |    0 | Все три режима                                         |
| Release audit                                         |    0 | Контракт, CSP, security scan, бюджеты                  |
| Полная штатная E2E-матрица                            |    0 | 497 passed / 32 прежних skipped                        |
| FUNCTIONAL probes Chromium/WebKit                     |    0 | 24/24, отдельно после TEST                             |
| Общий check                                           |    1 | Формат пяти внешних m02-step4 документов               |
| Полный lint                                           |    1 | Ошибки только в ignored artifacts; scoped lint зелёный |

Red/green нового дефекта сохранены: `S3-red.log`, `S3b-red.log`,
`S3b-green.log`; адресные проверки после исправления проходят в трёх проектах.
Полный S3b run выполнен заново после runtime-правки; незавершённые S3 и
промежуточный S2c не выдаются за финальную приёмку.

| Production, B без сжатия |    Факт | Прежний лимит |
| ------------------------ | ------: | ------------: |
| Total JS                 | 878 431 |       905 600 |
| Initial                  | 248 756 |       304 800 |
| CSS                      |  68 802 |        72 000 |
| Entry                    |  67 736 |       110 100 |
| Largest                  |  76 245 |       110 100 |

Admin вне initial. Production сохранён до последующей E2E pre-prod сборки;
случайный текущий dist не используется вместо production evidence.

## Приёмка и ограничения

**TEST PASS / FUNCTIONAL PASS** для frontend/mock-области всех 17 критериев.
**UI S3b: desktop PASS / tablet PASS / mobile PASS**, независимая роль
`lidradar-visual-review` (Terra/high) реально просмотрела изменившиеся кадры,
узкие viewport и корректные фрагменты Figma; 52 неизменных кадра переиспользованы
по побайтному совпадению. Блокер сумм закрыт; S1-замечания закрыты. Остались
два Low: многоточие длинного заголовка на320 и разный footer карточек на1023,
без потери действий. Исторический S2c mobile FAIL сохранён отдельно.

Stage и реальные роли/выход/серверная tenant isolation — UNVERIFIED. Mocks
не закрывают живые AC-10/11/12. Global release gates остаются FAIL отдельно
от адресных PASS. Повторная пользовательская приёмка G01 не выполнялась.

G07/F03: контрольные копии сохранены до запуска. Во время полного E2E восемь
historical PNG перезаписываются; последующие browser projects возвращают те же
байты, и конечные 19/19 SHA совпадают. Это не доказывает отсутствие записи или
сохранность mtime. Исправление этих двух однотипных путей входит в следующий
согласованный этап US-M02-04. Неизвестные pre-R3 версии не восстанавливались.

## Ссылки и следующий этап

- [QA S3b: команды, AC matrix, hashes, ограничения](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/radar-layout/Codex-R1/qa-S3/S3b/report.md).
- [Manifest S3b](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/radar-layout/Codex-R1/manifest-S3b.json).
- [Visual manifest](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/radar-layout/Codex-R1/S3b-visual-manifest.json).
- [UI S3b: просмотренные изображения и вердикты](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/radar-layout/Codex-R1/UI-S3b.md).

Radar завершён в согласованном frontend/mock/UI-объёме. Следующий этап также
выполнен: [US-M02-04 R4](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/evidence/us-m02-04/Codex-R4/handoff.md).
На его снимке повторно сняты59 Radar PNG:47 побайтно равны S3b,12 изменений
реально просмотрены независимой ролью; Radar regression PASS. Все изменения
сохранены локально; commit/push/deploy/merge не выполнялись.
