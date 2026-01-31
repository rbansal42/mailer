import { StyleSheet } from '@react-pdf/renderer'

// Color palette - Elegant Minimal
export const colors = {
  // Primary colors
  primary: '#1e293b',      // Slate 800 - main text, titles
  secondary: '#64748b',    // Slate 500 - secondary text
  accent: '#0ea5e9',       // Sky 500 - highlights, accents
  
  // Backgrounds
  white: '#ffffff',
  light: '#f8fafc',        // Slate 50 - subtle backgrounds
  dark: '#1e293b',         // Slate 800 - dark backgrounds
  
  // Borders and lines
  border: '#e2e8f0',       // Slate 200 - subtle borders
  borderDark: '#cbd5e1',   // Slate 300 - stronger borders
  
  // Text variations
  muted: '#94a3b8',        // Slate 400 - muted text
  gold: '#fbbf24',         // Amber 400 - gold accents
} as const

// Typography scale
export const typography = {
  title: {
    fontFamily: 'Playfair',
    fontSize: 42,
    fontWeight: 'bold' as const,
    letterSpacing: 4,
    textTransform: 'uppercase' as const,
  },
  subtitle: {
    fontFamily: 'Montserrat',
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: 3,
    textTransform: 'uppercase' as const,
  },
  presentedTo: {
    fontFamily: 'Montserrat',
    fontSize: 11,
    fontStyle: 'italic' as const,
  },
  recipientName: {
    fontFamily: 'GreatVibes',
    fontSize: 48,
  },
  body: {
    fontFamily: 'Montserrat',
    fontSize: 11,
    lineHeight: 1.6,
  },
  small: {
    fontFamily: 'Montserrat',
    fontSize: 9,
  },
  signature: {
    name: {
      fontFamily: 'Montserrat',
      fontSize: 11,
      fontWeight: 'bold' as const,
    },
    title: {
      fontFamily: 'Montserrat',
      fontSize: 9,
    },
    org: {
      fontFamily: 'Montserrat',
      fontSize: 8,
    },
  },
} as const

// Base styles used across templates
export const baseStyles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: colors.white,
    fontFamily: 'Montserrat',
    padding: 40,
  },
  logoBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 30,
    marginBottom: 25,
  },
  logo: {
    height: 50,
    objectFit: 'contain' as const,
  },
  contentCenter: {
    alignItems: 'center',
    textAlign: 'center',
  },
  title: {
    ...typography.title,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitle: {
    ...typography.subtitle,
    color: colors.secondary,
    textAlign: 'center',
    marginBottom: 30,
  },
  presentedTo: {
    ...typography.presentedTo,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 20,
  },
  recipientName: {
    ...typography.recipientName,
    color: colors.primary,
    textAlign: 'center',
    marginVertical: 15,
  },
  nameUnderline: {
    width: 200,
    height: 2,
    backgroundColor: colors.accent,
    marginHorizontal: 'auto',
  },
  description: {
    ...typography.body,
    color: colors.secondary,
    textAlign: 'center',
    maxWidth: '80%',
    marginHorizontal: 'auto',
    marginVertical: 25,
  },
  signatories: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 60,
    marginTop: 'auto',
    paddingTop: 30,
  },
  signatory: {
    alignItems: 'center',
    width: 140,
  },
  signatureImage: {
    height: 35,
    marginBottom: 5,
  },
  signatureLine: {
    width: 100,
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 8,
  },
  sigName: {
    ...typography.signature.name,
    color: colors.primary,
  },
  sigTitle: {
    ...typography.signature.title,
    color: colors.secondary,
  },
  sigOrg: {
    ...typography.signature.org,
    color: colors.muted,
  },
  certificateId: {
    position: 'absolute',
    bottom: 25,
    right: 40,
    ...typography.small,
    color: colors.muted,
  },
})

// Helper function to calculate font size based on name length
export function getNameFontSize(name: string): number {
  const length = name.length
  if (length <= 15) return 48
  if (length <= 25) return 42
  if (length <= 35) return 36
  return 30
}
