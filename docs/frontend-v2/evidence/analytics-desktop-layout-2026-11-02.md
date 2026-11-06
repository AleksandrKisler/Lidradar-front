# Аналитика · основной desktop layout · 02.11.2026

По явному поручению владельца два новых содержимых макета помещены в основной
desktop layout C. Ссылки: [Обзор](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=1606-7507),
[Риски и качество](https://www.figma.com/design/jN8Hhzn6ObIAEi7FoY9kPu/LidRadar?node-id=1606-7777).
Находятся рядом ниже исходных блоков, в секции328:17078 страницы299:12337.
Статус новых composed frames: подготовлены к согласованию, без автоматического
утверждения. Story references US-M13-01–04; бизнес-правила не пересматривались.

Обзор1440×1939, Риски1440×2168: auto-layout горизонтальный, sidebar240 + content1200.
Sidebar клонирован из27:2766, активна Аналитика. Унаследованный хедер сохранён,
содержимое клонировано из328:17122/328:17325 без масштабирования; всё редактируемое.
266/414 узлов,96/187 текстовых слоёв. Первичный просмотр обоих финальных PNG выполнен.
Правые1200px финальных PNG имеют2 отличающихся пикселя для Обзора и11 для Рисков;
точное pixel equality не достигнуто. Визуальная проверка не выявила изменения
контента; геометрия верхних блоков и все тексты структурно равны источникам.

Baseline/final fingerprints: Обзор232/99d89803, Риски380/187515cb,
sidebar33/89f58992, tablet125/3083b3ff, mobile122/9004eadc — все сохранены.
Для sidebar требуется загрузить исходную страницу21:2: неполная lazy cross-page
инвентаризация28 узлов не считается изменением. Shared components/styles/variables
не редактировались. Код, тесты, production и старые evidence сохранены.

Snapshot: branchfrontend/v2-implementation, HEADc59bce88a64a596f3b3d2f0fb760105308cb193e;
dirty tree сохранено. Figma session3271eb2b-9b88-4a63-97c7-b188b6ae6a00.
Артефакты: artifacts/frontend-v2/analytics-desktop-layout-2026-11-02/:
brief.md,baseline.json,compose.js,navigation-fix.js,manifest.json,
image-verification.json,images/{source,desktop}-{overview,risks}.png (native sizes/SHA256).

Проверки: JSON syntax exit0. Первая попытка Pillow exit1 (модуль отсутствует).
PNG decoder на Python stdlib: exact pixel assertion exit1; последующий diagnostic
exit0 измеряет различия2/11 пикселей (это не превращает exact equality в PASS).
Скрипт и результаты сохранены:verify-pixels.py,image-verification.json.
Попытка curl source PNG exit6 (sandbox DNS), PNG успешно сохранены из MCP image
payload локально, без обхода сети. Runtime TEST/FUNCTIONAL/browser UI не запускались;
общая приёмка desktop/tablet/mobile остаётся UNVERIFIED. Следующий шаг — решение
владельца по двум composed desktop frames. Реализация требует отдельного поручения.
