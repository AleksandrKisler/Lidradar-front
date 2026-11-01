# Источники и приоритеты

Уточнение владельца 01.11.2026: до фактического релиза соблюдать
[DESIGN-FREEZE.md](DESIGN-FREEZE.md) и `releaseDesignFreeze` в design-index.
Заморожены только макеты Доступа. Настройки, Аналитика и остальные разделы
вне заморозки; реализация и QA используют текущие утверждённые источники.

## Локальные корни

Актуальные настройки: «Компания и график» утверждена на трёх адаптивах;
«Услуги и цены» desktop `1307:13282`, планшет `1338:13676` и mobile `1352:14063`
утверждены01.11.2026. Mobile approval R40 относится к12 кадрам R39:
карточки услуг и полноэкранные попапы390×844. В R40 добавлены ещё два кадра
подтверждения отключения на каждый адаптив (четвёртая строка).
R41 добавляет по одному loading-состоянию отключения; успешный ответ закрывает
окно без экрана успеха. Новые loading IDs и правило — в `dialogs.disable`.
R42 завершает комплект error-состоянием с повтором в loading того же адаптива.
Решением R43 от01.11.2026 владелец утвердил все normal/loading/error окна
отключения на трёх адаптивах. Полный комплект услуг — по16 кадров — approved.
Точные указатели и решения — `settingsCompanyAndScheduleSelection` и
`settingsServicesSelection.tabletDraft` / `mobileDraft` в design-index. Утверждение источника
настроек не вводит для него заморозку.

- Frontend (единственная область правок): `/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front`.
- Backend documentation (чтение): `/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar/docs` (по умолчанию `../Lidradar/docs` от корня frontend; переопределяется через `LIDRADAR_BACKEND_DOCS`).
- Новый дизайн (чтение): `/Users/aleksandrkisler/Documents/LidRadar_MVP_v1.1_package/design`.
- Figma: https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar

Launcher добавляет только два каталога источников. Не добавляй весь backend
или домашний каталог. В Desktop при недоступности источников используй launcher.

## Что чему отвечает

1. Последние явные решения пользователя — область работы и выбор дизайна.
2. Принятые ADR / API / политика — полномочия, деньги, lifecycle, данные.
3. `docs/user-stories/` в backend — пользовательские пути и негативные проверки.
4. Текущие выбранные Figma frames — внешний вид и адаптивы.
5. Код, тесты, старые SVG и исторические QA — свидетельства, не новая политика.

Конфликт фиксируй с обеими ссылками; не разрешай бизнес-конфликт догадкой.
Цитаты UI в user stories могли относиться к старому интерфейсу: выбранный новый
текст можно перенести, но эффект действия сохраняется. Записывай расхождение
в отчёте; legal/security/money copy не переопределяй без авторитетного основания.

## User stories (backend docs/user-stories)

| Этап                   | Файлы                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------- |
| Введение               | README.md, 01-start-here.md, 04-modules-map.md                                      |
| Доступ                 | 10-access.md                                                                        |
| Онбординг              | 11-onboarding.md, 12-services.md, 13-channels.md                                    |
| Radar                  | 16-radar-risks.md, 15-opportunities.md, 17-actions-outcomes.md, 18-revenue.md       |
| Диалоги / AI           | 14-conversations.md, 21-ai-analysis.md                                              |
| Аналитика              | 22-analytics.md                                                                     |
| Настройки / интеграции | 12-services.md, 13-channels.md, 19-notifications.md, 20-team.md, 23-privacy-data.md |
| Admin                  | 24-platform-admin.md                                                                |
| Общая регрессия        | 25-cross-cutting.md, 30-journeys.md                                                 |

Для каждого сценария сохраняй точные US-Mxx-xx IDs и ссылки на тесты.
Stories про email, Telegram, фоновые задачи и AI дели на проверенную frontend-часть
и интеграционную проверку на разрешённом стенде; моки не закрывают весь story.

## Контракты

В frontend: `docs/architecture.md`, `docs/testing.md`, `contracts/openapi.yaml`,
`contracts/source.json`, `src/shared/api/generated/schema.d.ts`.
В backend docs: `front-end/01-architecture.md`, `02-entities.md`, `03-api.md`,
`04-feature-blocks.md`, `05-sequence-map.md`, `07-quality.md`, `08-readiness-gaps.md`;
читать по сценарию. Исторический `front-end/TASKS.md` не заменяет v2 очередь.

В дизайн-пакете для Settings/Admin: `frontend-contract.md`, `backend-contract.md`,
`STATES.md`, `RESPONSIVE.md`, `responsive-final.json`; для Dialogs/Analytics:
`frontend-audit.md`, `backend-audit.md`, `DELIVERY.md`. Это полезная сверка,
но позднейший принятый ADR/API имеет приоритет.

## Карта дизайна

`design-index.json` — компактный указатель, а не экспорт всех свойств Figma.
Для настроек «Компания и график» 01.11.2026 утверждены desktop `1189:10891`,
планшет `1246:10269` и полный мобильный комплект `1277:11797`, по 21 экрану/
состоянию на адаптив. Точные узлы: `settingsCompanyAndScheduleSelection`,
`tabletDraft` и `mobileDraft`, оба адаптивных ключа со status approved
(имена ключей исторические). Мобильный эталон включает fullscreen попапы390×844
и исправления R31. Решение — `r32.json`; удалённые макеты не использовать.
Утверждение дизайна не присваивает реализации новый runtime PASS.
Для «Услуг и цен» утверждены desktop `1307:13282`, планшет `1338:13676`
и mobile `1352:14063`: `settingsServicesSelection`, `tabletDraft` и `mobileDraft`
со status approved. Все `dialogs.disable` утверждены решением R43: desktop
`1366:14735`, tablet `1366:15008`, phone `1366:15255` с открытыми host рядом.
Loading R41: desktop `1370:15071`, tablet `1370:15094`, phone `1370:15117`.
Error R42: desktop `1373:15125`, tablet `1373:15152`, phone `1373:15179`.
Construction manifest `artifacts/frontend-v2/settings-polish/figma-2026-10-31/r42.json`,
approval `artifacts/frontend-v2/settings-polish/figma-2026-10-31/r43.json`.
«Уведомления» утверждены владельцем01.11.2026, R47: область `1392:15150`,
desktop `1393:15150`, tablet `1393:15932`, mobile `1393:16559`, по29 кадров
на адаптив. Точные состояния — `settingsNotificationsSelection`; эта запись
заменяет старые визуальные эталоны только уведомлений. Утверждён итог R44–R46:
редактор правил, личный Telegram, подтверждения и обратная связь, включая
последние бордеры и оформление подключения. Состав и текущая геометрия —
`artifacts/frontend-v2/settings-polish/figma-2026-10-31/notifications-redesign-r47/manifest.json`.
Исторические manifests R44/R45/R46 сохранены; R44 PNG предшествуют финальным
правкам. Выбор макетов не разрешает реализацию без отдельного поручения и не
означает runtime TEST/FUNCTIONAL/UI PASS.
Access/Onboarding: approved `id` из ledger, не legacy `sourceId` из plan.
Для согласованных 30.10.2026 US-M01-03–08 используй также
`access.userStoryFlows`: шесть точных путей, 47 desktop-сцен и версия
канонических требований в `Lidradar/docs/user-stories/10-access.md`.
Согласование этого пакета не означает новый runtime PASS или отдельное
согласование tablet/mobile; сохранённые адаптивные эталоны продолжают действовать.
Согласованные 30.10.2026 пути US-M02-01/02/03 указаны в
`onboarding.userStoryFlows`: 25 desktop-сцен, версия требований и ссылки на
`Lidradar/docs/user-stories/11-onboarding.md`. Для общих состояний шага 2,
адаптивов и поведения US-M02-04 сохраняются `onboarding.step2` и его уточнение
от 30.10; новые пути не отменяют этот пакет или открытые findings реализации.
Onboarding: для второго шага используй `onboarding.step2` — 36 текущих кадров,
согласованные правила и компактные компоненты; этот блок заменяет прежние
ledger/correction/skeleton-эталоны только шага 2. Уточнение пользователя
30.10.2026 в [US-M02-04](../../../Lidradar/docs/user-stories/11-onboarding.md#us-m02-04)
и [решении](../../../Lidradar/docs/engineering/US-M02-04-IMPLEMENTATION.md)
имеет приоритет над старыми подписями unset в кадрах 03/04: default 10:00–19:00,
POST → PUT, повтор только PUT; backend/ADR 0045 прежние, ADR 0069 отозван.
`onboarding.step2.behaviorClarification` фиксирует это расхождение без
переименования живых кадров. Для остальных шагов учти `latestCorrection`
и последующие исправления skeleton.
Radar: действующие оригинальные эталоны и новые адаптивы указаны отдельно;
не импортируй исторический radar-hig-review ledger как утверждённый пакет.
30.10.2026 владелец выбрал оболочку C и поручил перенести её в основные макеты:
белая панель навигации, аккаунт/шестерёнка в хедере, workspace внизу. Перенос
на 23 desktop/tablet/phone экрана и меню записан в `radar.shellSelection`;
[карта и ограничения](evidence/radar-shell-c-2026-10-30.md). Остальной контент
канонических Radar frames сохранён; runtime этим дизайн-поручением не менялся.
Следующая итерация того же дня переработала 14 tablet/phone frames: единый app bar,
touch-меню и компактный layout. Текущая компактная оболочка —
`radar.shellSelection.adaptiveRework`, [evidence](evidence/radar-adaptive-rework-2026-10-30.md).
Обзор viewport: `1050:16004` (834×1194) и `1050:16073` (390×844). Desktop C прежний.
Остальные разделы требуют выбора актуального финального frame в своих ledgers.

В начале этапа получи metadata/design context/screenshot только выбранных nodes.
Сохрани в `docs/frontend-v2/evidence/<stage>/` source-map с node, именем,
состоянием, viewport, датой получения и локальным путём экспорта. PNG/diff/logs
храни в игнорируемом `test-results/frontend-v2/<stage>/`; не загружай в git
сырые огромные tool responses. При недоступном MCP запроси доступ или экспорт
нужных frames; не называй текстовое описание pixel-perfect эталоном.
