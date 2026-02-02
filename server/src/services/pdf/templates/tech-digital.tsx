import React from 'react'
import { View, Text, Image, StyleSheet, Svg, Line, Rect } from '@react-pdf/renderer'
import { Certificate, LogoBar } from '../components'
// Note: Not using shared Signatories component because dark theme requires
// custom light-colored text styling (same pattern as dark-elegant.tsx)
import { typography, getNameFontSize } from '../styles'

interface Signatory {
  name: string
  designation: string
  organization?: string
  signatureUrl?: string
}

interface TechDigitalProps {
  title: string
  subtitle?: string
  recipientName: string
  description: string
  logos?: Array<{ url: string; height?: number }>
  signatories?: Array<Signatory>
  certificateId?: string
}

// Tech-digital color palette
const techColors = {
  background: '#0f172a',   // Dark slate
  primary: '#22d3ee',      // Cyan
  secondary: '#94a3b8',    // Slate
  accent: '#10b981',       // Emerald green
  text: '#f1f5f9',         // Light slate
  muted: '#64748b',        // Muted slate
  gridLine: '#1e293b',     // Subtle grid color
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  // Grid pattern background
  gridContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Left bracket decoration
  leftBracket: {
    position: 'absolute',
    left: 25,
    top: '50%',
    marginTop: -60,
  },
  // Right bracket decoration
  rightBracket: {
    position: 'absolute',
    right: 25,
    top: '50%',
    marginTop: -60,
  },
  bracketText: {
    fontSize: 80,
    fontFamily: 'Courier',
    color: techColors.primary,
    opacity: 0.3,
  },
  // Main content
  content: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 80,
    paddingVertical: 20,
    zIndex: 1,
    overflow: 'hidden',
  },
  // Logo section
  logoSection: {
    marginBottom: 15,
  },
  // Title with tech styling
  title: {
    fontFamily: 'Montserrat',
    fontSize: 36,
    fontWeight: 'bold',
    color: techColors.primary,
    textAlign: 'center',
    letterSpacing: 6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  // Subtitle
  subtitle: {
    fontFamily: 'Montserrat',
    fontSize: 12,
    fontWeight: 600,
    color: techColors.secondary,
    textAlign: 'center',
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  // Tech-style divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    gap: 8,
  },
  dividerLine: {
    width: 60,
    height: 1,
    backgroundColor: techColors.primary,
    opacity: 0.5,
  },
  dividerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: techColors.accent,
  },
  // Presented to text
  presentedTo: {
    fontFamily: 'Montserrat',
    fontSize: 10,
    color: techColors.secondary,
    textAlign: 'center',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: 10,
  },
  // Recipient name - using script font on dark background
  recipientName: {
    fontFamily: 'GreatVibes',
    color: techColors.text,
    textAlign: 'center',
    marginVertical: 10,
  },
  // Cyan underline for name
  nameUnderline: {
    width: 200,
    height: 2,
    backgroundColor: techColors.primary,
    marginBottom: 15,
  },
  // Description
  description: {
    ...typography.body,
    color: techColors.secondary,
    textAlign: 'center',
    maxWidth: 480,
    marginVertical: 8,
    lineHeight: 1.5,
    flexShrink: 1,
  },
  // Signatories section
  signatories: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 50,
    marginTop: 'auto',
    paddingTop: 12,
    paddingBottom: 10,
    flexShrink: 0,
  },
  signatory: {
    alignItems: 'center',
    width: 130,
  },
  signatureImage: {
    height: 32,
    marginBottom: 4,
  },
  signatureLine: {
    width: 90,
    height: 1,
    backgroundColor: techColors.primary,
    marginBottom: 6,
  },
  sigName: {
    fontFamily: 'Montserrat',
    fontSize: 10,
    fontWeight: 'bold',
    color: techColors.text,
    textAlign: 'center',
  },
  sigTitle: {
    fontFamily: 'Montserrat',
    fontSize: 8,
    color: techColors.secondary,
    textAlign: 'center',
  },
  sigOrg: {
    fontFamily: 'Montserrat',
    fontSize: 7,
    color: techColors.muted,
    textAlign: 'center',
  },
  // Certificate ID with monospace styling
  certificateIdContainer: {
    position: 'absolute',
    bottom: 18,
    right: 35,
    flexDirection: 'row',
    alignItems: 'center',
  },
  certificateIdLabel: {
    fontFamily: 'Montserrat',
    fontSize: 7,
    color: techColors.muted,
    marginRight: 4,
  },
  certificateIdValue: {
    fontFamily: 'Courier',
    fontSize: 8,
    color: techColors.accent,
    letterSpacing: 1,
  },
  // Corner accent elements
  cornerTopLeft: {
    position: 'absolute',
    top: 15,
    left: 15,
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 15,
    right: 15,
  },
})

// Grid pattern component
const GridPattern: React.FC = () => (
  <View style={styles.gridContainer}>
    <Svg width="100%" height="100%" viewBox="0 0 842 595">
      {/* Horizontal grid lines */}
      {[...Array(12)].map((_, i) => (
        <Line
          key={`h-${i}`}
          x1="0"
          y1={50 + i * 50}
          x2="842"
          y2={50 + i * 50}
          stroke={techColors.gridLine}
          strokeWidth="0.5"
        />
      ))}
      {/* Vertical grid lines */}
      {[...Array(17)].map((_, i) => (
        <Line
          key={`v-${i}`}
          x1={50 + i * 50}
          y1="0"
          x2={50 + i * 50}
          y2="595"
          stroke={techColors.gridLine}
          strokeWidth="0.5"
        />
      ))}
    </Svg>
  </View>
)

// Corner accent component
const CornerAccent: React.FC<{ position: 'topLeft' | 'bottomRight' }> = ({ position }) => {
  const isTopLeft = position === 'topLeft'
  return (
    <View style={isTopLeft ? styles.cornerTopLeft : styles.cornerBottomRight}>
      <Svg width="40" height="40" viewBox="0 0 40 40">
        {isTopLeft ? (
          <>
            <Line x1="0" y1="0" x2="0" y2="25" stroke={techColors.primary} strokeWidth="2" />
            <Line x1="0" y1="0" x2="25" y2="0" stroke={techColors.primary} strokeWidth="2" />
            <Rect x="0" y="0" width="4" height="4" fill={techColors.accent} />
          </>
        ) : (
          <>
            <Line x1="40" y1="15" x2="40" y2="40" stroke={techColors.primary} strokeWidth="2" />
            <Line x1="15" y1="40" x2="40" y2="40" stroke={techColors.primary} strokeWidth="2" />
            <Rect x="36" y="36" width="4" height="4" fill={techColors.accent} />
          </>
        )}
      </Svg>
    </View>
  )
}

export const TechDigital: React.FC<TechDigitalProps> = ({
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
    <Certificate backgroundColor={techColors.background}>
      <View style={styles.container}>
        {/* Subtle grid pattern */}
        <GridPattern />

        {/* Corner accents */}
        <CornerAccent position="topLeft" />
        <CornerAccent position="bottomRight" />

        {/* Left code bracket */}
        <View style={styles.leftBracket}>
          <Text style={styles.bracketText}>{'{'}</Text>
        </View>

        {/* Right code bracket */}
        <View style={styles.rightBracket}>
          <Text style={styles.bracketText}>{'}'}</Text>
        </View>

        {/* Main content */}
        <View style={styles.content}>
          {/* Logo bar */}
          {logos && logos.length > 0 && (
            <View style={styles.logoSection}>
              <LogoBar logos={logos} />
            </View>
          )}

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Subtitle */}
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

          {/* Tech-style divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerDot} />
            <View style={styles.dividerLine} />
          </View>

          {/* Presented to */}
          <Text style={styles.presentedTo}>Awarded to</Text>

          {/* Recipient name */}
          <Text style={[styles.recipientName, { fontSize: nameFontSize }]}>
            {recipientName}
          </Text>

          {/* Cyan underline */}
          <View style={styles.nameUnderline} />

          {/* Description */}
          <Text style={styles.description}>{description}</Text>

          {/* Signatories */}
          {signatories && signatories.length > 0 && (
            <View style={styles.signatories}>
              {signatories.map((sig, index) => (
                <View key={index} style={styles.signatory}>
                  {sig.signatureUrl && (
                    <Image src={sig.signatureUrl} style={styles.signatureImage} />
                  )}
                  <View style={styles.signatureLine} />
                  <Text style={styles.sigName}>{sig.name}</Text>
                  <Text style={styles.sigTitle}>{sig.designation}</Text>
                  {sig.organization && (
                    <Text style={styles.sigOrg}>{sig.organization}</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Certificate ID with monospace styling */}
        {certificateId && (
          <View style={styles.certificateIdContainer}>
            <Text style={styles.certificateIdLabel}>ID:</Text>
            <Text style={styles.certificateIdValue}>{certificateId}</Text>
          </View>
        )}
      </View>
    </Certificate>
  )
}
