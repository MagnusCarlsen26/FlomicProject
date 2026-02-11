import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { ApiError, loginWithGoogleToken } from '../services/api'

const GOOGLE_SCRIPT_ID = 'google-identity-services'
const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

function getErrorMessage(error) {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Unable to sign in with Google'
}

export default function LoginPage() {
  const location = useLocation()
  const { error, refreshSession } = useAuth()
  const fromPath = location.state?.from?.pathname

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const googleButtonRef = useRef(null)

  const [googleReady, setGoogleReady] = useState(false)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [signInError, setSignInError] = useState(null)

  const handleCredentialResponse = useCallback(
    async (response) => {
      const idToken = response?.credential

      if (!idToken) {
        setSignInError('Google did not return an ID token')
        return
      }

      setIsSigningIn(true)
      setSignInError(null)

      try {
        await loginWithGoogleToken(idToken)
        await refreshSession()
      } catch (e) {
        setSignInError(getErrorMessage(e))
      } finally {
        setIsSigningIn(false)
      }
    },
    [refreshSession],
  )

  const renderGoogleButton = useCallback(() => {
    if (!googleClientId || !googleButtonRef.current || !window.google?.accounts?.id) {
      return
    }

    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleCredentialResponse,
      auto_select: false,
    })

    googleButtonRef.current.innerHTML = ''
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      width: 320,
    })

    setGoogleReady(true)
  }, [googleClientId, handleCredentialResponse])

  useEffect(() => {
    if (!googleClientId) {
      setGoogleReady(false)
      setSignInError('VITE_GOOGLE_CLIENT_ID is not configured')
      return
    }

    let cancelled = false

    const onScriptReady = () => {
      if (cancelled) {
        return
      }

      try {
        renderGoogleButton()
        setSignInError(null)
      } catch (e) {
        setSignInError(getErrorMessage(e))
      }
    }

    const onScriptError = () => {
      if (!cancelled) {
        setSignInError('Failed to load Google Identity Services script')
      }
    }

    let script = document.getElementById(GOOGLE_SCRIPT_ID)

    if (!script) {
      script = document.createElement('script')
      script.id = GOOGLE_SCRIPT_ID
      script.src = GOOGLE_SCRIPT_SRC
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }

    script.addEventListener('load', onScriptReady)
    script.addEventListener('error', onScriptError)

    if (window.google?.accounts?.id) {
      onScriptReady()
    }

    return () => {
      cancelled = true
      script.removeEventListener('load', onScriptReady)
      script.removeEventListener('error', onScriptError)
    }
  }, [googleClientId, renderGoogleButton])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-white px-4 py-12">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Flomic</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Sign in</h1>
        <p className="mt-2 text-sm text-slate-600">
          Use your Google account. New sign-ins are created as <span className="font-medium">salesman</span>
          .
        </p>

        {fromPath && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            You need to sign in to access <span className="font-medium">{fromPath}</span>.
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            Session check error: {error}
          </div>
        )}

        {signInError && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {signInError}
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <div ref={googleButtonRef} />
        </div>

        {!googleReady && googleClientId && (
          <p className="mt-3 text-center text-sm text-slate-500">Loading Google sign-in...</p>
        )}

        {isSigningIn && (
          <p className="mt-3 text-center text-sm text-slate-600">Completing sign-in...</p>
        )}

        <button
          type="button"
          onClick={refreshSession}
          className="mt-6 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
        >
          Retry session check
        </button>
      </div>
    </div>
  )
}
