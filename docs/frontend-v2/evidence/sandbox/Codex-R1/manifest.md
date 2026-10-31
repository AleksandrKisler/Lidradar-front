# Sandbox S2 · manifest

- Дата: 31.10.2026; ветка `frontend/v2-implementation`.
- HEAD: `4e175e914719f380dcadb05ccf28d34e9de08439` + рабочие файлы, включая untracked.
- Runtime/test/build inputs: **583 файла**.
- SHA-256 inventory: `c85a6d75463dc1987d85b60afcd07d061cd80b274507825ff0c8f81cf43e0a84`.
- Полный список: `artifacts/frontend-v2/sandbox/Codex-R1/S2/manifest.json`.
- Проверка: `python3 artifacts/frontend-v2/sandbox/Codex-R1/S2/snapshot.py`.
- Исходный архив: `artifacts/frontend-v2/sandbox/Codex-R1/S2/source-snapshot.tar.gz`;
  SHA-256 `074d1b194d0ddbbe295c88d1780c684bfd749c40596824dc3c976491e356c19f`.

Inventory покрывает src/tests/tooling/scripts/contracts/public и корневые
build/config code inputs из Git inventory, включая untracked. Отдельно сохранён
`S2/public-config-manifest.json`: 7 tracked публичных dotenv/npm конфигураций,
все побайтно соответствуют HEAD (Git blob + SHA-256), без локальных секретов. Содержимое секретных
локальных env/auth файлов не читается и не архивируется; настройки серверного
stage-proxy не менялись. Markdown handoff/README/STATUS и сами evidence находятся
вне runtime inventory и могут дополняться при неизменном проверяемом коде.

S1 manifest и все неуспешные попытки сохранены отдельно в родительском каталоге;
его TEST FAIL не заменяется результатом S2. Между S1 и S2 изменены ровно пять
inputs: API/model/UI песочницы и её E2E/unit; общие session/menu/route части
в S2 сохранили байты S1. Контракт/generated/package-lock — без diff.

Вердикты относятся только к указанному снимку и scope SB-01–06. Реальный stage/AI
pipeline проверяется отдельно; source manifest не является его доказательством.
