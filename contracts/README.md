# Снимок контракта API

`openapi.yaml` — копия `contracts/openapi/openapi.yaml` из репозитория бэкенда.
Фронтенд не редактирует контракт: изменения делаются в бэкенде, затем снимок
синхронизируется и типы генерируются заново.

```sh
LIDRADAR_BACKEND_DIR=/path/to/backend npm run api:sync   # скопировать снимок
npm run api:generate                                     # обновить src/shared/api/generated/schema.d.ts
npm run api:check                                        # убедиться, что типы соответствуют снимку
```

`source.json` фиксирует коммит бэкенда и время синхронизации. Сгенерированный
файл `schema.d.ts` не редактируется вручную и исключён из Prettier и ESLint;
`npm run check` в CI падает при расхождении.
