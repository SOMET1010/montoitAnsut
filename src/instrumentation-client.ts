import * as Sentry from '@sentry/nextjs'

// Client-side error and performance monitoring. No-ops automatically when
// NEXT_PUBLIC_SENTRY_DSN is unset, so local/staging environments without a
// DSN configured are unaffected.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
