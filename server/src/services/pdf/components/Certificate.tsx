import React from 'react'
import { Document, Page, View, Text, Styles } from '@react-pdf/renderer'
import { StyleSheet } from '@react-pdf/renderer'
import { colors } from '../styles'

// Import fonts to ensure they're registered
import '../fonts'

interface CertificateProps {
  children: React.ReactNode
  backgroundColor?: string
  certificateId?: string
  style?: Styles[string]
}

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    fontFamily: 'Montserrat',
    padding: 0,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    padding: 40,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    maxHeight: '100%',
  },
  certificateId: {
    position: 'absolute',
    bottom: 20,
    right: 30,
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
        <View style={style ? [styles.container, { backgroundColor }, style] : [styles.container, { backgroundColor }]}>
          {children}
          {certificateId && (
            <Text style={styles.certificateId}>ID: {certificateId}</Text>
          )}
        </View>
      </Page>
    </Document>
  )
}
