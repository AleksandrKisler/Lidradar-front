/** Экспортированные из Figma контурные иконки; цвет задаётся через `UiGlyph`. */
import navRadar from './assets/nav-radar.svg?no-inline'
import navDialogs from './assets/nav-dialogs.svg?no-inline'
import navAnalytics from './assets/nav-analytics.svg?no-inline'
import navIntegrations from './assets/nav-integrations.svg?no-inline'
import cog from './assets/cog.svg?no-inline'
import refresh from './assets/refresh.svg?no-inline'
import banknote from './assets/banknote.svg?no-inline'
import clock from './assets/clock.svg?no-inline'
import circleAlert from './assets/circle-alert.svg?no-inline'
import plus from './assets/plus.svg?no-inline'
import pencil from './assets/pencil.svg?no-inline'
import pointActive from './assets/point-active.svg?no-inline'
import pointInactive from './assets/point-inactive.svg?no-inline'
import settingsSaved from './assets/settings-saved.svg?no-inline'
import locationSuccess from './assets/location-success.svg?no-inline'
import settingsHelp from './assets/settings-help.svg?no-inline'

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
  'point-active': pointActive,
  'point-inactive': pointInactive,
  'location-success': locationSuccess,
  'settings-saved': settingsSaved,
  'settings-help': settingsHelp,
} as const

export type GlyphName = keyof typeof GLYPHS
