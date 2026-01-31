import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { StyleSheet } from '@react-pdf/renderer'
import { colors } from '../styles'

// Import fonts to ensure they're registered
import '../fonts'

interface CertificateProps {
  children: React.ReactNode
  backgroundColor?: string
  certificateId?: string
  style?: object
}

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    fontFamily: 'Montserrat',
    padding: 0,
  },
  container: {
    flex: 1,
    padding: 40,
    position: 'relative',
  },
  certificateId: {
    position: 'absolute',
    bottom: 25,
    right: 40,
    fontSize: 8,
    color: colors.muted,
  },
})

export const Certificate: React.FC<CertificateProps> = ({
  children,
  backgroundColor = colors.white,
  certificateId,
  style,
}) => {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={[styles.container, { backgroundColor }, style]}>
          {children}
          {certificateId && (
            <Text style={styles.certificateId}>ID: {certificateId}</Text>
          )}
        </View>
      </Page>
    </Document>
  )
}
