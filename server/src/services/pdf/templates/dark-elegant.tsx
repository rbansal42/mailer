import React from 'react'
import { View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { Certificate, LogoBar } from '../components'
// Note: Not using shared Signatories component because dark theme requires
// custom light-colored text styling (Issue #25 will address this with style props)
import { colors, typography, getNameFontSize } from '../styles'
import type { BaseTemplateProps, Signatory } from './types'

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
  signatories: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 60,
    marginTop: 'auto',
    paddingTop: 15,
    paddingBottom: 20,
    flexShrink: 0,
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
    backgroundColor: colors.gold,
    marginBottom: 8,
  },
  sigName: {
    ...typography.signature.name,
    color: colors.white,
  },
  sigTitle: {
    ...typography.signature.title,
    color: colors.muted,
  },
  sigOrg: {
    ...typography.signature.org,
    color: colors.muted,
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

          {/* Signatories - custom styled for dark theme */}
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

        {/* Certificate ID */}
        {certificateId && (
          <Text style={styles.certificateId}>ID: {certificateId}</Text>
        )}
      </View>
    </Certificate>
  )
}
