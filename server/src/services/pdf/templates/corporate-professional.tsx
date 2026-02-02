import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { Certificate, LogoBar, Signatories } from '../components'
import { typography, getNameFontSize } from '../styles'

interface CorporateProfessionalProps {
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

// Corporate color palette
const corporateColors = {
  primary: '#1e40af',    // Corporate blue
  secondary: '#374151',  // Gray
  accent: '#1e40af',     // Matches primary
  background: '#ffffff', // White
  muted: '#6b7280',      // Gray 500
  border: '#d1d5db',     // Gray 300
}

const styles = StyleSheet.create({
  // Top accent bar
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: corporateColors.primary,
  },
  // Main container with padding to account for accent bar
  container: {
    flex: 1,
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 20,
    display: 'flex',
    flexDirection: 'column',
  },
  // Logo section - prominent top-center placement
  logoSection: {
    alignItems: 'center',
    marginBottom: 25,
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
  // Title - clean sans-serif
  title: {
    fontFamily: 'Montserrat',
    fontSize: 36,
    fontWeight: 'bold',
    color: corporateColors.primary,
    textAlign: 'center',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  // Gray horizontal rule under title
  titleRule: {
    width: 120,
    height: 2,
    backgroundColor: corporateColors.secondary,
    marginBottom: 15,
  },
  // Subtitle
  subtitle: {
    ...typography.subtitle,
    fontFamily: 'Montserrat',
    color: corporateColors.secondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  // Presented to - professional tone
  presentedTo: {
    fontFamily: 'Montserrat',
    fontSize: 11,
    color: corporateColors.muted,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 15,
  },
  // Recipient name - clean sans-serif instead of script
  recipientName: {
    fontFamily: 'Montserrat',
    fontWeight: 'bold',
    color: corporateColors.primary,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  // Subtle underline for name
  nameUnderline: {
    width: 200,
    height: 1,
    backgroundColor: corporateColors.border,
    marginBottom: 25,
  },
  // Description
  description: {
    ...typography.body,
    fontFamily: 'Montserrat',
    color: corporateColors.secondary,
    textAlign: 'center',
    maxWidth: '75%',
    marginTop: 10,
    marginBottom: 20,
    lineHeight: 1.7,
    flexShrink: 1,
  },
  // Two-column signatories container
  signatoriesContainer: {
    marginTop: 'auto',
    paddingTop: 20,
    flexShrink: 0,
    width: '100%',
  },
  // Footer with certificate ID and date
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: corporateColors.border,
  },
  footerText: {
    fontFamily: 'Montserrat',
    fontSize: 8,
    color: corporateColors.muted,
  },
})

export const CorporateProfessional: React.FC<CorporateProfessionalProps> = ({
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
    <Certificate>
      {/* Top accent bar */}
      <View style={styles.accentBar} />

      <View style={styles.container}>
        {/* Logo prominently placed top-center */}
        {logos && logos.length > 0 && (
          <View style={styles.logoSection}>
            <LogoBar logos={logos} />
          </View>
        )}

        {/* Main content */}
        <View style={styles.content}>
          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Gray horizontal rule under title */}
          <View style={styles.titleRule} />

          {/* Subtitle */}
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

          {/* Presented to */}
          <Text style={styles.presentedTo}>This certifies that</Text>

          {/* Recipient name - sans-serif for corporate look */}
          <Text style={[styles.recipientName, { fontSize: nameFontSize }]}>
            {recipientName}
          </Text>

          {/* Subtle underline */}
          <View style={styles.nameUnderline} />

          {/* Description */}
          <Text style={styles.description}>{description}</Text>

          {/* Two-column signatories */}
          {signatories && signatories.length > 0 && (
            <View style={styles.signatoriesContainer}>
              <Signatories signatories={signatories} />
            </View>
          )}
        </View>

        {/* Clean footer with certificate ID */}
        {certificateId && (
          <View style={styles.footer}>
            <Text style={styles.footerText}>Certificate ID: {certificateId}</Text>
          </View>
        )}
      </View>
    </Certificate>
  )
}
