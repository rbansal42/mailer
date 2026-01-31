import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { Certificate, LogoBar, Signatories } from '../components'
import { colors, typography, getNameFontSize } from '../styles'

interface WaveAccentProps {
  title: string
  subtitle?: string
  recipientName: string
  description: string
  logos?: Array<{ url: string; width?: number }>
  signatories?: Array<{
    name: string
    designation: string
    organization?: string
    signatureUrl?: string
  }>
  certificateId?: string
}

const styles = StyleSheet.create({
  // Main content container
  content: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 70, // Space for wave layers
    overflow: 'hidden',
  },
  // Title section
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
    marginBottom: 15,
  },
  // Presented to text
  presentedTo: {
    ...typography.presentedTo,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 20,
  },
  // Recipient name
  recipientName: {
    fontFamily: 'GreatVibes',
    color: colors.primary,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 5,
  },
  // Name underline
  nameUnderline: {
    width: 250,
    height: 2,
    backgroundColor: colors.accent,
    marginBottom: 20,
  },
  // Description text
  description: {
    ...typography.body,
    color: colors.secondary,
    textAlign: 'center',
    maxWidth: '80%',
    marginTop: 10,
    flexShrink: 1,
  },
  // Signatories container - positioned above wave layers
  signatoriesContainer: {
    marginTop: 'auto',
    paddingTop: 15,
    zIndex: 10,
    flexShrink: 0,
  },
  // Wave layer 1 (back) - light color
  waveLayer1: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: colors.light,
  },
  // Wave layer 2 (middle) - border color
  waveLayer2: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 45,
    backgroundColor: colors.border,
  },
  // Wave layer 3 (front) - accent color
  waveLayer3: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: colors.accent,
  },
})

export const WaveAccent: React.FC<WaveAccentProps> = ({
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
      {/* Logo bar at top */}
      {logos && logos.length > 0 && <LogoBar logos={logos} />}

      {/* Main content */}
      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title}>{title}</Text>

        {/* Subtitle */}
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

        {/* Presented to */}
        <Text style={styles.presentedTo}>
          This certificate is proudly presented to
        </Text>

        {/* Recipient name */}
        <Text style={[styles.recipientName, { fontSize: nameFontSize }]}>
          {recipientName}
        </Text>

        {/* Name underline */}
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

      {/* Wave layers at the bottom - layered effect */}
      <View style={styles.waveLayer1} />
      <View style={styles.waveLayer2} />
      <View style={styles.waveLayer3} />
    </Certificate>
  )
}
