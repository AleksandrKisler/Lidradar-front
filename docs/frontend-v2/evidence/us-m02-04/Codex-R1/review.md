# US-M02-04 · Независимая проверка Codex после Claude R5

Дата: 30.10.2026. Область: исправление существующего шага 2, AC-M02-04-01–24.
**FUNCTIONAL: FAIL — воспроизведены три дефекта, не входящие в перечень minor R5.**
Исправления runtime в этой проверке не выполнялись. Backend/API/Figma не менялись.

## Снимок и проверка

Ветка `frontend/v2-implementation`, HEAD `3870d65a23cc50912af7411c3bb7368fda99f1b7`
и незакоммиченные изменения Claude. Сверка манифеста R5: 41 совпадение,
два отличия только в документах — STATUS и `m02-step4-real-screens-2026-10-30.md`.
Runtime и тесты R5 совпадают с переданным состоянием.

Новый [manifest на 879 inputs](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/us-m02-04/Codex-R1/manifest.json)
включает untracked-код/тесты, канонические требования и сохранённые изображения.
Hashes проверены до/после, изменения inputs не обнаружены. Независимый QA —
роль `lidradar-qa`; основной агент не менял проверяемую реализацию.

| Проверка                             | Результат этого раунда                                                                                                  |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Адресные unit, Node 24.19.0          | PASS, 56/56, exit 0: location-step, location-page, settings-forms, entities/setup; `--no-cache`                         |
| `npm run typecheck`                  | PASS, exit 0                                                                                                            |
| `npm run check`                      | FAIL, exit 1 на format:check трёх документов `m02-step4-*.md`; последующие команды цепочки не запустились               |
| Независимые диагностические сценарии | Воспроизведены F-01–03 на неизменённых модулях, Vite SSR и synthetic fetch; реальный backend не вызывался               |
| FUNCTIONAL                           | FAIL: 20 AC PASS, 3 FAIL (12/15/24), 1 UNVERIFIED (23); зелёные существующие тесты не покрывают воспроизведённые случаи |
| Новая визуальная приёмка             | Не запускалась после FUNCTIONAL FAIL по порядку WORKFLOW; изображения R5 сохранены, новый UI PASS не выдан              |
| Живой stage и полные релизные gates  | В этом раунде не запускались, UNVERIFIED                                                                                |

Логи: [unit](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/us-m02-04/Codex-R1/qa/unit.log),
[typecheck](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/us-m02-04/Codex-R1/qa/typecheck.log),
[общий check](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/us-m02-04/Codex-R1/qa/check.log),
[чистое воспроизведение трёх дефектов](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/us-m02-04/Codex-R1/qa/functional-probe-clean.log).
Результаты Claude R5 не объявляются новыми выполненными командами Codex.
Полное покрытие и основания каждого AC — в
[независимом QA-отчёте](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/artifacts/frontend-v2/us-m02-04/Codex-R1/qa/report.md).

## F-01 · P1 · POST/PATCH могут уйти в другую организацию

Место: [use-save-location.ts:25](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/features/manage-locations/model/use-save-location.ts:25).
Связь: AC-24, контекст команды в Accepted решении и frontend-границах.

`onMutate` захватывает tenant только для последующей инвалидации, а `mutationFn`
повторно читает изменяемый getter. Воспроизведение: вызвать сохранение для
`tenant-a`, сменить контекст на `tenant-b` до dispatch. И POST, и PATCH получают
`X-Tenant-ID: tenant-b`, а invalidation остаётся для `tenant-a`.
Операция может изменить данные другой доступной владельцу организации.

Ожидание: запрос и его callback относятся к одному захваченному контексту;
смена выбранной организации не перенаправляет уже начатую команду.
Исправление: передавать зафиксированный tenant в данные команды до первого
асинхронного перехода и использовать его для записи/инвалидации. Добавить
регрессии для POST и PATCH со сменой контекста между вызовом и dispatch.
Backend-правки для этого не нужны.

## F-02 · P1 · Финальная сверка принимает расходящуюся неделю

Место: [location-step.ts:428](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/pages/onboarding/model/location-step.ts:428).
Связь: AC-15/16, финальное подтверждение желаемых недель в Accepted решении.

После финального GET вызывается `publish`, который обновляет чистые/ACK draft
и baseline серверными данными. Следующее сравнение уже использует новый
baseline, поэтому известное расхождение пропускается.

Воспроизведение: желаемое начало понедельника `11:00`, PUT подтверждает `11:00`,
финальный GET возвращает полную неделю с `15:00`. `saveAll()` возвращает `true`,
draft становится `15:00`, `failure` остаётся `null`. Интерфейс разрешает переход
и молча теряет желаемую версию графика.

Ожидание: сравнить финальные данные с зафиксированными желаемыми/отправленными
версиями до обновления baseline. При расхождении сохранить пользовательский
draft, показать неподтверждённое сохранение и остаться на шаге. Добавить
регрессионный тест «ACK совпал, final GET отличается».

Это требование обнаружить уже полученное расхождение, а не новая гарантия
блокировки конкурентных записей или запрос на ETag/CAS/backend-изменения.

## F-03 · P2 · Не проверяется диапазон weekday

Место: [hours.ts:76](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/entities/location/model/hours.ts:76).
Связь: AC-12 — семь уникальных дней с номерами 1..7.

`weekIssues` проверяет число строк и размер Set, но не целочисленность/диапазон
номеров. Неделя с семью уникальными `weekday` от 2 до 8 получает `null`
(«валидна»). Отсутствующий понедельник и несуществующий восьмой день не обнаружены.

Нужно проверять точный состав 1..7 и добавить тесты для сдвинутого набора,
выхода за диапазон, дробного номера и повторяющихся дней. Обычный UI генерирует
фиксированные дни; это узкий дефект строгой валидации, а не доказательство
возможности ввести восьмой день через обычные поля страницы.

## Следующий шаг

Claude исправляет F-01–03 и добавляет регрессионные тесты, сохраняя текущий
объём без backend. После этого — новый snapshot, TEST → FUNCTIONAL →
визуальная проверка трёх адаптивов. Глобальный format:check на трёх документах
остаётся отдельным незакрытым gate; его нельзя считать зелёным за счёт
адресных проверок. Старые 11 minor из handoff R5 остаются отдельной историей
и не подменяют эти новые функциональные findings.

Для AC-23 также не хватает доказательства полного клавиатурного прохода,
focus-return/trap модалки и мобильного селектора. Статичные изображения
и axe не заменяют эту проверку; критерий пока UNVERIFIED.

Автоматическая пересылка в другую сессию, исправление исходников,
коммит/push/deploy в рамках этой проверки не выполнялись.
