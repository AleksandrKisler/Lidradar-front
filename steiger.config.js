import { defineConfig } from 'steiger'
import fsd from '@feature-sliced/steiger-plugin'
// Проверяет слои, независимость слайсов и импорты через public API.
export default defineConfig([
  ...fsd.configs.recommended,
  {
    // В starter оставляем по одному примеру feature/widget для дальнейшего расширения.
    // Это не отключает проверки направлений импорта и публичных API.
    rules: { 'fsd/insignificant-slice': 'off' },
  },
])
