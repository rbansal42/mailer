import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithCustomToken,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'

interface User {
  id: string
  email: string
  name: string
  isAdmin: boolean
  avatarUrl: string | null
}

interface AuthState {
  user: User | null
  firebaseUser: FirebaseUser | null
  isAuthenticated: boolean
  isLoading: boolean
  impersonating: User | null
  
  initialize: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  resendVerification: () => Promise<void>
  fetchUser: () => Promise<void>
  startImpersonation: (userId: string) => Promise<void>
  stopImpersonation: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      firebaseUser: null,
      isAuthenticated: false,
      isLoading: true,
      impersonating: null,

      initialize: async () => {
        return new Promise((resolve) => {
          const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser && firebaseUser.emailVerified) {
              set({ firebaseUser, isLoading: false })
              await get().fetchUser()
              set({ isAuthenticated: true })
            } else {
              set({ 
                user: null, 
                firebaseUser, 
                isAuthenticated: false, 
                isLoading: false 
              })
            }
            unsubscribe()
            resolve()
          })
        })
      },

      login: async (email, password) => {
        const result = await signInWithEmailAndPassword(auth, email, password)
        if (!result.user.emailVerified) {
          throw new Error('EMAIL_NOT_VERIFIED')
        }
        set({ firebaseUser: result.user })
        await get().fetchUser()
        set({ isAuthenticated: true })
      },

      register: async (email, password, name) => {
        const result = await createUserWithEmailAndPassword(auth, email, password)
        
        // Set the display name in Firebase
        await updateProfile(result.user, { displayName: name })
        
        await sendEmailVerification(result.user)
        set({ firebaseUser: result.user, isAuthenticated: false })
      },

      loginWithGoogle: async () => {
        const result = await signInWithPopup(auth, googleProvider)
        // Google accounts should always be verified, but check anyway
        if (!result.user.emailVerified) {
          throw new Error('EMAIL_NOT_VERIFIED')
        }
        set({ firebaseUser: result.user })
        await get().fetchUser()
        set({ isAuthenticated: true })
      },

      logout: async () => {
        await signOut(auth)
        set({ 
          user: null, 
          firebaseUser: null, 
          isAuthenticated: false,
          impersonating: null
        })
      },

      resetPassword: async (email) => {
        await sendPasswordResetEmail(auth, email)
      },

      resendVerification: async () => {
        const { firebaseUser } = get()
        if (firebaseUser) {
          await sendEmailVerification(firebaseUser)
        }
      },

      fetchUser: async () => {
        const { firebaseUser, logout } = get()
        if (!firebaseUser) return

        try {
          const token = await firebaseUser.getIdToken()
          const response = await fetch('/api/users/me', {
            headers: { Authorization: `Bearer ${token}` }
          })
          
          if (!response.ok) {
            console.error('Failed to fetch user, logging out')
            await logout()
            return
          }
          
          const user = await response.json()
          set({ user })
        } catch (error) {
          console.error('Failed to fetch user:', error)
          await logout()
        }
      },

      startImpersonation: async (userId: string) => {
        const { firebaseUser, user } = get()
        if (!firebaseUser || !user) throw new Error('Not authenticated')

        const token = await firebaseUser.getIdToken()
        const response = await fetch(`/api/admin/users/${userId}/impersonate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to impersonate')
        }

        const { token: customToken } = await response.json()

        // Store original user before switching
        const originalUser = user
        set({ impersonating: originalUser })

        // Sign in with custom token
        await signInWithCustomToken(auth, customToken)
        await get().fetchUser()
      },

      stopImpersonation: async () => {
        // Sign out and clear impersonation state
        // User will need to log back in as themselves
        await get().logout()
      }
    }),
    {
      name: 'mailer-auth',
      partialize: () => ({})  // Don't persist anything
    }
  )
)
