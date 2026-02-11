import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { getCurrentUser, logoutSession } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading')
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)

  const refreshSession = useCallback(async () => {
    setStatus('loading')
    setError(null)

    try {
      const sessionUser = await getCurrentUser()
      if (sessionUser) {
        setUser(sessionUser)
        setStatus('authenticated')
      } else {
        setUser(null)
        setStatus('unauthenticated')
      }
    } catch (e) {
      setUser(null)
      setStatus('unauthenticated')
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      await logoutSession()
    } finally {
      setUser(null)
      setStatus('unauthenticated')
    }
  }, [])

  useEffect(() => {
    refreshSession()
  }, [refreshSession])

  const value = useMemo(
    () => ({
      status,
      user,
      error,
      isAuthenticated: status === 'authenticated' && Boolean(user),
      refreshSession,
      signOut,
    }),
    [status, user, error, refreshSession, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export { AuthContext }
