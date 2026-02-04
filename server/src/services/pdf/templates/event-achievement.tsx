import React from 'react'
import { View, Text, StyleSheet, Svg, Path, Circle, G } from '@react-pdf/renderer'
import { Certificate, LogoBar, Signatories } from '../components'
import { typography, getNameFontSize } from '../styles'
import type { BaseTemplateProps } from './types'

type EventAchievementProps = BaseTemplateProps

// Color palette for achievement/award style
const achievementColors = {
  primary: '#b45309', // Bronze/gold
  secondary: '#1f2937', // Dark gray
  accent: '#fbbf24', // Bright gold
  background: '#fffbeb', // Warm cream
  muted: '#78716c', // Stone gray
  white: '#ffffff',
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  // SVG ribbon/badge container at top
  ribbonContainer: {
    marginTop: 10,
    marginBottom: 15,
    alignItems: 'center',
  },
  // Header section
  headerSection: {
    alignItems: 'center',
    marginBottom: 10,
  },
  // Title - bold achievement style
  title: {
    fontFamily: 'Playfair',
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: 6,
    textTransform: 'uppercase',
    color: achievementColors.primary,
    textAlign: 'center',
    marginBottom: 5,
  },
  // Subtitle
  subtitle: {
    fontFamily: 'Montserrat',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: achievementColors.secondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  // Laurel divider container
  laurelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 15,
  },
  // Divider line between laurels
  dividerLine: {
    width: 60,
    height: 2,
    backgroundColor: achievementColors.accent,
    marginHorizontal: 10,
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
    paddingHorizontal: 40,
  },
  // Awarded to text
  awardedTo: {
    fontFamily: 'Montserrat',
    fontSize: 11,
    fontStyle: 'italic',
    color: achievementColors.muted,
    textAlign: 'center',
    marginTop: 10,
  },
  // Recipient name - prominent display
  recipientName: {
    fontFamily: 'GreatVibes',
    color: achievementColors.secondary,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  // Gold accent underline for name
  nameUnderline: {
    width: 220,
    height: 3,
    backgroundColor: achievementColors.accent,
    marginBottom: 20,
    borderRadius: 2,
  },
  // Achievement/event title emphasis
  achievementTitle: {
    fontFamily: 'Playfair',
    fontSize: 16,
    fontWeight: 'bold',
    color: achievementColors.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  // Description text
  description: {
    ...typography.body,
    color: achievementColors.secondary,
    textAlign: 'center',
    maxWidth: '80%',
    marginTop: 5,
    flexShrink: 1,
  },
  // Signatories container
  signatoriesContainer: {
    marginTop: 'auto',
    paddingTop: 15,
    flexShrink: 0,
  },
  // Logo section
  logoSection: {
    marginBottom: 10,
  },
  // Subtle watermark star container
  watermarkContainer: {
    position: 'absolute',
    top: '35%',
    left: 0,
    right: 0,
    alignItems: 'center',
    opacity: 0.03,
  },
  // Bottom decorative bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: achievementColors.primary,
  },
  // Gold accent line above bottom bar
  bottomAccent: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: achievementColors.accent,
  },
})

// SVG Ribbon/Badge component at top
const RibbonBadge: React.FC = () => (
  <Svg width={120} height={100} viewBox="0 0 120 100">
    {/* Ribbon tails */}
    <Path
      d="M25 55 L15 95 L35 80 L45 95 L40 55"
      fill={achievementColors.primary}
    />
    <Path
      d="M95 55 L105 95 L85 80 L75 95 L80 55"
      fill={achievementColors.primary}
    />
    {/* Ribbon tail highlights */}
    <Path
      d="M27 55 L20 85 L35 73 L42 85 L38 55"
      fill={achievementColors.accent}
      opacity={0.3}
    />
    <Path
      d="M93 55 L100 85 L85 73 L78 85 L82 55"
      fill={achievementColors.accent}
      opacity={0.3}
    />
    {/* Main badge circle - outer ring */}
    <Circle cx={60} cy={40} r={38} fill={achievementColors.primary} />
    {/* Badge circle - gold ring */}
    <Circle cx={60} cy={40} r={33} fill={achievementColors.accent} />
    {/* Badge circle - inner */}
    <Circle cx={60} cy={40} r={28} fill={achievementColors.background} />
    {/* Star in center */}
    <Path
      d="M60 18 L64 30 L77 30 L67 38 L71 51 L60 43 L49 51 L53 38 L43 30 L56 30 Z"
      fill={achievementColors.accent}
    />
    {/* Inner star highlight */}
    <Path
      d="M60 22 L63 31 L73 31 L65 37 L68 47 L60 41 L52 47 L55 37 L47 31 L57 31 Z"
      fill={achievementColors.primary}
    />
  </Svg>
)

// SVG Laurel branch (left)
const LaurelLeft: React.FC = () => (
  <Svg width={40} height={30} viewBox="0 0 40 30">
    <G>
      {/* Laurel leaves - left branch */}
      <Path
        d="M38 15 Q30 12 25 8 Q28 14 25 15 Q28 16 25 22 Q30 18 38 15"
        fill={achievementColors.accent}
      />
      <Path
        d="M30 15 Q22 10 18 5 Q20 12 17 15 Q20 18 18 25 Q22 20 30 15"
        fill={achievementColors.accent}
      />
      <Path
        d="M22 15 Q15 8 10 3 Q13 11 10 15 Q13 19 10 27 Q15 22 22 15"
        fill={achievementColors.accent}
      />
      {/* Stem */}
      <Path d="M38 15 L5 15" stroke={achievementColors.primary} strokeWidth={1.5} fill="none" />
    </G>
  </Svg>
)

// SVG Laurel branch (right - mirrored)
const LaurelRight: React.FC = () => (
  <Svg width={40} height={30} viewBox="0 0 40 30">
    <G>
      {/* Laurel leaves - right branch (mirrored) */}
      <Path
        d="M2 15 Q10 12 15 8 Q12 14 15 15 Q12 16 15 22 Q10 18 2 15"
        fill={achievementColors.accent}
      />
      <Path
        d="M10 15 Q18 10 22 5 Q20 12 23 15 Q20 18 22 25 Q18 20 10 15"
        fill={achievementColors.accent}
      />
      <Path
        d="M18 15 Q25 8 30 3 Q27 11 30 15 Q27 19 30 27 Q25 22 18 15"
        fill={achievementColors.accent}
      />
      {/* Stem */}
      <Path d="M2 15 L35 15" stroke={achievementColors.primary} strokeWidth={1.5} fill="none" />
    </G>
  </Svg>
)

// Large watermark star (subtle background element)
const WatermarkStar: React.FC = () => (
  <Svg width={300} height={300} viewBox="0 0 100 100">
    <Path
      d="M50 5 L58 35 L90 35 L65 55 L75 90 L50 70 L25 90 L35 55 L10 35 L42 35 Z"
      fill={achievementColors.primary}
    />
  </Svg>
)

export const EventAchievement: React.FC<EventAchievementProps> = ({
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
    <Certificate backgroundColor={achievementColors.background} certificateId={certificateId}>
      <View style={styles.container}>
        {/* Subtle watermark star in background */}
        <View style={styles.watermarkContainer}>
          <WatermarkStar />
        </View>

        {/* Logo bar at top */}
        {logos && logos.length > 0 && (
          <View style={styles.logoSection}>
            <LogoBar logos={logos} />
          </View>
        )}

        {/* Ribbon/Badge graphic */}
        <View style={styles.ribbonContainer}>
          <RibbonBadge />
        </View>

        {/* Header section */}
        <View style={styles.headerSection}>
          {/* Bold title */}
          <Text style={styles.title}>{title}</Text>

          {/* Subtitle */}
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        {/* Laurel decorative divider */}
        <View style={styles.laurelContainer}>
          <LaurelLeft />
          <View style={styles.dividerLine} />
          <LaurelRight />
        </View>

        {/* Main content */}
        <View style={styles.content}>
          {/* Awarded to */}
          <Text style={styles.awardedTo}>This award is presented to</Text>

          {/* Recipient name */}
          <Text style={[styles.recipientName, { fontSize: nameFontSize }]}>
            {recipientName}
          </Text>

          {/* Gold accent underline */}
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

      {/* Bottom decorative bars */}
      <View style={styles.bottomAccent} />
      <View style={styles.bottomBar} />
    </Certificate>
  )
}
