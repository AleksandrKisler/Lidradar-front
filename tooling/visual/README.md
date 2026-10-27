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
