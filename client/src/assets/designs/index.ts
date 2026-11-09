import homeArt from './home.webp'
import woodBg from './wood-bg.jpeg'
import logo from './logo.png'
import modesArt from './modes.webp'
import playArt from './play.webp'
import shopArt from './shop.webp'
import boastArt from './boast.webp'
import competeArt from './compete.webp'
import profileArt from './profile.webp'

/** Design frame from the phone mockups (vertical-stretch 1170×2532). */
export const DESIGN_WIDTH = 1170
export const DESIGN_HEIGHT = 2532
export const DESIGN_ASPECT = DESIGN_WIDTH / DESIGN_HEIGHT

/**
 * Vite-hashed WebP posters. Importing from here (or the files directly)
 * ensures content-hash cache busting — never hardcode `/assets/...` paths.
 * `settings` art is omitted — SettingsScreen is CSS-only.
 */
export const designArt = {
  home: homeArt,
  modes: modesArt,
  play: playArt,
  shop: shopArt,
  boast: boastArt,
  compete: competeArt,
  profile: profileArt,
} as const

export type DesignScreen = keyof typeof designArt

/** UI background textures + marks used directly by rebuilt HTML screens. */
export const uiArt = {
  woodBg,
  logo,
} as const
