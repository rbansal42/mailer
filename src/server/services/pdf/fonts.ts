import { Font } from '@react-pdf/renderer'
import path from 'path'

// Server is always run from project root (both dev and production)
// In dev: process.cwd() = <root>, fonts at <root>/assets/fonts/
// In prod: process.cwd() = <root>, fonts at <root>/assets/fonts/ (copied during build)
const FONTS_DIR = path.join(process.cwd(), 'assets', 'fonts')

// Register Montserrat font family
Font.register({
  family: 'Montserrat',
  fonts: [
    { src: path.join(FONTS_DIR, 'Montserrat-Regular.ttf'), fontWeight: 'normal' },
    { src: path.join(FONTS_DIR, 'Montserrat-Italic.ttf'), fontWeight: 'normal', fontStyle: 'italic' },
    { src: path.join(FONTS_DIR, 'Montserrat-SemiBold.ttf'), fontWeight: 600 },
    { src: path.join(FONTS_DIR, 'Montserrat-Bold.ttf'), fontWeight: 'bold' },
  ],
})

// Register Great Vibes (cursive script for names)
Font.register({
  family: 'GreatVibes',
  src: path.join(FONTS_DIR, 'GreatVibes-Regular.ttf'),
})

// Register Playfair Display (serif for titles)
Font.register({
  family: 'Playfair',
  fonts: [
    { src: path.join(FONTS_DIR, 'PlayfairDisplay-Regular.ttf'), fontWeight: 'normal' },
    { src: path.join(FONTS_DIR, 'PlayfairDisplay-Bold.ttf'), fontWeight: 'bold' },
  ],
})

// Disable hyphenation for cleaner text
Font.registerHyphenationCallback((word) => [word])

export const fontFamilies = {
  sans: 'Montserrat',
  script: 'GreatVibes', 
  serif: 'Playfair',
} as const
