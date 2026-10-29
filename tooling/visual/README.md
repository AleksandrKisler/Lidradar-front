# Визуальная сверка v2

Эталоны Figma (получены через Figma MCP, файл `jN8Hhzn6ObIAEi7FoY9kPu`) кладутся в
`artifacts/frontend-v2/<stage>/reference/<имя>.png`; соответствие имён и nodes — в
`docs/frontend-v2/evidence/<stage>/source-map.md`. Папка `artifacts/` игнорируется git.

```
npm run visual:capture   # собирает pre-prod, снимает кадры реализации в artifacts/frontend-v2/*/actual
npm run visual:compare   # пары из tooling/visual/pairs.json -> diff-картинки и доли расхождения
```

Не запускайте одновременно с `npm run test:e2e`: оба используют порт 4173.
Обычный `playwright test` стирает `test-results/`, поэтому `artifacts/` его не затрагивает.

## Способ полностраничного захвата

- Кадр режется по высоте документа, измеренной в момент съёмки (`fullShot` в `capture.spec.ts`); перед кадром
  дожидаются шрифты и все конечные CSS-переходы (бесконечные анимации спиннера не ждутся).
- Боковая панель в браузере — `sticky` высотой окна (`h-dvh`), при прокрутке она залита до низа (e2e
  «боковая панель залита на всю высоту экрана при прокрутке длинной страницы»). В одном кадре на всю страницу
  она оборвалась бы на высоте окна, поэтому только на время съёмки ей задаётся высота документа. Остальная
  раскладка и высота страницы не меняются (проверяется в `fullShot`).

## Пакет US-M01-01 (регистрация A/B2/B3/C)

Эталоны — `artifacts/frontend-v2/us-m01-01/reference/` (SHA-256 в `reference.sha256`, карта —
`docs/frontend-v2/evidence/US-M01-01/source-map.md`). Кадры и сверка складываются в каталог ревизии:

```
US_M01_01_REVISION=R1 npx playwright test -c tooling/visual/playwright.config.ts us-m01-01
US_M01_01_REVISION=R1 node tooling/visual/us-m01-01-compare.mjs
```

- `us-m01-01.capture.spec.ts` снимает `desktop|tablet|mobile|375-<состояние>.png` и `*.geometry.json`
  в `artifacts/frontend-v2/us-m01-01/<revision>/actual/`, условия — `capture-conditions.json`.
  Имена совпадают с эталонами source-map; без pixel-эталона — `*-b2-empty`, `*-b2-service`,
  `*-b2-429`, общая ошибка на планшете/телефоне и все `375-*`.
- `us-m01-01-compare.mjs` проверяет хеши эталонов, копирует их в `<revision>/reference/`, пишет
  `diff/` и `compare-summary.{txt,json}`. Мобильные эталоны 390×844 обрезаны по viewport:
  сравнивается первое окно, остальное — геометрией (поле 46, действие 44/36/20, ширины
  карточки/поля, footer 64/24, отсутствие горизонтального переполнения). Код 0 не означает
  соответствия макету: доля расхождения — ориентир для ручной сверки.
- Общий `npm run visual:capture` тоже снимает этот пакет (тот же `testMatch`); `visual:compare`
  его кадры не сравнивает.
