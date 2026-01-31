import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { Certificate, LogoBar, Signatories } from '../components'
import { colors, typography, getNameFontSize } from '../styles'

interface ModernCleanProps {
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
  // Outer border container
  outerBorder: {
    flex: 1,
    border: `2px solid ${colors.primary}`,
    padding: 8,
  },
  // Inner border container
  innerBorder: {
    flex: 1,
    border: `1px solid ${colors.border}`,
    padding: 30,
    display: 'flex',
    flexDirection: 'column',
  },
  // Content area
  content: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
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
  // Signatories container
  signatoriesContainer: {
    marginTop: 'auto',
    paddingTop: 15,
    flexShrink: 0,
  },
  // Bottom accent bar
  accentBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: colors.accent,
  },
})

export const ModernClean: React.FC<ModernCleanProps> = ({
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
      {/* Outer border */}
      <View style={styles.outerBorder}>
        {/* Inner border */}
        <View style={styles.innerBorder}>
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
        </View>
      </View>

      {/* Accent bar at the very bottom */}
      <View style={styles.accentBar} />
    </Certificate>
  )
}
