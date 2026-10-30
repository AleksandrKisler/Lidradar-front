/** Экспортированные из Figma контурные иконки; цвет задаётся через `UiGlyph`. */
import navRadar from './assets/nav-radar.svg'
import navDialogs from './assets/nav-dialogs.svg'
import navAnalytics from './assets/nav-analytics.svg'
import navIntegrations from './assets/nav-integrations.svg'
import cog from './assets/cog.svg'
import refresh from './assets/refresh.svg'
import banknote from './assets/banknote.svg'
import clock from './assets/clock.svg'
import circleAlert from './assets/circle-alert.svg'
import plus from './assets/plus.svg'
import pencil from './assets/pencil.svg'

export const GLYPHS = {
  'nav-radar': navRadar,
  'nav-dialogs': navDialogs,
  'nav-analytics': navAnalytics,
  'nav-integrations': navIntegrations,
  cog,
  refresh,
  banknote,
  clock,
  'circle-alert': circleAlert,
  // Шаг «Точки и графики»: плюс «Добавить точку» (Figma 943:18891) и карандаш точки (940:18895).
  plus,
  pencil,
} as const

export type GlyphName = keyof typeof GLYPHS
