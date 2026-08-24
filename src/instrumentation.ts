import * as Sentry from '@sentry/nextjs'

// Server/edge-side error and performance monitoring. No-ops automatically
// when NEXT_PUBLIC_SENTRY_DSN is unset (e.g. local dev), so this is safe to
// ship without every environment having Sentry configured.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
    })
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
    })
  }
}

export const onRequestError = Sentry.captureRequestError
