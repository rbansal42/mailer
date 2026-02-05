import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : null

if (getApps().length === 0 && serviceAccount) {
  initializeApp({
    credential: cert(serviceAccount)
  })
}

export const firebaseAuth = serviceAccount ? getAuth() : null

export function isFirebaseConfigured(): boolean {
  return firebaseAuth !== null
}
