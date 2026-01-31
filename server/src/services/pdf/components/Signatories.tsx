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
}

export const Signatories: React.FC<SignatoriesProps> = ({ signatories }) => {
  if (!signatories || signatories.length === 0) return null
  
  return (
    <View style={baseStyles.signatories}>
      {signatories.map((sig, index) => (
        <View key={index} style={baseStyles.signatory}>
          {sig.signatureUrl && (
            <Image src={sig.signatureUrl} style={baseStyles.signatureImage} />
          )}
          <View style={baseStyles.signatureLine} />
          <Text style={baseStyles.sigName}>{sig.name}</Text>
          <Text style={baseStyles.sigTitle}>{sig.designation}</Text>
          {sig.organization && (
            <Text style={baseStyles.sigOrg}>{sig.organization}</Text>
          )}
        </View>
      ))}
    </View>
  )
}
