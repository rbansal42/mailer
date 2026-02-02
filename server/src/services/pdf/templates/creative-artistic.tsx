import React from 'react'
import { View, Text, StyleSheet, Svg, Path } from '@react-pdf/renderer'
import { Certificate, LogoBar, Signatories } from '../components'
import { typography, getNameFontSize } from '../styles'
import type { BaseTemplateProps } from './types'

type CreativeArtisticProps = BaseTemplateProps

// Creative color palette
const creativeColors = {
  primary: '#7c3aed',    // Purple
  secondary: '#ec4899',  // Pink
  accent: '#f59e0b',     // Amber
  white: '#ffffff',
  text: '#1e293b',       // Dark slate for readability
  muted: '#64748b',      // Slate 500
}

const styles = StyleSheet.create({
  // Main container - asymmetric layout with left padding
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    paddingLeft: 60,
    paddingRight: 40,
    paddingTop: 30,
    paddingBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  // Abstract blob in top-right corner
  blobContainer: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 320,
    height: 320,
  },
  // Small accent circle bottom-left
  accentCircle: {
    position: 'absolute',
    bottom: 40,
    left: -30,
    width: 100,
    height: 100,
  },
  // Logo section - left aligned
  logoSection: {
    marginBottom: 15,
    alignItems: 'flex-start',
  },
  // Main content - left aligned, not centered
  content: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingRight: 120, // Leave space for blob
    overflow: 'hidden',
  },
  // Title - bold, playful
  title: {
    fontFamily: 'Playfair',
    fontSize: 38,
    fontWeight: 'bold',
    color: creativeColors.primary,
    letterSpacing: 2,
    marginBottom: 4,
  },
  // Subtitle - pink accent color
  subtitle: {
    fontFamily: 'Montserrat',
    fontSize: 14,
    fontWeight: 600,
    color: creativeColors.secondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  // Presented to - small, amber
  presentedTo: {
    fontFamily: 'Montserrat',
    fontSize: 10,
    fontWeight: 600,
    color: creativeColors.accent,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: 15,
  },
  // Recipient name - oversized, purple, script font
  recipientName: {
    fontFamily: 'GreatVibes',
    color: creativeColors.primary,
    marginTop: 8,
    marginBottom: 12,
  },
  // Accent bar under name - gradient effect using stacked bars
  accentBarContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  accentBar1: {
    width: 80,
    height: 4,
    backgroundColor: creativeColors.primary,
    marginRight: 4,
  },
  accentBar2: {
    width: 40,
    height: 4,
    backgroundColor: creativeColors.secondary,
    marginRight: 4,
  },
  accentBar3: {
    width: 20,
    height: 4,
    backgroundColor: creativeColors.accent,
  },
  // Description - left aligned
  description: {
    ...typography.body,
    color: creativeColors.text,
    textAlign: 'left',
    maxWidth: '90%',
    lineHeight: 1.7,
    flexShrink: 1,
  },
  // Signatories container
  signatoriesContainer: {
    marginTop: 'auto',
    paddingTop: 15,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
})

// Abstract blob SVG path - organic shape
const BlobShape: React.FC = () => (
  <Svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%' }}>
    {/* Main purple blob */}
    <Path
      d="M 100 20 
         C 140 20, 180 50, 180 100 
         C 180 150, 140 180, 100 180 
         C 60 180, 20 150, 20 100 
         C 20 50, 60 20, 100 20
         Q 120 40, 140 60
         Q 160 80, 150 110
         Q 140 140, 110 150
         Q 80 160, 60 140
         Q 40 120, 50 90
         Q 60 60, 100 20"
      fill={creativeColors.primary}
      opacity={0.15}
    />
    {/* Pink overlay blob */}
    <Path
      d="M 120 40 
         C 160 50, 170 90, 160 120 
         C 150 150, 120 160, 90 150 
         C 60 140, 50 110, 60 80 
         C 70 50, 100 30, 120 40"
      fill={creativeColors.secondary}
      opacity={0.2}
    />
    {/* Small amber accent */}
    <Path
      d="M 130 70 
         C 150 75, 155 95, 150 110 
         C 145 125, 125 130, 110 125 
         C 95 120, 90 100, 100 85 
         C 110 70, 120 65, 130 70"
      fill={creativeColors.accent}
      opacity={0.3}
    />
  </Svg>
)

// Small accent circle for bottom-left
const AccentCircle: React.FC = () => (
  <Svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
    <Path
      d="M 50 10 
         C 75 10, 90 35, 90 50 
         C 90 75, 65 90, 50 90 
         C 25 90, 10 65, 10 50 
         C 10 25, 35 10, 50 10"
      fill={creativeColors.secondary}
      opacity={0.1}
    />
  </Svg>
)

export const CreativeArtistic: React.FC<CreativeArtisticProps> = ({
  title,
  subtitle,
  recipientName,
  description,
  logos,
  signatories,
  certificateId,
}) => {
  // Oversized name - multiply base size by 1.2
  const baseFontSize = getNameFontSize(recipientName)
  const nameFontSize = Math.round(baseFontSize * 1.2)

  return (
    <Certificate certificateId={certificateId}>
      <View style={styles.container}>
        {/* Abstract blob in top-right corner */}
        <View style={styles.blobContainer}>
          <BlobShape />
        </View>

        {/* Small accent circle bottom-left */}
        <View style={styles.accentCircle}>
          <AccentCircle />
        </View>

        {/* Logo bar - left aligned */}
        {logos && logos.length > 0 && (
          <View style={styles.logoSection}>
            <LogoBar logos={logos} />
          </View>
        )}

        {/* Main content - asymmetric, left-aligned */}
        <View style={styles.content}>
          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Subtitle */}
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

          {/* Presented to */}
          <Text style={styles.presentedTo}>Awarded to</Text>

          {/* Recipient name - oversized */}
          <Text style={[styles.recipientName, { fontSize: nameFontSize }]}>
            {recipientName}
          </Text>

          {/* Colorful accent bars */}
          <View style={styles.accentBarContainer}>
            <View style={styles.accentBar1} />
            <View style={styles.accentBar2} />
            <View style={styles.accentBar3} />
          </View>

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
    </Certificate>
  )
}
