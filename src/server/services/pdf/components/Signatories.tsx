import React from 'react'
import { View, Text, Image } from '@react-pdf/renderer'
import { baseStyles } from '../styles'

interface Signatory {
  name: string
  designation: string
  organization?: string
  signatureUrl?: string
}

interface SignatoriesProps {
  signatories: Signatory[]
  colors?: {
    name?: string
    title?: string
    org?: string
    line?: string
  }
}

export const Signatories: React.FC<SignatoriesProps> = ({ signatories, colors }) => {
  if (!signatories || signatories.length === 0) return null
  
  return (
    <View style={baseStyles.signatories}>
      {signatories.map((sig, index) => (
        <View key={index} style={baseStyles.signatory}>
          {sig.signatureUrl && (
            <Image src={sig.signatureUrl} style={baseStyles.signatureImage} />
          )}
          <View style={colors?.line ? [baseStyles.signatureLine, { backgroundColor: colors.line }] : baseStyles.signatureLine} />
          <Text style={colors?.name ? [baseStyles.sigName, { color: colors.name }] : baseStyles.sigName}>{sig.name}</Text>
          <Text style={colors?.title ? [baseStyles.sigTitle, { color: colors.title }] : baseStyles.sigTitle}>{sig.designation}</Text>
          {sig.organization && (
            <Text style={colors?.org ? [baseStyles.sigOrg, { color: colors.org }] : baseStyles.sigOrg}>{sig.organization}</Text>
          )}
        </View>
      ))}
    </View>
  )
}
