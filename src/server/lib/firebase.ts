import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

/**
 * Firebase service account credentials parsed from environment variable.
 * Expected to be a JSON string containing the service account key.
 * @see {@link https://firebase.google.com/docs/admin/setup#initialize-sdk}
 */
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : null

// Initialize Firebase Admin SDK if service account is configured
if (getApps().length === 0 && serviceAccount) {
  initializeApp({
    credential: cert(serviceAccount)
  })
}

/**
 * Firebase Authentication instance for server-side operations.
 * Will be `null` if Firebase service account is not configured.
 * 
 * @example
 * ```typescript
 * import { firebaseAuth } from './lib/firebase'
 * 
 * if (firebaseAuth) {
 *   const user = await firebaseAuth.verifyIdToken(token)
 * }
 * ```
 */
export const firebaseAuth = serviceAccount ? getAuth() : null

/**
 * Checks whether Firebase authentication is properly configured.
 * 
 * @returns `true` if Firebase service account is configured and initialized, `false` otherwise
 * 
 * @example
 * ```typescript
 * if (!isFirebaseConfigured()) {
 *   return res.status(500).json({ error: 'Firebase not configured' })
 * }
 * ```
 */
export function isFirebaseConfigured(): boolean {
  return firebaseAuth !== null
}
