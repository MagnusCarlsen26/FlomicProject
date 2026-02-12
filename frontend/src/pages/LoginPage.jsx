import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import PageEnter from '../components/motion/PageEnter'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import GlassCard from '../components/ui/GlassCard'
import { useAuth } from '../context/useAuth'
import { useTheme } from '../context/useTheme'
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
  const { resolvedTheme } = useTheme()
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
      theme: resolvedTheme === 'dark' ? 'filled_black' : 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      width: 320,
    })

    setGoogleReady(true)
  }, [googleClientId, handleCredentialResponse, resolvedTheme])

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
    <div className="relative flex min-h-screen items-center px-4 py-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <PageEnter className="glass-card relative hidden overflow-hidden rounded-[2rem] p-9 lg:block">
          <div className="absolute -right-16 -top-10 h-44 w-44 rounded-full bg-primary/30 blur-3xl" />
          <div className="absolute -bottom-20 left-6 h-52 w-52 rounded-full bg-secondary/30 blur-3xl" />
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-text-secondary">Flomic Sales Command</p>
          <h1 className="mt-5 max-w-md text-4xl font-bold text-text-primary">Weekly planning and performance in one workspace.</h1>
          <p className="mt-4 max-w-lg text-base text-text-secondary">
            Use your Google account to securely access your role dashboard. New sign-ins are provisioned as salesman by
            default.
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface/70 p-4">
              <p className="text-xs uppercase tracking-wide text-text-muted">Live sync</p>
              <p className="mt-1 text-sm text-text-secondary">Admin dashboards refresh automatically while visible.</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface/70 p-4">
              <p className="text-xs uppercase tracking-wide text-text-muted">Role aware</p>
              <p className="mt-1 text-sm text-text-secondary">Routing remains tied to your authenticated role.</p>
            </div>
          </div>
        </PageEnter>

        <PageEnter>
          <GlassCard className="mx-auto w-full max-w-lg rounded-[2rem] p-7 md:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Welcome</p>
            <h2 className="mt-2 text-3xl font-bold text-text-primary">Sign in to continue</h2>
            <p className="mt-2 text-sm text-text-secondary">Use your Google account and continue to your assigned workspace.</p>

            <div className="mt-5 space-y-3">
              {fromPath ? (
                <Alert tone="warning">You need to sign in to access <span className="font-semibold">{fromPath}</span>.</Alert>
              ) : null}
              {error ? <Alert tone="error">Session check error: {error}</Alert> : null}
              {signInError ? <Alert tone="error">{signInError}</Alert> : null}
            </div>

            <div className="mt-6 flex min-h-[54px] justify-center">
              <div ref={googleButtonRef} />
            </div>

            {!googleReady && googleClientId ? (
              <p className="mt-3 text-center text-sm text-text-secondary">Loading Google sign-in...</p>
            ) : null}

            {isSigningIn ? <p className="mt-3 text-center text-sm text-text-secondary">Completing sign-in...</p> : null}

            <Button className="mt-6 w-full" variant="secondary" onClick={refreshSession}>
              Retry session check
            </Button>
          </GlassCard>
        </PageEnter>
      </div>
    </div>
  )
}
