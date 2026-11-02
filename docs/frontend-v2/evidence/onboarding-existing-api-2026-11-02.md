# Онбординг: возврат к той же компании · 02.11.2026

По поручению владельца исправлена frontend-логика существующего мастера без
изменения дизайна и backend. US-M02-01/02/03/04; связанные регрессии
US-M01-08/M02-07, настройки компании M02-05/06 и общая форма услуг M03.

**TEST PASS / FUNCTIONAL PASS в frontend/mock scope.** Визуально normal/edit
на desktop/tablet/mobile PASS; дополнительная матрица графика — desktop/tablet
PASS, mobile FAIL с двумя открытыми P2. Общий полный UI PASS не присваивается.
На момент локальной приёмки commit/push/deploy/merge не выполнялись.
Следующим поручением 02.11.2026 владелец разрешил commit/push в stage без
повторного тестирования. Runtime/tests R2 сохранены; штатный CI и автодеплой
не меняются. Результат поставки фиксируется отдельно в
`artifacts/frontend-v2/onboarding-existing-api-2026-11-02/R2/stage-release/`.

## Поведение и границы

- Возврат на шаг 1 открывает ту же компанию через GET/PATCH. Флаг разрешённого
  создания больше не превращает возврат в повторный POST. Явное создание ещё
  одного пространства остаётся по существующей ссылке из списка пространств.
- После создания шаг компании остаётся в browser history; проверена обычная
  цепочка 1→2→3 и возврат 3→2→1 кнопками и browser Back. Первоначальный пользовательский
  случай 3→1 не объявлен воспроизведённым: существующие кнопки уже вели 3→2/2→1,
  но replace при создании убирал компанию из истории, а размонтирование теряло ввод.
- Название компании, несохранённая услуга и графики сохраняются между шагами
  открытого мастера. Смена пользователя/tenant сбрасывает эти черновики;
  запоздавшие ответы не изменяют новую форму или маршрут.
- Во время отправки услуги уход блокируется до ответа, подтверждённый успех
  очищает её черновик. Ошибки сохраняют ввод и позволяют повторить операцию.
- После известного POST201 ID компании сохраняется в URI до обновления сессии.
  Сбой auth/me и reload восстанавливают подтверждённую компанию после проверки
  членства/прав, без второго POST; изменения перед повтором сохраняются PATCH.
- Черновики живут в памяти открытого layout. Reload восстанавливает подтверждённые
  сервером данные; несохранённый ввод после F5 не обещан. Неизвестный результат
  POST не объявляется подтверждённым и не получает гарантию серверной идемпотентности.

Макеты, CSS, токены, размеры и набор контролов не менялись. Подпись существующей
кнопки в режиме редактирования — «Сохранить и продолжить». Поля двух форм компании
и компактные подписи валют дедуплицированы, сохранив порядок/атрибуты/валидацию
и действующие bundle budgets. Backend/API/generated/lockfile/роли/суммы/lifecycle
не менялись; серверные complete/nextStep остаются источником resume.
Удаление точек/услуг остаётся [LIDRADAR-27](https://plane.lid-radar.online/lid-radar/browse/LIDRADAR-27/),
[Hotfix 09.11.2026](../RELEASE-PLAN-2026-11-09.md), здесь не реализовано.

## Файлы и снимок

Владелец runtime/tests — ведущая сессия Codex; независимые роли писали только
evidence. Существовавшие dirty docs/config/evidence сохранены.

- `src/app/layouts/OnboardingLayout.vue`, `src/pages/onboarding/model/state.ts`,
  `src/pages/onboarding/ui/{CompanyPage,LocationPage,ServicesPage}.vue`,
  onboarding index и комментарий lifetime в location-step.
- `src/features/create-organization/`, `src/features/edit-organization/`,
  `src/entities/organization/`: повторное использование формы/схемы и обновление.
- `src/features/manage-services/{index.ts,ui/ServiceForm.vue}`,
  `src/pages/workspaces/ui/WorkspacesPage.vue`: draft и явное создание.
- `tests/e2e/onboarding-navigation.spec.ts`,
  `tests/unit/app/onboarding-isolation.test.ts`,
  `tests/unit/pages/{company-page,invitation-registration}.test.ts`.

Ветка `frontend/v2-implementation`, базовый HEAD
`e7940037e6a15ff6a4e7e2e07b99b981a234e442`; R2 — незакоммиченный снимок,
а не новый commit. Каталог `artifacts/frontend-v2/onboarding-existing-api-2026-11-02/R2/`:
`inputs.json`, `files.sha256`, `snapshot.tar.gz`, `relevant.diff`.
820 inputs, включая untracked; manifest SHA-256
`df39a657368735c5d81c1446b947c002236ca76228b6cd4acece26b0bf258d11`.
До/после TEST/FUNCTIONAL/UI все 820 hashes совпали. После review меняются только
этот отчёт и STATUS; отдельный post-review guard фиксирует docs-only delta.

## Проверки

Независимый `lidradar-qa`, Node 24.19.0; sandbox override для штатных
fs.watch/listen/browser после доказанных средовых EMFILE/EPERM. Исходники,
assertions/coverage/пороги/матрица ради запуска не менялись.

| Команда                                                                                                       | Exit | Результат                                                                          |
| ------------------------------------------------------------------------------------------------------------- | ---: | ---------------------------------------------------------------------------------- |
| Адресные unit, 10 файлов (полная команда в R2/qa/report.md)                                                   |    0 | 133 PASS                                                                           |
| `npm run check`                                                                                               |    0 | 1225 unit/107 файлов, 13 architecture; format/lint/FSD/API/typecheck/coverage PASS |
| `npm run build:dev`                                                                                           |    0 | PASS                                                                               |
| `npm run build:pre-prod`                                                                                      |    0 | PASS                                                                               |
| `npm run build:prod`                                                                                          |    0 | PASS                                                                               |
| `npm run audit:release`                                                                                       |    0 | JS 905395/905600, CSS 71967/72000, initial 237804/304800                           |
| `npm run test:e2e -- --workers=2 --output=artifacts/frontend-v2/onboarding-existing-api-2026-11-02/R2/qa/e2e` |    0 | 1101 PASS, 34 штатных stand SKIP, 0 FAIL/retry/flaky                               |
| Три root-authored capture helpers, отдельные запуски                                                          |    0 | 3 Settings + 10 viewport/dirty + 11 matrix PNG; inputs неизменны                   |

FUNCTIONAL отдельно после TEST: N1–N7 PASS. Новый navigation-файл — 11 сценариев
× Chromium/WebKit/mobile, 33/33 PASS. Проверены точный tenant/body PATCH,
отсутствие повторного POST при возврате/известном201, права, retry, черновики,
смена личности и поздние ответы. Coverage 94.30/86.49/96.28/96.66%, пороги прежние.
Полные команды, exit codes, guards и границы: `R2/qa/report.md` и raw logs.
Preview 4173 остановлен; чужие процессы не затрагивались.

R1 сохранён: TEST PASS, FUNCTIONAL FAIL с QA-R1-01/P1 (same-tenant user change)
и QA-R1-02/P1 (201→refresh503→reload). Оба CLOSED на R2 адресными регрессиями
и отдельным review. Исторические FAIL, пробы и бюджетные превышения не переписаны.

## Визуальные результаты и открытые findings

Независимый `lidradar-visual-review` реально просмотрел 93 PNG, SHA 93/93:
normal/edit — 12 пар + 10 дополнительных снимков; location matrix — 36 actual,
12 references и 11 scroll/top. Chromium 153.0.8010.12, en-US, Europe/Moscow,
DPR 1, fonts ready, animations disabled. Размеры/состояния/время/scrollY/SHA
в `R2/comparisons.json`, `R2/location-matrix.json` и capture metadata.
Figma только читалась; reference-kind approved-pattern, не exact-frame.

- Normal/edit: company/location/services и первая Company форма Settings на
  1440×1000, 834×1194, 390×844 — PASS. Сохранение помещается в кнопку;
  после прокрутки нижние дни доступны. Баннер shell в Settings отличается от
  состояния reference; внутренняя геометрия формы сохранена.
- Location enabled/disabled/saving/retry: desktop PASS, tablet 768/834/1024 PASS;
  mobile 320/344/360/375/390 FAIL для полного соответствия этим состояниям.
- UI-L01/P2 OPEN: при saving на 390×844 форма бледнее approved `928:19848`.
  `LocationPage.vue:405`, busy opacity, уже существует в HEAD; template byte-equal
  по `location-template-baseline.json`. Это не установленная регрессия правки логики.
- UI-L02/P2 OPEN: исходный viewport 390×844 перекрывает вторую строку ошибки
  интервала fixed CTA относительно approved `928:19489`. После прокрутки ошибка
  полностью читается, нижние дни доступны. Причина/давность отдельно не установлены.

Полный UI всех loading/focus/overlay состояний M02/M03 остаётся UNVERIFIED.
Отчёты роли: `R2/ui/report.md`, `normal-edit-report.md`, `location-matrix-report.md`;
они содержат точные evidence и список просмотренных изображений. Оформление
ради закрытия findings не менялось по явному уточнению владельца.

Stage/production/реальный backend, письма и Telegram не проверялись и не менялись;
34 stand SKIP не заменены integration PASS. Логика готова к просмотру локального
diff. Перед полной визуальной приёмкой/поставкой требуется отдельно разобрать
UI-L01/02 и закрыть применимые непроверенные состояния. Первоначальное поручение
не включало публикацию; последующее разрешение на stage записано выше.

## Исправление падения CI · 02.11.2026 · CI-fix-R1

Коммит `d5abbd9` отправлен в stage. [CI 41365010251](https://github.com/AleksandrKisler/Lidradar-front/actions/runs/41365010251)
завершился FAIL на `company-page.test.ts:327`, stage-deploy SKIPPED.
Причина — несогласованный fixture: форма брала часовой пояс среды (UTC в CI),
а mock создания возвращал `Europe/Moscow`. После 201 и сбоя auth/me повтор
корректно отправлял PATCH с UTC. Локальный адресный UTC repro подтвердил
методы `POST,PATCH`, exit 1; это не повторный POST и не ошибка дизайна.

По новому поручению владельца перед первым submit в тесте явно выбран
`Europe/Moscow`. Проверка одного fetch сохранена; дополнительно проверяются
точная последовательность всех методов `['POST']` и полное тело запроса.
Assertions не ослаблены. Соседний сценарий реальной правки имени после201+503
по-прежнему проверяет `POST,PATCH`, точный tenant/body и переход на шаг2.

Независимый scoped QA: TEST PASS / FUNCTIONAL PASS. Все18 unit этого файла
прошли последовательно в UTC, Europe/Moscow, Asia/Yekaterinburg — 54/54,
без фильтра тестов и retries; адресные Prettier, ESLint и typecheck exit0.
Runtime/markup/CSS не менялись,454trackedsrc byte-equal базовому HEAD
`d5abbd95b4c4aff35e1d3bc8f83afddce3a02c34`. Повторных полных check/build/E2E/UI
не было; старые UI-L01/02 OPEN сохранены. После push штатный CI запускается
автоматически; его результат не подменён локальным scoped PASS.

Evidence: `artifacts/frontend-v2/onboarding-existing-api-2026-11-02/CI-fix-R1/`,
`github-failure.log`, `repro-utc.log`, `qa/report.md` и отдельные логи команд.
Snapshot820inputs, manifestSHA
`d48fe0865e84ccab0997f95831f51a3c05cd08c593d1bb1e1090c009ed034362`,
hashguard до/после QA820/820. Последующие изменения — только отчёт/STATUS;
commit/push и новый CI записываются отдельно в artifacts этого исправления.
