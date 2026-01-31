import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { Certificate, LogoBar, Signatories } from '../components'
import { colors, typography, getNameFontSize } from '../styles'

interface CleanMinimalProps {
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
  // Container with extra padding for generous whitespace
  container: {
    flex: 1,
    padding: 20, // Extra padding (60 total with Certificate's 40)
    display: 'flex',
    flexDirection: 'column',
  },
  // Logo section with generous spacing
  logoSection: {
    marginBottom: 20,
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
  // Title - simple and clean
  title: {
    ...typography.title,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  // Subtitle in secondary color
  subtitle: {
    ...typography.subtitle,
    color: colors.secondary,
    textAlign: 'center',
    marginBottom: 15,
  },
  // Presented to - muted italic
  presentedTo: {
    ...typography.presentedTo,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 25,
  },
  // Recipient name - script font, centered
  recipientName: {
    fontFamily: 'GreatVibes',
    color: colors.primary,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  // Thin accent underline for name
  nameUnderline: {
    width: 180,
    height: 1,
    backgroundColor: colors.accent,
    marginBottom: 30,
  },
  // Description with vertical spacing
  description: {
    ...typography.body,
    color: colors.secondary,
    textAlign: 'center',
    maxWidth: '80%',
    marginTop: 10,
    marginBottom: 15,
    flexShrink: 1,
  },
  // Signatories at bottom
  signatoriesContainer: {
    marginTop: 'auto',
    paddingTop: 15,
    flexShrink: 0,
  },
  // Single horizontal accent line near bottom
  accentLine: {
    width: '60%',
    height: 2,
    backgroundColor: colors.accent,
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: 15,
  },
})

export const CleanMinimal: React.FC<CleanMinimalProps> = ({
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
    <Certificate certificateId={certificateId}>
      <View style={styles.container}>
        {/* Logo bar at top with generous spacing */}
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

          {/* Presented to */}
          <Text style={styles.presentedTo}>Presented to</Text>

          {/* Recipient name */}
          <Text style={[styles.recipientName, { fontSize: nameFontSize }]}>
            {recipientName}
          </Text>

          {/* Thin accent underline */}
          <View style={styles.nameUnderline} />

          {/* Description */}
          <Text style={styles.description}>{description}</Text>

          {/* Signatories */}
          {signatories && signatories.length > 0 && (
            <View style={styles.signatoriesContainer}>
              <Signatories signatories={signatories} />
            </View>
          )}
        </View>

        {/* Single horizontal accent line near bottom */}
        <View style={styles.accentLine} />
      </View>
    </Certificate>
  )
}
