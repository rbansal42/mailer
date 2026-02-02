import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { Certificate, LogoBar, Signatories } from '../components'
import { typography, getNameFontSize } from '../styles'

// Academic-formal color palette
const colors = {
  primary: '#1a365d',    // Deep navy
  secondary: '#4a5568',  // Slate gray
  accent: '#b7791f',     // Gold/bronze
  background: '#faf7f0', // Parchment
  border: '#64748b',     // Slate for inner border
}

interface AcademicFormalProps {
  title: string
  subtitle?: string
  recipientName: string
  description: string
  logos?: Array<{ url: string; height?: number }>
  signatories?: Array<{
    name: string
    designation: string
    organization?: string
    signatureUrl?: string
  }>
  certificateId?: string
}

const styles = StyleSheet.create({
  // Outer border container (gold thick border)
  outerBorder: {
    flex: 1,
    border: `3px solid ${colors.accent}`,
    padding: 8,
  },
  // Inner border container (thin slate border)
  innerBorder: {
    flex: 1,
    border: `1px solid ${colors.border}`,
    padding: 25,
    display: 'flex',
    flexDirection: 'column',
  },
  // Logo section
  logoSection: {
    marginBottom: 15,
  },
  // Main content area
  content: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // Title - serif font
  title: {
    fontFamily: 'Playfair',
    fontSize: 38,
    fontWeight: 'bold',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 6,
  },
  // Subtitle
  subtitle: {
    ...typography.subtitle,
    color: colors.secondary,
    textAlign: 'center',
    marginBottom: 10,
  },
  // Decorative line separator (gold)
  decorativeLine: {
    width: 120,
    height: 2,
    backgroundColor: colors.accent,
    marginVertical: 15,
  },
  // "This is to certify that" text
  certifyText: {
    fontFamily: 'Playfair',
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.secondary,
    textAlign: 'center',
    marginTop: 10,
  },
  // Recipient name - elegant serif
  recipientName: {
    fontFamily: 'Playfair',
    fontWeight: 'bold',
    color: colors.primary,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  // Gold underline for name
  nameUnderline: {
    width: 220,
    height: 2,
    backgroundColor: colors.accent,
    marginBottom: 20,
  },
  // Description
  description: {
    ...typography.body,
    color: colors.secondary,
    textAlign: 'center',
    maxWidth: '75%',
    marginTop: 8,
    marginBottom: 15,
    flexShrink: 1,
  },
  // Bottom section with signatories and seal
  bottomSection: {
    marginTop: 'auto',
    paddingTop: 10,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  // Signatories wrapper
  signatoriesWrapper: {
    flex: 1,
  },
  // Seal placeholder (dashed circle)
  sealPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    border: `2px dashed ${colors.accent}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 20,
  },
  sealText: {
    fontFamily: 'Montserrat',
    fontSize: 7,
    color: colors.secondary,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
})

export const AcademicFormal: React.FC<AcademicFormalProps> = ({
  title,
  subtitle,
  recipientName,
  description,
  logos,
  signatories,
  certificateId,
}) => {
  const nameFontSize = getNameFontSize(recipientName)

  return (
    <Certificate backgroundColor={colors.background} certificateId={certificateId}>
      {/* Double border frame */}
      <View style={styles.outerBorder}>
        <View style={styles.innerBorder}>
          {/* Logo bar at top */}
          {logos && logos.length > 0 && (
            <View style={styles.logoSection}>
              <LogoBar logos={logos} />
            </View>
          )}

          {/* Main content */}
          <View style={styles.content}>
            {/* Title */}
            <Text style={styles.title}>{title}</Text>

            {/* Subtitle */}
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

            {/* Decorative line */}
            <View style={styles.decorativeLine} />

            {/* "This is to certify that" */}
            <Text style={styles.certifyText}>This is to certify that</Text>

            {/* Recipient name */}
            <Text style={[styles.recipientName, { fontSize: nameFontSize }]}>
              {recipientName}
            </Text>

            {/* Gold underline */}
            <View style={styles.nameUnderline} />

            {/* Description */}
            <Text style={styles.description}>{description}</Text>
          </View>

          {/* Bottom section with signatories and seal */}
          <View style={styles.bottomSection}>
            {/* Signatories */}
            <View style={styles.signatoriesWrapper}>
              {signatories && signatories.length > 0 && (
                <Signatories signatories={signatories} />
              )}
            </View>

            {/* Circular seal placeholder */}
            <View style={styles.sealPlaceholder}>
              <Text style={styles.sealText}>Official{'\n'}Seal</Text>
            </View>
          </View>
        </View>
      </View>
    </Certificate>
  )
}
