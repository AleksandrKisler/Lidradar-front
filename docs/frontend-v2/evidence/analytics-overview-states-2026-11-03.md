# Аналитика / Обзор · состояния на согласование

US-M13-01, US-M13-02, US-M13-03. Работа02–03.11.2026, только Figma и evidence.

[Область «Аналитика / Обзор / Состояния — На согласование»](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=1636-7923).

Созданы41состояние ×3адаптива =123редактируемых кадра1440/834/390.
[Таблица всех node IDs](../../../artifacts/frontend-v2/analytics-states-2026-11-02/states-and-node-ids.md),
[карта: состояние → триггер → источник → покрытие → выход](../../../artifacts/frontend-v2/analytics-states-2026-11-02/state-map.md).
Основные копии результата: desktop1637:12469, tablet1637:12801, mobile1637:13110.
Source frames1606:7507/1622:7517/1622:8245 сохранены, фон#F5F5F7 и оболочкаC прежние.
Внутренние состояния «Риски и качество»/«Оплаты» не проектировались; US-M13-04 не расширялся.

## Поведение и источники

Сверены22-analytics.md, ADR0039, действующие frontend/backend OpenAPI,
AnalyticsPage.vue, PeriodPicker.vue, range.ts/range-query.ts, analytics-api.ts,
query-client.ts, realtime.ts, api-context.ts и permissions/routes.
Обе копии OpenAPI SHA-256:9f9766cc4d23e398268aabc68d8adae6db9bf3358bf14953b151f36c617e3027.
Сводка — один GET /api/v1/analytics/summary; отдельные сетевые ошибки её карточек не вводились.
Точность сигналов и список оплат имеют иные запросы, но их внутренние состояния вне этого поручения.

Первичная загрузка/новый период/новая организация скрывают прежние суммы и показывают skeleton.
Обновление того же периода сохраняет его данные только во время запроса; при ошибке вся сводка
заменяется единым recovery. Это соответствует isError перед data в текущем шаблоне; stale mode
после ошибки не предлагался. Период и tenant входят в query key, AbortSignal передаётся;
аннотация требует last-request-wins и игнорирование устаревшего ответа. Быстрые переключения
в loading кадрах связаны с соответствующими новыми диапазонами.

Фон обновляется через tenant invalidation15с в видимой online вкладке, а также focus/reconnect.
Это не promise live-SLA. Локальная review-кнопка обновления не имеет Radar-индикатора
«Автообновление недоступно»; исходный компонент256:2529 и его исходные экземпляры не менялись.
В текущем runtime нет отдельной общей кнопки refresh: её UX для готового редизайна остаётся предложением.

Пять различных успешных состояний: нулевая активность; ORGANIC при recovered=0; активность без
оплат; UNKNOWN; неизвестная оценка части сделок. Нулевые графики без ненулевых столбцов.
confirmedRecovered питает KPI и график; общая confirmed включает RECOVERED/ORGANIC/UNKNOWN.
Деньги — RUB выбранной синтетической организации, оценки и PAID outcome не объявляются оплатой.
Неизвестные оценки имеют отдельный счётчик, не подменяются нулевой известной суммой.

11 согласованных между собой synthetic примеров сохранены в
[design-samples.json](../../../artifacts/frontend-v2/analytics-states-2026-11-02/design-samples.json).
Для основной7-дневной series:19–25октября2026;23октября31 000₽,25октября12 000₽,
остальные дни0₽ возвращённой выручки; ORGANIC16 000₽ на24октября.
Итого recovered43 000₽/2оплаты, confirmed59 000₽/3оплаты.
Суммы категорий, счётчики и дневные totals проверены Python assertions (exit0).
Это design examples релевантных полей, не полный runtime API mock: byType не включён в Обзор.

Период: editable dates отделены от applied7дней;7/30/90, arbitrary4дня,1день,
пустое поле/неверная дата/начало после конца/367включительных дней, исправление,
Cancel/X/Escape без применения и последующая загрузка. Будущие даты не запрещены.
На phone окна fullscreen390×844. PK показывает зону клавиатуры y544–844,
поля и действия выше неё; это не снимок реально открытой клавиатуры.

«Данные по дням» — уже полученная series:7дней с нулями и90дней с внутренней прокруткой,
итогом и переходом к последнему дню. Нового endpoint/загрузки/сетевой ошибки нет.
Выбранный23й день имеет сумму и видимый маркер. Информация доступна через таблицу без hover.

403/отсутствие analytics.read объединены по смыслу в «Нет доступа»,404 — недоступная организация.
Все финансовые блоки скрыты.401 ведёт к текущему входу: desktop773:6361,
tablet464:6336, mobile464:8980; устаревший desktop462:5453 отсутствует.
Межстраничный переход оформлен URL-ссылкой: Figma NODE/NAVIGATE допускает только ту же страницу.
Доступ не редактировался. Guard UX для полного скрытия сводки предложен к согласованию;
текущий runtime отдельных ошибок не объявляется уже соответствующим этим кадрам.

## Компоненты, прототип и доступность

Переиспользованы C shell, навигация, tabs305:2860, metric card659:30493,
revenue chart664:3935(3адаптива), attribution659:30783, buttons21:7500,
date input21:7517 и окно1603:55698. В новых копиях график локально detached для
разных series/размеров и сохраняет редактируемую геометрию; masters не менялись.

Добавлены два изолированных набора: refresh1636:7978(6вариантов:
Default/Hover/Pressed/Focus/Disabled/Busy), поле даты1643:14300(4варианта:
Default/Focus/Error/Disabled). Existing button set уже даёт hover/pressed/focus/disabled.
Добавлены локальные окна series, recovery-состояния и skeleton.
Тексты/таблицы editable, Auto Layout используется в связанных контейнерах;
растровых подложек целого UI нет. Все тексты Inter. Shared tokens не изменялись.
Цвет новых сообщений/таблиц связан с paints текущего Обзора, а не с отличающимися legacy aliases.

В области есть порядок фокуса, focus trap, Escape, возврат фокуса инициатору,
aria-busy/polite status, alert и связь inline-ошибки с полем. Реальное ARIA/Figmaplayback
не доказывается статическими изображениями. Skeleton не зависит от анимации; график — от hover/цвета.

Применён apple-design как принципы для web, без навязывания native iOS-навигации.
Основания: accessibility.md › Vision/Mobility («Convey information with more than color alone»),
charts.md › Best practices («don’t require interaction to reveal critical information»),
modality.md › Best practices, virtual-keyboards.md › Platform considerations.
Контраст посчитан по точным hex: primary/white16.83:1, secondary6.83:1,
link6.64:1, error6.57:1, white/primary-button4.70:1; см.contrast.json.
Touch controls44–46px, строки таблицы48px; длинный пример1 234 567 890₽ помещается.

## Проверка и решения владельца

Figma graph:649 назначений существуют;48 проверок конкретных цепочек и возвратов
прошли(16наадаптив): period/error/fix/apply/result; load/error/retry/result;
refresh/result/error/retry; chart/days/back; longdays/back; cancel.
Это проверка дизайна прототипа, не TEST/FUNCTIONAL/UI PASS приложения.

Визуальная проверка123экспортов и адресных исправлений завершена двумя независимыми
reviewers:82Desktop/Tablet и41MobilePNG реально просмотрены, последние C1/A30
перепроверены после исправлений. Открытых visual findings нет. Ведущий дополнительно
просмотрел ключевые финальные PNG. Все123PNG соответствуют размерам final Figma frames.
Финальные результаты и hashes — в manifest.json; точные списки просмотренных файлов
вvisual-review.json. Figma playback кликами не запускался: цепочки проверены по reactions.
Исторические PNG до исправлений не используются как финальное evidence.

На согласование: модальный редактор/inline validation и mobile fullscreen; skeleton и единая
ошибка summary; достоверная refresh-семантика и ручное действие; chart/touch/series окна;
единый UX потери права/организации. Финансовые правила и разрешения остаются контрактными.

Runtime/frontend/tests/backend/API/production не менялись. TEST/FUNCTIONAL/browser UI NOT RUN.
Реальные focus/ARIA/клавиатура/abort/realtime/auth остаются UNVERIFIED для будущей реализации.
Результат не утверждает макеты и не запускает разработку. Финальный этап: **Состояния готовы к согласованию**.
