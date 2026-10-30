# ТЗ для Claude · Исправление второго шага онбординга US-M02-04

Дата: 30.10.2026. Статус: **готово к передаче Claude**.
Основание: согласованные макеты и Accepted решение без правок backend.
Это постановка на **переделку существующего некорректного шага**, а не создание
онбординга с нуля. Подготовка ТЗ не запускает Claude или реализацию в текущей сессии.

## 1. Задача и результат

Исправь существующий `/onboarding/location` в текущем Vue 3 + TypeScript
приложении. Сделай единый второй шаг со списком точек и графиком выбранной
точки, настоящими модалками, независимыми черновиками, инициализацией default
через POST → PUT и сохранением всех необходимых недель существующим API.
Доведи исправление до независимых TEST, FUNCTIONAL и UI-проверок трёх адаптивов.

Рабочая директория: `/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front`.
Срез подготовки: ветка `frontend/v2-implementation`, HEAD
`3870d65a23cc50912af7411c3bb7368fda99f1b7`. В дереве есть незакоммиченные документы
и evidence, включая каноническое обновление US. При запуске заново сверь фактический
HEAD/dirty tree; используй актуальные рабочие файлы, а не только закоммиченный HEAD.
Сохрани чужую работу. Исторические приёмки S4b/S5 не подтверждают этот новый diff.

## 2. Обязательные ссылки и приоритет

- [Accepted решение и API-границы](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar/docs/engineering/US-M02-04-IMPLEMENTATION.md).
- [US-M02-04 и 24 критерия AC-M02-04-01–24](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar/docs/user-stories/11-onboarding.md:114); [таблица AC](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar/docs/user-stories/11-onboarding.md:223).
- [Accepted границы frontend](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/proposals/us-m02-04-implementation-plan.md).
- [design-index: onboarding.step2 и behaviorClarification](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/design-index.json).
- [US-M02-02: существующий успешный сценарий](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar/docs/user-stories/11-onboarding.md:58); регрессии [US-M02-05/06: настройки](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar/docs/user-stories/11-onboarding.md:272).
- [ADR 0045: действующий серверный onboarding](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar/docs/adr/0045-team-onboarding-and-secure-connect.md). [ADR 0069](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar/docs/adr/0069-all-active-location-schedules.md) — **Withdrawn**, не требование и не зависимость.
- [Текущий frontend OpenAPI](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/contracts/openapi.yaml:449) и [канонический серверный OpenAPI](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar/contracts/openapi/openapi.yaml:449) — только чтение.

Приоритет: явное уточнение пользователя 30.10.2026 → Accepted решение и US/AC →
действующий API/ADR → выбранные макеты для визуала → существующий код и старые
отчёты. Backend/API не переопределять. В Figma старые ключи `schedule_unset` /
`other_schedule_unset` и подписи 03/04 сохранены как metadata, но **не требуют
реализовать пустой график**. Руководствуйся `behaviorClarification`.

Правила работы и существующая сборка:

- [CLAUDE.md](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/CLAUDE.md), [Claude operating rules](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/CLAUDE-OPERATING-RULES.md), [действующие настройки Claude](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/.claude/settings.json).
- [lidradar-qa](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/.claude/agents/lidradar-qa.md) и [lidradar-visual-review](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/.claude/agents/lidradar-visual-review.md).
- [WORKFLOW](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/WORKFLOW.md), [RELEASE-SCOPE](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/RELEASE-SCOPE.md), [SOURCES](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/SOURCES.md).
- [архитектура frontend](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/architecture.md), [тестирование](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/testing.md), [UI-направление и токены](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/DESIGN.md).
- [STATUS: исторический S4b](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/STATUS.md:238) и [S5](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/STATUS.md:325) — контекст существующей реализации, а не приёмка этой правки.
- [шаблон ограниченного brief](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/CODEX-TASK-BRIEF.md) — поля snapshot/write set/evidence применимы и к передаче Claude-агентам; шаблон не перезаписывать.

## 3. Уже настроенные агенты и владение файлами

Используй существующую схему **одна основная сессия + два субагента, Sonnet**.
Не создавай новую агентную сборку и не запускай legacy `us-m01-*` роли.

| Участник                      | Что делает                                                                                               | Право записи                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Основная сессия Claude Sonnet | Инвентаризация, исправление существующего кода/тестов, интеграция, capture, устранение findings, handoff | Единственный автор runtime, тестов, fixtures, visual mapping и STATUS                        |
| `lidradar-qa`                 | На замороженном снимке сначала TEST, после PASS — отдельная FUNCTIONAL-проверка всех AC/API/переходов    | Только логи/отчёты в выделенном artifacts-каталоге; без изменения src/tests/config/baselines |
| `lidradar-visual-review`      | После TEST и FUNCTIONAL PASS на том же снимке просматривает reference/actual/diff всех устройств         | Read-only; отдельные вердикты desktop/tablet/mobile                                          |

До передачи reviewer подготовь компактный brief: scope, 24 AC, relevant diff,
manifest с HEAD и SHA-256 всех inputs, включая untracked, список файлов/evidence,
точные reference nodes, условия capture и открытые findings. Не передавай всю
историю диалога. На проверяемом снимке не меняй inputs; исправление findings
создаёт новый снимок. Browser/preview и порт имеют одного владельца; suites
на одном порту не параллелить. UI-агент получает готовые изображения от ведущего.

Не добавляй отдельного функционального агента, трёх агентов по устройствам,
менеджера, Agent Teams или вложенных агентов. Opus — только по отдельному явному
поручению для узкой консультации; автоматически не вызывать.

## 4. Исправить имеющийся код

Сначала составь короткую карту `AC → уже есть / дефект / нет evidence`.
Не повторяй весь анализ проекта и не переписывай готовые соседние сценарии.

Существующая база UI: [токены main.css](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/app/styles/main.css),
[UiSheetDialog](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/shared/ui/UiSheetDialog.vue),
[UiButton](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/shared/ui/UiButton.vue),
[UiSelect](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/shared/ui/UiSelect.vue),
[UiAlert](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/shared/ui/UiAlert.vue)
и [UiPageIntro](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/shared/ui/UiPageIntro.vue).

| Файл                                                                                                                                                   | Изменение или граница                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [LocationPage.vue](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/pages/onboarding/ui/LocationPage.vue)                           | Единый существующий шаг: убрать встроенную «Первую точку», собрать карточки/селектор/график/модалки. Вместо сохранения выбранного editor — общий контроллер.                            |
| [BusinessHoursEditor.vue](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/features/edit-business-hours/ui/BusinessHoursEditor.vue) | Сохранить поля и контроллер настроек; выделить управляемое представление, чтобы смена selected/refetch не уничтожала draft.                                                             |
| [hours.ts](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/entities/location/model/hours.ts)                                       | Onboarding-default 10–19 с прежней маской дней; строгие семь уникальных дней, нормализация и сравнение. Не менять default настроек автоматически.                                       |
| [LocationFormDialog.vue](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/features/manage-locations/ui/LocationFormDialog.vue)      | Использовать настоящую модалку настроек. Для онбординга согласовать copy с предзаполнением; прежняя фраза «График можно настроить после создания» не должна навязывать пустой график.   |
| [LocationForm.vue](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/features/manage-locations/ui/LocationForm.vue)                  | Сохранить поля/валидацию/defaults порогов; получить исход POST и ID. Не создавать вторую независимую форму.                                                                             |
| [use-save-location.ts](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/features/manage-locations/model/use-save-location.ts)       | Захватить tenant/context команды; поздний callback не должен обновлять другой tenant. Инвалидации не стирают dirty-drafts.                                                              |
| [location-api.ts](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/entities/location/api/location-api.ts)                           | Переиспользовать GET/POST/PATCH/PUT. Для сверки нужен свежий GET, а не cache с staleTime 5 минут.                                                                                       |
| [OnboardingLayout.vue](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/app/layouts/OnboardingLayout.vue)                           | При необходимости точечно адаптировать ширину/ритм второго шага: текущие max-width 840/760 не должны диктовать неверную новую композицию. Другие шаги проверить на регрессию.           |
| [OnboardingResumePage.vue](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/pages/onboarding/ui/OnboardingResumePage.vue)           | Сохранить серверную маршрутизацию LOCATION > 0; не добавлять all-active/локальный completed-флаг.                                                                                       |
| [OnboardingProgress.vue](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/widgets/onboarding-progress/ui/OnboardingProgress.vue)    | Переиспользовать ряд шагов, проверить расстояние до title/subtitle; менять только при доказанной необходимости.                                                                         |
| [SettingsCompanyPage.vue](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/src/pages/settings/ui/SettingsCompanyPage.vue)               | Потребитель общего редактора: обязательная регрессия. Правка только при необходимости совместимости с выделенным представлением, без новой инициализации/default или смены dirty-guard. |

Локальная модель инициализации/черновиков/очереди допускается в существующем
`src/pages/onboarding/model/`. Имя/декомпозицию выбери по FSD, без глобального
store и горизонтального импорта feature → feature. Экспорты/index этих slices
меняй только по необходимости. Общие UI primitives и токены переиспользуй.

Разрешённый write set: перечисленные frontend slices/layout/progress,
связанные unit/E2E/visual fixtures, компактные отчёты/evidence и запись об этом
исправлении в STATUS. Общие styles/primitives меняй лишь при доказанной
необходимости и с регрессией потребителей. Backend docs/Figma — только чтение;
канонические AC не переписывать ради прохождения. `.claude`, `.codex`, lockfile,
OpenAPI/source hash/generated, ENV, backend, SQL и миграции не менять.

## 5. Обязательное поведение исправленного шага

1. **Один экран.** Desktop/tablet: слева точки, справа график. Phone: селектор
   точки и график ниже. Пустой список → баннер «Сначала добавьте точку», редактор
   и сохранение недоступны; плюс доступен после загрузки. «Назад» ведёт к компании.
2. **Создание.** Один POST → сохранить ID и выбрать точку → PUT полной недели
   с её timezone. Рабочие часы default **10:00–19:00**, маска дней прежнего
   стартового шаблона сохраняется. На срезе это Пн–Сб рабочие, Вс выходной;
   никаких новых 5/2 или 7/0. Настройки не получают новый default автоматически.
3. **Сбой после POST.** Точка создана, ID и валидная неделя остаются; повтор
   только PUT этого ID. Не повторять POST/не удалять точку. До подтверждения
   инициализации «Сохранить и продолжить» блокируется, отдельный повтор PUT доступен.
   Неизвестный исход POST — свежая сверка без автоповтора и без доказательства по имени.
4. **Default не требует правки.** После PUT ACK можно продолжить со стандартной
   неделей. «График заполнен» означает валидность; сеть и исход записи учитываются
   отдельно. Штатного пустого графика новой точки нет.
5. **Переключение.** Draft/error принадлежат ID. Invalid A → B → A сохраняет
   строки/ошибки; переключение не сохраняет и не спрашивает подтверждения потери.
   Неверная невыбранная точка остаётся видимой и блокирует весь шаг.
6. **Валидация.** Семь уникальных weekday; `HH:mm`, начало < конца, у выходных
   время не отправляется; ночных интервалов нет. Копирование из первого рабочего
   дня только при корректном исходном интервале, только внутри выбранной точки.
7. **Все необходимые недели.** Проверять весь активный список; последовательные
   PUT с остановкой на первом сбое. Подтверждённые неизменённые недели пропускать.
   A ACK / B fail / C not_sent → сохранить все draft, повторить нужные B/C, не A.
8. **Unknown PUT.** Сначала свежий GET списка. Семантически совпало → подтвердить;
   отличается → после сверки ручной PUT; GET недоступен → без автозаписи.
   После сбоя финальной сверки повторять чтение, а не уже подтверждённые PUT.
9. **Контекст/модалка.** Refetch/PATCH не стирают dirty. Переименование сохраняет
   ID; новый подтверждённый timezone используется без конверсии местных часов;
   active меняет список после PATCH ACK. Поздние ответы чужого tenant/session
   не применяются. Отмена после POST не означает откат уже созданной точки.
10. **Busy/resume.** Во время команды запрещены дубль, правки/выбор, плюс,
    карандаш и «Назад». После F5 возвращаются серверные данные. При открытии
    шага существующий ID без недели получает default и повтор PUT без POST.
    Серверный `LOCATION > 0` сохраняется; не обещать принудительный resume
    каждой незавершённой инициализации, если другая точка уже имеет неделю.
11. **Сохранить настройки.** US-M02-05/06 сохраняют своё подтверждение ухода,
    шаблон и обычное создание точки. Логику онбординга в настройки не распространять.

Новые endpoints, атомарность POST+PUT, общий rollback, durable/offline drafts,
autosave правок, конкурентные версии/ETag и новый предикат backend не входят в ТЗ.
Подробные исключения и классификация ошибок — в Accepted решении, не изобретай
новые гарантии поверх существующего API.

## 6. Макеты и визуальные требования

Область: [основные макеты шага 2](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=927-13052).
Секции: [desktop](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=927-13056),
[tablet](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=927-13058),
[phone](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=927-13060).
Компоненты: [карточка точки](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=940-18891),
[акцентный плюс и варианты](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=943-18896).

| №   | Состояние                             | Desktop                                                                            | Tablet                                                                            | Phone                                                                            |
| --- | ------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 01  | Точек пока нет                        | [1440×1016](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-13058) | [834×1194](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-15205) | [390×844](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-18157) |
| 02  | Добавить точку                        | [1440×1016](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-13221) | [834×1194](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-15368) | [390×844](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-18327) |
| 03  | Новая точка с default †               | [1440×1016](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-13420) | [834×1194](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-15567) | [390×844](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-18534) |
| 04  | Добавлена вторая точка с default †    | [1440×1000](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-13587) | [834×1194](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-15864) | [390×844](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-18711) |
| 05  | Все графики валидны                   | [1440×1000](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-13759) | [834×1194](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-16171) | [390×844](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-18886) |
| 06  | Изменить точку                        | [1440×1000](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-13931) | [834×1194](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-16343) | [390×844](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-19061) |
| 07  | Ошибка формы точки                    | [1440×1016](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-14146) | [834×1194](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-16693) | [390×844](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-19280) |
| 08  | Неверный интервал                     | [1440×1000](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-14346) | [834×1194](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-16893) | [390×844](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-19489) |
| 09  | Ошибка сохранения / инициализации     | [1440×1016](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-14519) | [834×1194](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-17201) | [390×844](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-19666) |
| 10  | Сохранение                            | [1440×1000](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-14693) | [834×1194](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-17510) | [390×844](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-19848) |
| 11  | Выбрана другая точка, ошибка остаётся | [1440×1000](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-14869) | [834×1194](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-17821) | [390×844](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-20031) |
| 12  | Первичная загрузка                    | [1440×1000](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-15041) | [834×1194](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-17993) | [390×844](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=928-20208) |

† В кадрах 03/04 старые unset-copy и значения не являются текущим поведением.
Сохрани утверждённую геометрию, примени default и статусы из уточнения 30.10.
Для них и варианта ошибки инициализации указывай в evidence
`reference-kind = approved-pattern + behaviorClarification 2026-10-30`;
не объявляй точное совпадение текста с неизменённой Figma. Остальные состояния
сверяй с конкретными frames. Переиспользуй exports/hashes; весь файл не выгружай.

Проверь отдельно: карточки 76 px (ширины экземпляров 272 desktop / 248 tablet),
название 16/22, статус 14/20 в одну строку, карандаш сверху справа с hit area
44×44, плюс 46×46 с Primary-заливкой и белой иконкой, Disabled в loading/busy.
Ритм шаги → title → subtitle → контент: **28/12/30 px** на desktop/tablet,
**16/12/16 px** на phone. Typography/отступы строк графика брать из эталона,
не наследовать ошибочный текущий ритм. Проверить длинные допустимые названия,
focus, ошибки, skeleton и отсутствие горизонтального переполнения.

Desktop viewport базово 1440×1000; высота frame может быть 1016 — не подменяй
ею автоматически viewport. Tablet 834×1194, phone 390×844; дополнительно
существующая узкая/промежуточная responsive-матрица. UI Kit имеет приоритет
для переиспользуемых контролов; произвольный редизайн не требуется.

## 7. Тесты и независимая приёмка

Адаптируй существующие тесты вместо второго конкурирующего flow:

[страница шага 2](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tests/unit/pages/location-page.test.ts);
[общие формы/редактор настроек](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tests/unit/features/settings-forms.test.ts);
[domain helpers location/hours](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tests/unit/entities/setup.test.ts);
[маршруты/шаги](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tests/unit/pages/onboarding-steps.test.ts);
[ряд шагов](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tests/unit/widgets/onboarding-progress.test.ts);
[существующий E2E онбординга](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tests/e2e/onboarding.spec.ts);
[responsive E2E](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tests/e2e/responsive.spec.ts);
[общие API-фикстуры](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tests/e2e/fixtures/api.ts);
[visual capture](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tooling/visual/capture.spec.ts);
[карта reference-пар](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tooling/visual/pairs.json);
[visual workflow](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/tooling/visual/README.md).

Добавь адресные тесты новой локальной модели/очереди в существующей структуре.
Не удаляй смысл старых тестов; замени устаревшие ожидания новой US и проверь
сохранённые регрессии. Минимальные доказательства:

| Сценарий                             | Что должно быть доказано                                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| POST201 → PUT200, default без правок | Один POST, правильный ID/timezone/семь дней, 10–19, переход без обязательной ручной правки, двойной submit не дублирует |
| POST201 → PUT400/timeout/5xx         | ID/draft остаются, повтор только PUT sameID; нет POST/DELETE и ложного полного отката                                   |
| Unknown POST / unknown PUT           | Разные ветки; GET сверка, совпало/отличается/недоступно; никакой автоматической записи                                  |
| Invalid A20–09 → B → A               | Нет PUT на switch, A и её ошибка сохранены, valid B не разблокирует шаг                                                 |
| A ACK/B fail/C not_sent              | Повтор только нужных, последующая правка A включает новую ревизию; финальный read-fail не вызывает повтор ACK PUT       |
| Refetch/PATCH/context/F5             | Нет потери dirty/утечки между tenant; прежний resume; восстановление инициализации по существующему ID                  |
| Регрессии                            | Компания/услуги/источник и права OWNER/Manager; настройки: прежний default, модалка, подтверждение ухода                |
| Visual/a11y                          | Все 12 состояний × 3 адаптива, клавиатура/focus/доступные имена, геометрия AC-22 и причина disabled                     |

Свяжи результаты со **всеми AC-M02-04-01–24**, а не только с таблицей выше.
Основные группы: 01–06 экран/модалки/default; 07–11 drafts/errors; 12–13 неделя/
копирование; 14–18 save/повтор/busy/loading; 19–21 назад/отмена/resume;
22–24 визуал/доступность/права.

Node — [версия из .nvmrc](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/.nvmrc) (24.19.0).
Быстрый цикл: адресные `npm run test:unit -- <paths>` и `npm run typecheck`.
На готовом снимке QA выполняет `npm run check`, `npm run build:pre-prod`,
адресный Chromium onboarding E2E и применимую responsive/a11y проверку.
Перед финальной приёмкой обязательны gates WORKFLOW: три build dev/pre-prod/prod,
`npm run audit:release` и штатная browser-матрица `npm run test:e2e`.
Не повторять успешный полный suite без новых inputs/основания; результаты
и старые несвязанные failures фиксировать явно, пороги/coverage не ослаблять.

Visual capture/compare выполнять последовательно с E2E: общий preview-порт 4173.
Capture владеет ведущий; QA исполняет тесты, UI читает готовые изображения.
Сам по себе exit 0 compare или скриншот реализации не доказывает Figma PASS.

Живой QA — `npm run dev:stage` → существующий backend-stage через proxy.
Сначала проверить фактические revision/readiness/OpenAPI и разрешённый
synthetic test tenant по [правилам среды](/Users/aleksandrkisler/Develop/LidradarWorksapce/Lidradar-front/docs/frontend-v2/CLAUDE-OPERATING-RULES.md).
Локальный backend не требуется. Не менять стенд/ENV, не сбрасывать общие данные,
не выводить credentials. Unit/mock и stage-интеграцию учитывать раздельно;
отсутствующий stage-доступ не подменять mock PASS и не останавливать независимые
локальные исправления. Работу над доступом M01 не возобновлять как новую задачу.

## 8. Артефакты и завершение

На каждый раунд `R1`, `R2` и т. д. выделить
`artifacts/frontend-v2/us-m02-04/<round>/`: brief, manifest, source-map,
reference/actual/diff, команды/exit codes и отчёты QA/UI. Это пути будущего
исполнения, а не уже существующее evidence. В tracked документации — компактный
handoff в `docs/frontend-v2/evidence/us-m02-04/<round>/` и запись в STATUS;
большие PNG/логи и секреты в Git не добавлять. Исходные untracked документы
канона должны попасть в manifest и быть доступны всем reviewer.

Готово, когда существующий шаг исправлен по 24 AC, backend/контракт не изменены,
регрессии проверены, TEST и FUNCTIONAL имеют отдельные подтверждённые результаты,
UI имеет desktop/tablet/mobile вердикты на том же snapshot. Отсутствие evidence
означает UNVERIFIED/BLOCKED для соответствующей проверки, а не PASS.

Итог Claude: что исправлено относительно прежнего шага; файлы и snapshot;
AC coverage; команды/exit codes; отдельно mock/живой API; ссылки на изображения;
TEST/FUNCTIONAL/UI verdicts; открытые findings и конкретный следующий шаг.
Никаких push/deploy/merge, Figma-правок или изменения backend по этому ТЗ.
