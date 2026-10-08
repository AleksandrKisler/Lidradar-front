/**
 * Цветовые роли колец: у каждого кольца три цвета одного оттенка.
 * `main` — дуга и маркер в легенде, `accent` — более тёмный оттенок для
 * чисел и подписей (читается на белом), `track` — бледный фон кольца.
 * Все цвета выводятся из токенов палитры, новых hex-значений нет.
 */
export type RingTone = 'brand' | 'success' | 'danger' | 'warning' | 'info' | 'neutral'

export interface RingColors {
  main: string
  accent: string
  track: string
}

const tint = (token: string) => `color-mix(in oklab, var(${token}) 15%, var(--color-paper))`
const deeper = (token: string) => `color-mix(in oklab, var(${token}) 85%, black)`

export const RING_TONES: Record<RingTone, RingColors> = {
  brand: {
    main: 'var(--color-brand)',
    accent: 'var(--color-brand-dark)',
    track: tint('--color-brand'),
  },
  success: {
    main: 'var(--color-success)',
    accent: deeper('--color-success'),
    track: tint('--color-success'),
  },
  danger: {
    main: 'var(--color-danger)',
    accent: deeper('--color-danger'),
    track: tint('--color-danger'),
  },
  warning: {
    main: 'var(--color-warning)',
    accent: deeper('--color-warning'),
    track: tint('--color-warning'),
  },
  info: {
    main: 'var(--color-info)',
    accent: deeper('--color-info'),
    track: tint('--color-info'),
  },
  neutral: {
    main: 'var(--color-muted)',
    accent: 'var(--color-ink)',
    track: 'var(--color-line)',
  },
}
