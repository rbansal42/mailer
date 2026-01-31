import React from 'react'
import { View, Image } from '@react-pdf/renderer'
import { baseStyles } from '../styles'

interface Logo {
  url: string
  width?: number
}

interface LogoBarProps {
  logos: Logo[]
}

export const LogoBar: React.FC<LogoBarProps> = ({ logos }) => {
  if (!logos || logos.length === 0) return null
  
  return (
    <View style={baseStyles.logoBar}>
      {logos.map((logo, index) => (
        <Image
          key={index}
          src={logo.url}
          style={{
            ...baseStyles.logo,
            width: logo.width || 'auto',
          }}
        />
      ))}
    </View>
  )
}
