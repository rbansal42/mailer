import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { Certificate, LogoBar, Signatories } from '../components'
import { colors, typography, getNameFontSize } from '../styles'
import type { BaseTemplateProps } from './types'

type DarkElegantProps = BaseTemplateProps

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  innerBorder: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
    borderWidth: 1,
    borderColor: colors.gold,
    borderStyle: 'dashed',
  },
  cornerTopLeft: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 30,
    height: 30,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: colors.gold,
  },
  cornerTopRight: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.gold,
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    width: 30,
    height: 30,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: colors.gold,
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 30,
    height: 30,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.gold,
  },
  content: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 30,
    paddingHorizontal: 40,
    zIndex: 1,
    overflow: 'hidden',
  },
  title: {
    ...typography.title,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    ...typography.subtitle,
    color: colors.white,
    textAlign: 'center',
    marginBottom: 15,
  },
  presentedTo: {
    ...typography.presentedTo,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 15,
  },
  recipientName: {
    ...typography.recipientName,
    color: colors.white,
    textAlign: 'center',
    marginVertical: 12,
  },
  nameUnderline: {
    width: 220,
    height: 2,
    backgroundColor: colors.gold,
    marginBottom: 20,
  },
  description: {
    ...typography.body,
    color: colors.white,
    textAlign: 'center',
    maxWidth: 500,
    marginVertical: 10,
    opacity: 0.9,
    flexShrink: 1,
  },
  certificateId: {
    position: 'absolute',
    bottom: 28,
    right: 45,
    fontSize: 8,
    color: colors.muted,
  },
})

export const DarkElegant: React.FC<DarkElegantProps> = ({
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
    <Certificate backgroundColor={colors.dark}>
      <View style={styles.container}>
        {/* Dashed inner border */}
        <View style={styles.innerBorder} />

        {/* Gold corner accents */}
        <View style={styles.cornerTopLeft} />
        <View style={styles.cornerTopRight} />
        <View style={styles.cornerBottomLeft} />
        <View style={styles.cornerBottomRight} />

        {/* Main content */}
        <View style={styles.content}>
          {/* Logo bar */}
          {logos && logos.length > 0 && <LogoBar logos={logos} />}

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Subtitle */}
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

          {/* Presented to text */}
          <Text style={styles.presentedTo}>
            This certificate is proudly presented to
          </Text>

          {/* Recipient name */}
          <Text style={[styles.recipientName, { fontSize: nameFontSize }]}>
            {recipientName}
          </Text>

          {/* Gold underline */}
          <View style={styles.nameUnderline} />

          {/* Description */}
          <Text style={styles.description}>{description}</Text>

          {/* Signatories */}
          <Signatories
            signatories={signatories}
            colors={{
              name: colors.white,
              title: colors.muted,
              org: colors.muted,
              line: colors.gold,
            }}
          />
        </View>

        {/* Certificate ID */}
        {certificateId && (
          <Text style={styles.certificateId}>ID: {certificateId}</Text>
        )}
      </View>
    </Certificate>
  )
}
