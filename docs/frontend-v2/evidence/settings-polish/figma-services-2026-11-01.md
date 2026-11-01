# Услуги и цены · Три адаптива · R33–R43 · 01.11.2026

## R43 · Все состояния отключения утверждены

Явное решение владельца01.11.2026: «Принимаю и утверждаю все состояния окна
«Отключить услугу?» для десктопа, планшета и телефона».

| Адаптив | Normal       | Loading      | Error        | Открытый host |
| ------- | ------------ | ------------ | ------------ | ------------- |
| Desktop | `1366:14735` | `1370:15071` | `1373:15125` | `1366:14752`  |
| Tablet  | `1366:15008` | `1370:15094` | `1373:15152` | `1366:15025`  |
| Phone   | `1366:15255` | `1370:15117` | `1373:15179` | `1366:15306`  |

Утверждены9 состояний и3 открытых host, загрузочная блокировка кнопок/X,
error/retry, fullscreen phone и автозакрытие после успешного ответа без success
окна. Полный комплект «Услуги и цены» теперь approved на трёх адаптивах,
по16 кадров. Приняты текущие снимки R42:1302/`8ce1956e`,1198/`7a8362d3`,
1374/`89650d42`. Более ранние approvals и construction manifests не заменены.

`dialogs.disable.status`, `confirmationAdditionStatus` — approved;
`approvedCurrentSnapshot` хранит принятый текущий снимок, исторические baselines
не перезаписаны. Manifest `r43.json` — approval-only, ledger R43 complete.
Figma writes0; fresh canvas read не выполнялся, решение относится к только что
представленным R40–R42 макетам и сохранённому R42 evidence. Runtime/API/production
не менялись, новая runtime-приёмка не запускалась. Заморозка Настроек не вводилась.

## R42 · Отключение услуги · Ошибка и повтор

По поручению владельца добавлено завершающее состояние ошибки:
[desktop `1373:15125`](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=1373-15125),
[tablet `1373:15152`](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=1373-15152),
[phone `1373:15179`](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=1373-15179).
Новые error frames справа от loading, по16 composed frames в каждом адаптиве.
Desktop/tablet640×407, phone390×844. Геометрия областей прежняя.

Скопирован существующий critical feedback из services add/error: wrapper
574×68 на больших экранах,358×88 на phone. Фон и контур рисует один wrapper,
inner fills/strokes0. Title «Не удалось отключить услугу», message
«Повторите попытку. Если ошибка повторится, попробуйте позже.».
Сохранены название услуги и прежний текст последствий. Нет неподтверждённого
утверждения о серверном статусе услуги после ошибки.

Retry «Повторить отключение» доступен279/358×46 и ведёт в loading своего
адаптива. Cancel/X opacity1, идут в соответствующий main. На phone шапка64,
viewport643 VERTICAL, content252, footer136 при y708; все тексты видимы.
Правило успешного ответа unchanged: автозакрытие, без success сцены/таймера.

Просмотрены3 PNG, размеры/SHA в `r42.json` и `r42-images/`. Native74 новых
уникальных editable IDs, Inter/raster0/overflow0. Все28 проверяемых старых
nodes/rows/masters/notes сохранили fingerprint. Снимки1302/`8ce1956e`,
1198/`7a8362d3`,1374/`89650d42`. Новых variables/styles/shared masters нет.
Whole-view search пуст, переиспользованы точные существующие composite nodes.

Первый read helper ошибся на TEXT note: добавлен capability guard без правок
canvas. Первый write отклонён из-за нематериализованных TEXT внутри нового
instance; API safeToRetry=true, read подтвердил отсутствие R42. Использованы
Title#58:1/Message#58:2 properties, итог без дубликатов. История recovery в manifest.

Карта `dialogs.disable.states.error` во всех трёх адаптивах, ledger R42 complete.
Добавление на просмотре; прежние approvals каталога/add/edit сохранены.
Runtime/API/production и параллельные inputs этой сессией не менялись.
TEST/FUNCTIONAL/browser UI/Present/live request NOT RUN.

Проверки `python3 artifacts/frontend-v2/settings-polish/figma-2026-10-31/r42-check.py`
и `git diff --check` — exit0. Проверены3 PNG/размеры/SHA, retry destinations,
доступность Cancel/X, единый контур,28 сохранённых снимков и14 прочих root sections.

## R41 · Отключение услуги · Загрузка и автозакрытие после успеха

По явному поручению владельца добавлены loading states справа от normal:
[desktop `1370:15071`](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=1370-15071),
[tablet `1370:15094`](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=1370-15094),
[phone `1370:15117`](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=1370-15117).
Desktop/tablet640×315, phone390×844. Секции не меняли размер/позицию;
по15 composed frames, плюс отдельная canvas note о поведении в каждой строке.

Cancel использует существующий Secondary Disabled, opacity45%; X тоже45%.
В новых loading frames все native actions0, включая потомков X и кнопок.
Busy action переиспользован как instance с Label «Отключаем…», spinner16,
outline/background/text paints из Destructive Default только в новых instances.
Кнопки279×46 на desktop/tablet и358×46 на phone. Fonts Inter, старые styles
и bound paints сохранены; новых variables/styles/shared masters нет.
Поиск whole view/loading button пуст; Code Connect matches0 по прежнему discovery.

Успешный ответ автоматически закрывает окно; success window не создавался.
Это явно записано в canvas notes `1370:15093`/`1370:15116`/`1370:15141`
и `dialogs.disable.afterSuccess` всех адаптивов. Нет AFTER_TIMEOUT или
фиктивного сетевого результата. Живой response/autoclose не тестировался.

Просмотрены3 PNG, размеры/SHA в `r41.json`/`r41-images/`; desktop/tablet
pixels совпадают. Native62 новых уникальных editable IDs, raster0/overflow0.
Все13 прежних источников/строк,6 normal/host и3 shared masters MATCH;
Access Busy master не менялся. Снимки1278/`3c019059`,1174/`994505e6`,
1348/`fb8f0cc7`. Карта/ledger R41 обновлены; добавление на просмотре.
Runtime/API/production и параллельные inputs этой сессией не менялись.
TEST/FUNCTIONAL/browser UI/Present/live tap/scroll NOT RUN.

Проверки `python3 artifacts/frontend-v2/settings-polish/figma-2026-10-31/r41-check.py`
и `git diff --check` — exit0: размеры/PNG SHA, disabled actions,3 спиннера,
22 сохранённых source snapshots, отсутствие success сцены/таймера и14 других
корневых разделов карты. Живое автозакрытие не выдаётся за runtime PASS.

## R40 · Mobile утверждён, добавлено подтверждение отключения

Владелец утвердил mobile R39 `1352:14063`,12 кадров,1082/`3ce837b9`,
и явно поручил добавить забытое окно `534:4412` в desktop/tablet/phone.
Решение записано как approval R40 для исходных трёх строк. Новая четвёртая
строка с подтверждением ожидает отдельного просмотра, approval не перенесён.

Добавлены строки [desktop `1366:14734`](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=1366-14734),
[tablet `1366:15007`](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=1366-15007),
[phone `1366:15254`](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=1366-15254).
В каждой — normal prompt и открытый host, по14 кадров на адаптив.
Текст и набор действий взяты из существующего подтверждения: название услуги,
последствия, «Оставить активной», «Отключить», крестик. Source не менялся.

Desktop `1366:14735` и tablet `1366:15008`640×315: в новых копиях кнопки
стали279 FILL вместо280, вместе с gap16 помещаются в574. Host1440×1000
с центром x400/y342.5; tablet834×1194, центр x97/y439.5.
Phone `1366:15255` и host `1366:15306`390×844, overlay `1366:15558`0/0:
шапка64, viewport643 VERTICAL, содержимое148, footer136 при y708;
две кнопки358×46, видимый крестик справа16, hit46. Текст последствий358×80
полностью видим. Phone framework взят из утверждённого popup R39.

Дизайн-система: whole-view search пуст, Code Connect файлов нет; точный
существующий composite `534:4412` выбран основой. Сохранены instances,
Inter styles и variables,494 bound nodes в трёх новых строках. Новых
styles/variables/shared masters нет. Переход536:4519 в legacy очищен;
Cancel/X направлены в main соответствующего адаптива. Post-disable исход
не нарисован и не прототипирован; normal prompt — весь текущий scope.
Утверждённые existing switches и другие контролы не менялись.

Области увеличены до5024/5800/5184 по высоте; tablet y5280 и mobile y11336,
между областями256. Все9 прежних строк сохранили fingerprint; источник
подтверждения и3 company-area тоже MATCH. Новые680 nodes — editable,
raster0, overflow0. Current snapshots1258/`75537885`,1154/`bdd2cfc7`,
1326/`831f10fd`; approved исторические baselines сохранены отдельно.

Просмотрены6 native PNG: три отдельных диалога и три host композиции.
Desktop/tablet dialog PNG совпадают по SHA; mobile host и popup тоже совпадают.
Размеры/SHA и IDs в `r40.json`, изображения `r40-images/`. Первый return
после clone не материализовал всех nested instance IDs; финальный read
вернул680 уникальных текущих IDs, сохранены оба списка для аудита.

Карта `settingsServicesSelection.dialogs.disable`, `tabletDraft.dialogs.disable`,
`mobileDraft.dialogs.disable`. Ledger `/tmp/design-system-state-settings-services-r40.json`.
Figma task only: runtime/API/production не менялись, текущая параллельная
работа сохранена. TEST/FUNCTIONAL/browser UI/Present/live tap/scroll NOT RUN.

`python3 artifacts/frontend-v2/settings-polish/figma-2026-10-31/r40-check.py`
и `git diff --check` — exit0. Проверены6 PNG/размеры/SHA, fullscreen геометрия,
9 сохранённых строк,4 источника и неизменность14 остальных root sections карты.

## R39 · Планшет утверждён, мобильные карточки и полноэкранные попапы

Владелец утвердил планшет `1338:13676`,949/`7474c842`, и поручил полную
мобильную адаптацию. После прерывания сделан fresh inventory: mobile Services
не было, поэтому дубликаты не создавались. Создана [область `1352:14063`](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=1352-14063),
x6808/y8630,2916×4084, gap256 под планшетом. Три строки,12 composed frames.

Основной экран `1352:14067`,390×1628, использует принятую phone-оболочку
компании. Таблица заменена шестью карточками358×190: название, точка, цена,
статус, карандаш, switch и вопрос. Все шесть цен прежние, нулевая не добавлена;
«Удаление царапин» отключено, один info открыт. Фильтры6/5/1, вкладки358/1120
с HORIZONTAL overflow. Плюс28 в hit44 у заголовка; контролы карточек44.
Имя до2строк с ellipsis. Scoped set `1350:4154`, Active true/false и TEXT
Name/Point/Price; переключение связывает variants, сохраняя контент.

Scoped phone help `1350:4156` взят из tablet set, уменьшен popup до324×146,
расположен снизу с gap8. Default/Hover × End/Start, tap/hover и возврат;
reverseZ=true в списке показывает его поверх следующей карточки. Собственный
card header/metadata остаётся видимым. Использованы прежние Inter styles,
fill/stroke/radius/spacing variables;93 bound nodes, новых tokens нет.
Галерея Active/Off как instances реально просмотрена и сохранена PNG.

Все11 popup occurrences — ровно390×844: девять самостоятельных состояний
и два открытых host. Создание `1353:14227`/`14319`/`14415`/`14434`, изменение
`1353:14535`/`14627`/`14723`/`14742`, новая услуга `1353:14843` (префикс1353
общий). Header64 и footer136 закреплены, viewport643 с native VERTICAL;
success использует оставшиеся780px без формы/footer. Полные поля358×46,
ценовые171×46; крестик имеет видимый right inset16. Body normal484,
error588 — содержимое не обрезается. Единый feedback358×88 рисует фон/контур
одним узлом, внутренний instance прозрачен, исключая прошлый border mismatch.

Saving сохраняет введённые данные, блокирует поля/Cancel/X, показывает
spinner16/«Сохраняем…», actions0. Success имеет галочку, подтверждение,
ОК и «Изменить услугу»; add ведёт к новой услуге, edit — к прежней форме.
Error оставляет поля доступными и данные прежними; retry ведёт в соответствующий
mobile saving. Исторические desktop/tablet назначения в новых сценариях0.

При сборке host проявился унаследованный minHeight1194. Минимум снят, host844;
последующий STRETCH уменьшил overlay до494, поэтому размер overlay восстановлен
после resize родителя. Итог11/11 popup390×844 проверен нативно. Оба host отдельно
просмотрены; их PNG SHA совпадают с normal popup, то есть фон полностью закрыт.
Два недоставленных изображения первоначальной пачки получены отдельным вызовом.
Неверный кандидат spacing/6 остановлен guard до правок; spacing/4 взят из
существующего feedback binding4:44. Размеры и pixels при привязке не менялись.

Реально просмотрены main,9 popup,2 host, gallery и весь canvas. Native1082
editable nodes/218 instances/308 text, Inter, raster0, width overflow0,
table headers0,45 полей; snapshot `3ce837b9`.14 PNG/размеры/SHA в `r39-images/`
и `r39.json`. Все5 source hash совпали с pre-R39, включая desktop услуг1d869c32
и утверждённый планшет7474c842. Company desktop a393da88 отличался от старой
истории уже до R39; причина вне этого поручения не исследовалась, baseline
не перезаписывался. Настройки остаются вне заморозки, Доступ не менялся.

Manifest `artifacts/frontend-v2/settings-polish/figma-2026-10-31/r39.json`,
ledger `/tmp/design-system-state-settings-services-r39.json`, карта
`settingsServicesSelection.mobileDraft`. Mobile ожидает согласования;
tablet status approved. Эта сессия не меняла runtime/API/production,
параллельные runtime/test inputs сохранены. TEST/FUNCTIONAL/browser UI/Present
и живой tap/scroll NOT RUN; это статические Figma-макеты и native wiring.

Локальные проверки: `python3 artifacts/frontend-v2/settings-polish/figma-2026-10-31/r39-check.py`
и `git diff --check` — exit0. Проверены размеры11 fullscreen появлений,
12 экранов, данные/retry/navigation,14 PNG dimensions/SHA и5 source fingerprints.
Все14 остальных корневых разделов design-index неизменны, включая Access.

## R38 · Desktop утверждён, планшет834 и новая область заморозки

Владелец утвердил полный desktop-комплект [«Услуги и цены» `1307:13282`](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=1307-13282).
Указанный дефект badge `1307:13439`: подложка68px была уже текста67+padding20.
В трёх desktop появлениях включён HUG, теперь87×28; текст и семантика
«Отключена» сохранены. Общий neutral master не менялся. Native desktop
fingerprint1027/`1d869c32` после этой правки совпал после сборки планшета.

Создана [область планшета `1338:13676`](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=1338-13676),
x6808/y4024,4610×4350, gap256 под desktop. Три строки: каталог, создание,
изменение;12 composed frames. Main `1338:14703`,834×1194; открытые окна
`1338:14984` / `1338:15163` того же viewport. Использованы утверждённая
планшетная оболочка компании `1246:10274` и утверждённый desktop услуг.

Каталог786px с inner736, колонками208/104/124/104/148 и gap12 без боковой
прокрутки таблицы. Шесть услуг, все цены и фильтры6/5/1 сохранены. Иконка
добавления28px в области44×44; edit/switch/help44. Вкладки сохраняют desktop
формат1120 в viewport786 и native HORIZONTAL overflow. Шапка72px, отступы24.

Для длинного сообщения использована локальная копия Tap44 `1337:4159`,
State Default/Hover × Align Start/End, Message property, прежние переменные
и text style,16 bound nodes. Popup358×126 над вопросом, gap8. Изменение
позиции popup внутри instance было отклонено API с safe retry; незавершённый
probe не committed. Позиция исправлена в новом scoped set, общий phone master
не менялся. Native click/hover и возврат ведут в новые variants. При визуальном
просмотре popup, направленный вверх, перекрывался предыдущими строками;
reverseZ=false в новых каталогах устранил дефект. Финальный main просмотрен.

Все формы normal/saving/success/error и edit новой услуги перенесены:
normal/saving/success640×673, error640×765. Embedded dialog центр x97/y260.5.
Данные сохранены, saving fields opacity50%/spinner16/actions0, success без
заголовка формы и с ОК/«Изменить услугу», error с единым574×68 feedback/retry.
После замены viewport явно восстановлены навигации открытия, ОК, X, Cancel
и повторов — удаление временных desktop-клонов убирало входящие реакции.
Все целевые переходы направлены в tablet; stale desktop navigation0.

Реально просмотрены main, оба открытых host и весь canvas со всеми состояниями.
Native:949 editable nodes,200 instances,285 text, Inter, raster0,
text width overflow0. Финальный fingerprint `7474c842`. PNG четырёх видов,
их размеры и SHA-256 сохранены в `r38-images/` и manifest `r38.json`.
Планшет на согласовании, approval desktop не переносится на новый адаптив.

Уточнение владельца об ограничениях: заморожены **только экраны Доступа**;
Настройки, Аналитика и остальные разделы вне заморозки. Предыдущая область
Онбординга/Radar заменена. Синхронизированы DESIGN-FREEZE, CODE-FREEZE,
AGENTS, CLAUDE, DESIGN, WORKFLOW, SOURCES, RELEASE-SCOPE, releaseDesignFreeze.
Исторический baseline30.10 сохранён, release/API/production gates прежние.
Текущие company desktop/tablet/mobile hash совпали, finding R33 tablet остаётся
исторически UNVERIFIED. В этой сессии runtime/API/production не правились;
во время работы появились дополнительные изменения runtime/тестов другой работы,
они сохранены без вмешательства. git diff --check и проверки manifest/index/
native/PNG/политики завершились с exit0; раздел access в карте сохранил SHA-256.
TEST/FUNCTIONAL/browser UI/Present NOT RUN; живой scroll/tap не прогонялся.

Manifest `artifacts/frontend-v2/settings-polish/figma-2026-10-31/r38.json`,
ledger `/tmp/design-system-state-settings-services-r38.json`, карта
`settingsServicesSelection.tabletDraft`. Мобильная адаптация услуг не создавалась.

## R37 · Успех и ошибка добавления/изменения услуги

По поручению владельца в обе строки добавлены результаты справа от saving:
add success `1331:13637`, error `1331:13658`; edit success `1331:13710`,
error `1331:13731`. Success x2976, error x3680, общая y227.5. Область услуг
5216×3768, строки5088×1128. Предыдущие normal/saving/open-dialog экраны
остаются на своих местах.

Успех640×673 совпадает с размером заполняемой формы: вместо полей и footer
галочка64, подтверждение, ссылки «ОК» и «Изменить услугу». В шапке только X,
текст заголовка формы пустой. Использованы принятые company success composites
`1211:11795` / `1211:11746`; body574×537, центры feedback/actions/body287px
совпадают. Add — «Услуга добавлена» и «Озонирование салона»; edit —
«Изменения сохранены» и «Полировка кузова».

Ссылка редактирования после добавления открывает отдельную заполненную форму
`1331:13595` в конце edit-строки, x4384,640×673: та же новая услуга,1500–2500
RUB. После edit success ссылка возвращает в исходную edit-форму31 000/31 000.
«ОК» и X ведут к основному каталогу. Результаты — отдельные статические примеры,
автоматический выбор исхода saving не добавлен; Present NOT RUN.

Ошибка640×765 сохраняет пять введённых значений saving и доступность полей
для исправления. Critical-сообщение: «Не удалось сохранить услугу» /
«Введённые данные остались в форме. Повторите сохранение.» Блок574×68
рисует заливку и контур одним контейнером, внутренний feedback прозрачен,
x0/y0 — подход R36 без разъезда бордера. Кнопка «Повторить сохранение»
ведёт к соответствующему saving (`1325:13557` / `1325:13603`), без потери
sample-данных. Cancel/X доступны и возвращают к каталогу.

Все четыре результата и общий canvas реально просмотрены. Success по18
editable nodes/5 instances/5 text, error по49/10/17; дополнительная edit-форма
40/9/15. Inter, raster0, text overflow0, stale company navigation0. PNG четырёх
результатов и SHA-256 сохранены в `r37-images/` и `r37.json`. Все семь baseline
текущих company/adaptive/normal/saving узлов совпали; общие masters не менялись.
Исторический R33 tablet finding и утверждённые baseline не переписывались.

Manifest `artifacts/frontend-v2/settings-polish/figma-2026-10-31/r37.json`,
ledger `/tmp/design-system-state-settings-services-r37.json`, карта обновлена.
Runtime/API/production не менялись; TEST/FUNCTIONAL/browser UI/Present NOT RUN.

## R36 · Реальный периметр mobile feedback и сохранение услуг

Владелец приложил скриншот: справа заливка выходит за обводку. R35 усиливал
контур, но не устранил показанный дефект. Native/server pre-fix renders
не воспроизвели расхождение; причина на уровне нативной геометрии не установлена.
Вместо повторной правки opacity у двух выбранных feedback построены единые
auto-layout контейнеры `1324:13557` и `1324:13558`,358×88. Заливка и обводка
рисуются одним узлом; исходные instances `1288:12955` / `1288:13111` внутри
прозрачные, без собственного контура, FILL358, x0/y0. INSIDE1, radius10
на прежней переменной, critical color15:3, opacity35%; strokesIncludedInLayout
false сохраняет размер и внутренние отступы. Общий Access master не менялся.

Оба mobile popup390×844 реально просмотрены через Figma get_screenshot после
исправления: правый край фона и контура совпадает. Сначала завершена эта
правка, затем созданы два состояния сохранения услуг. В строке add справа
`1325:13557`, в строке edit — `1325:13603`, x2272/y227.5, оба640×673.
Область услуг3104×3768, три строки2976×1128; прежние экраны/формы на местах.

Все пять полей/селектов каждой формы в disabled-представлении из существующего
company saving: серый фон, opacity50%, значения видимы, действий ввода нет.
Busy Action `459:3312`: спиннер16 и «Сохраняем…», без повторной отправки.
«Отмена» и X disabled; удалены также вложенные CLOSE reactions — итог0.
Создание показывает валидный введённый пример «Озонирование салона»,1500–2500
RUB; редактирование сохраняет «Полировку кузова»/31 000/31 000. Обычная add
форма с placeholder остаётся прежней. Окна сохраняют исходный размер640×673.

Оба состояния реально просмотрены через Plugin API screenshot: по44 editable
nodes,10 instances,15 text, Inter, raster0, text overflow0. Чтение двух
get_screenshot loading-форм зависло, пакет отменён; использован native fallback.
PNG обоих saving-диалогов и обоих mobile popup сохранены в `r36-images/`
рядом с manifest, размеры и SHA-256 в `r36.json`. Present не запускался.

Desktop компании2306/`fae67cc4`, текущий tablet2302/`a6203ac8` и обе обычные
формы до/после совпали. Mobile2352/`df2f4b10`: два новых локальных wrapper.
Утверждённые baseline и исторический R33 tablet finding не переписывались.
Manifest `artifacts/frontend-v2/settings-polish/figma-2026-10-31/r36.json`,
ledger `/tmp/design-system-state-settings-services-r36.json`; карты обновлены.
Runtime/API/production не менялись. TEST/FUNCTIONAL/browser UI/Present NOT RUN.

По поручению владельца создана [отдельная область `1307:13282`](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=1307-13282),
x6808/y0,1696×1256, на256px справа от desktop-комплекта компании.
Внутри строка `1307:13283` и один [экран `1307:13284`](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=1307-13284),1440×1000.
Это новый draft из `529:4428`; исходный proposal не изменён/не удалён.

Убран warning «Изменения сохраняются отдельно в каждом блоке»: каталог
сохраняет отдельные операции через диалоги, блочных save-контролов здесь нет.
Шесть услуг показывают поддержанные US-M03-01 варианты:31 000 ₽;
8 000–12 000 ₽; от1 500 ₽; до3 500 ₽; «Не указана»;1 490,50 ₽.
Нулевая цена не использована — она запрещена в действующей валидации.
«Удаление царапин» отключено: нейтральный badge «Отключена», switch Off;
остальные пять On. Счётчики6/5/1 и «Показано6 услуг» согласованы.

В отключённой строке открыт прежний информационный tooltip о сохранении
истории и неизвестной цене,320×146. ON_HOVER/MOUSE_LEAVE, без click.
В Auto Layout каталога itemReverseZIndex=true: соседние строки больше не
рисуют свитчи поверх текста подсказки. После уточнения владельца кнопка
`1307:13332` стала165×36, плюс16 слева, Label14/20, padding12/8, gap8.
ID кнопки сохранён. Scoped main `1310:4153` в UI Kit `1310:4152` собран
из существующей Primary, glyph Plus и переменных/стиля; общие masters не менялись.

Финальный реальный экран просмотрен через Plugin API screenshot после правки
кнопки. Native:202 editable nodes,40 instances,55 text,0 raster, Inter;
text width overflow0, Sidebar footer bottom gap24. Warning0; один экран.
Code Connect не найден, whole-view поиск по подключённым библиотекам пуст;
использованы текущие точные local components/styles/tokens. Контракты
прочитаны в US-M03-01/02/03, formatPriceRange/money и schema.

Контроль источников: desktop компании2306/`fae67cc4`, mobile2350/`d7c0c5dd`,
исходный Services111/`4fe70fcf` совпали. Tablet2302 изменил hash с `25dc049c`
на `a6203ac8` во время сессии. Ни одна мутация не адресует tablet или shared
master;16 прочитанных статусов корректны. Причина не установлена; точная
сохранность tablet UNVERIFIED, утверждённый baseline не переписывался.

Manifest/все IDs и операции:
`artifacts/frontend-v2/settings-polish/figma-2026-10-31/r33.json`.
Карта `settingsServicesSelection`; ledger `/tmp/design-system-state-settings-services-r33.json`.
Новые диалоги, состояния и адаптивы услуг не создавались. Runtime/US/API/
production не менялись; TEST/FUNCTIONAL/browser UI/Present NOT RUN.

## R34 · Обычное заполнение диалогов

По следующему поручению владельца под основным экраном добавлена строка
`1316:13356`, x64/y1320,1568×801. Область `1307:13282` расширена до1696×2185.
Слева [«Добавить услугу» `1316:13357`](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=1316-13357),
справа [«Изменить услугу» `1316:13397`](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu?node-id=1316-13397),
оба640×673. Использованы существующие desktop-формы `534:4372` и `534:4332`.
Создание показывает placeholders названия и цены; редактирование —
«Полировка кузова»,31 000/31 000, «Все точки», RUB. Сохраняются поля названия,
точки, цены от/до, валюты, пояснения и действия «Отмена»/submit.

Исправлен унаследованный overflow: полная ширина поля574 вместо576,
колонки цены и кнопки279+16+279 вместо280+16+280. Лейблы HUG20 с gap8,
внутренний clip снят. Обе формы реально просмотрены на одном screenshot;
правые бордеры полностью видимы. Read-back: по40 editable nodes,9 instances,
15 text, Inter; raster0 и horizontal overflow0. Основные submit-кнопки
без перехода в выдуманное состояние, «Отмена» сохраняет CLOSE.

Добавление `1307:13332` открывает новую add-форму; pencil первой услуги
`1307:13347` — соответствующую edit-форму. Native OVERLAY destinations
проверены; интерактивный Present не запускался. Остальные pencil не менялись.
Внешний вид основного экрана совпал:202 nodes/visual hash `9aef4f4a` до/после
(fingerprint без reactions). Исходные формы сохранились: add40/`7e8d4387`,
edit40/`d5e7de90`. Общие masters не правились. Предыдущее finding tablet R33
остаётся UNVERIFIED; утверждённый baseline не переписан.

Manifest `artifacts/frontend-v2/settings-polish/figma-2026-10-31/r34.json`,
карта `settingsServicesSelection.dialogs`, ledger
`/tmp/design-system-state-settings-services-r34.json`. Состояния saving/success/
error и адаптивы этим поручением не создавались. Новые диалоги ожидают
просмотра владельцем; runtime/API/production не менялись.
TEST/FUNCTIONAL/browser UI/Present NOT RUN.

## R35 · Иконка, открытые диалоги и два мобильных бордера

По трём уточнениям владельца кнопка `1307:13332` заменена компактным синим
плюсом28×28 без подписи/заливки, точно как `1189:10954`. Использован тот же
master `1186:4116`, существующий hover сохранён; ID действия не менялся.
Общий master и утверждённый desktop компании не изменены.

Область услуг `1307:13282` теперь2400×3768, три строки2272×1128 с gap128:
основной экран, создание и изменение. Строка создания `1316:13356`, y1320;
строка изменения `1320:13388`, y2576. Слева в каждой — полный экран1440×1000
с открытым диалогом: add `1320:13389`, edit `1320:13639`. На подложке затемнение
18% из готового примера компании `1227:12124`. Диалоги640×673 центрированы
x400/y163.5. Справа сохранены нормальные формы `1316:13357` / `1316:13397`,
x1568/y227.5; их тексты, значения и поля прежние. Под фоном открытых окон
информационный tooltip закрыт. Главный экран сохраняет свой открытый tooltip.

Плюс ведёт в add-host, первый pencil — в edit-host. X, «Отмена» и подложка
embedded-диалогов возвращают в главный экран через NAVIGATE; standalone
формы сохраняют прежние действия. Это native wiring, Present NOT RUN.
Новых saving/success/error состояний услуг не создавалось.

Дополнительным сообщением владелец указал оба мобильных error-feedback:
`1288:12955` и `1288:13111`. В нативных данных уже стояли INSIDE1 и стороны1,
размер358×88, поэтому причина среза не установлена. Повторно зафиксированы
равные стороны и ширина, контур усилен opacity20%→35% с прежней critical
переменной `15:3` и radius10. Это overrides только двух instances, без shared
master. Оба полноэкранных popup390×844 (`1288:12932`, `1288:13084`) реально
просмотрены: контур замкнут, введённые данные и сообщения остались прежними.

Финальный render всей области услуг просмотрен. Main201 editable nodes,
40 instances,54 text,0 raster; оба host по240 nodes, Inter, raster0,
text overflow0. Шесть услуг и цены сохранены, warning0. Desktop компании
2306/`fae67cc4`, текущий tablet2302/`a6203ac8`, исходные диалоги add/edit
40/`7e8d4387` и40/`d5e7de90` до/после совпали. Mobile2350 nodes изменился
`d7c0c5dd`→`ef978bfb` из-за двух разрешённых контуров. Исторический R33 tablet
finding остаётся UNVERIFIED; утверждённый baseline не переписывался.

Manifest: `artifacts/frontend-v2/settings-polish/figma-2026-10-31/r35.json`;
карта `settingsServicesSelection`, mobile `errorBorderFollowup`; ledger
`/tmp/design-system-state-settings-services-r35.json`. Runtime/API/production
не менялись. TEST/FUNCTIONAL/browser UI/Present NOT RUN.
