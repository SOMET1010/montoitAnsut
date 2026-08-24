import { create } from "zustand"
import { persist } from "zustand/middleware"
import { apiFetch } from "@/lib/capacitor"

export type AuthMethod = "email" | "sms"

export type AppView =
    | "home"
    | "nos-biens"
    | "a-propos"
    | "faq"
    | "nous-contacter"
    | "cgu"
    | "confidentialite"
    | "mentions-legales"
    | "cookies"
    | "login"
    | "register"
    | "otp-verify"
    | "email-verify"
    | "forgot-password"
    | "dashboard"
    | "property-detail"

export interface SearchParams {
    query: string
    city: string
    commune: string
    propertyType: string
}

export type OtpPurpose = "login" | "email_verify" | "password_reset" | "phone_verify"

export interface AuthUser {
    id: string
    phone: string | null
    email: string | null
    firstName: string
    lastName: string
    role: "LOCATAIRE" | "PROPRIETAIRE" | "AGENCE" | "ADMIN" | "TIERS_CONFIANCE"
    activeRole:
        | "LOCATAIRE"
        | "PROPRIETAIRE"
        | "AGENCE"
        | "ADMIN"
        | "TIERS_CONFIANCE"
    avatarUrl: string | null
    isActive: boolean
    isEmailVerified: boolean
    isPhoneVerified?: boolean
    companyName?: string | null
    city?: string | null
    address?: string | null
    twoFactorEnabled?: boolean
    passwordUpdatedAt?: string | null
    gender?: string | null
}

export interface VerifyEmailOtpResult {
    valid?: boolean
    needsRegistration?: boolean
    requiresLogin?: boolean
    email?: string
    user?: AuthUser
}

// State that persists across page refreshes via localStorage
interface PersistedAuthState {
    user: AuthUser | null
    isAuthenticated: boolean
    currentView: AppView
    previousView: AppView
    dashboardSection: string
    selectedPropertyId: string
    selectedItemId: string // ID for detail views (payment, application, visit, lease)
    lastAuthenticatedAt: number | null // timestamp of last successful auth
    searchParams: SearchParams // search parameters passed from hero to nos-biens
    onboardingCompleted: boolean // whether the post-registration onboarding has been shown
}

// Transient state that does NOT persist
interface TransientAuthState {
    isLoading: boolean
    isInitialized: boolean
    pendingPhone: string
    pendingEmail: string
    pendingRole: string
    authMethod: AuthMethod
    devCode: string
    otpPurpose: OtpPurpose
    pendingMessage: string
    settingsDefaultTab: string
    dossierValidationFilter: string
}

interface AuthActions {
    loginWithEmail: (email: string, password: string) => Promise<void>
    loginWithSms: (phone: string) => Promise<void>
    verifySmsOtp: (phone: string, code: string) => Promise<void>
    sendPhoneOtp: (phone: string) => Promise<void>
    verifyPhoneOtp: (phone: string, code: string) => Promise<{ verified: boolean; message: string } | undefined>
    sendEmailOtp: (email: string, purpose: OtpPurpose) => Promise<void>
    verifyEmailOtp: (
        email: string,
        code: string,
        purpose: OtpPurpose
    ) => Promise<VerifyEmailOtpResult | undefined>
    registerWithEmail: (data: {
        email: string
        password: string
        firstName: string
        lastName: string
        phone?: string
        role?: string
    }) => Promise<void>
    registerWithSms: (data: {
        phone: string
        firstName: string
        lastName: string
        email?: string
        role?: string
    }) => Promise<void>
    forgotPassword: (
        identifier: string,
        method: "email" | "sms"
    ) => Promise<void>
    resetPassword: (data: {
        email?: string
        phone?: string
        code: string
        newPassword: string
    }) => Promise<void>
    logout: () => Promise<void>
    setView: (view: AppView, fromPopState?: boolean) => void
    setAuthMethod: (method: AuthMethod) => void
    setOtpPurpose: (purpose: OtpPurpose) => void
    setPendingRole: (role: string) => void
    setDashboardSection: (section: string, fromPopState?: boolean) => void
    setSelectedPropertyId: (id: string) => void
    setSelectedItemId: (id: string) => void
    setSearchParams: (params: SearchParams) => void
    setSettingsDefaultTab: (tab: string) => void
    setDossierValidationFilter: (filter: string) => void
    updateUser: (partial: Partial<AuthUser>) => void
    setOnboardingCompleted: (completed: boolean) => void
    switchRole: (newRole: AuthUser["role"], password: string) => Promise<void>
    checkAuth: () => Promise<void>
    seedData: () => Promise<void>
}

type AuthState = PersistedAuthState & TransientAuthState & AuthActions

const defaultPersisted: PersistedAuthState = {
    user: null,
    isAuthenticated: false,
    currentView: "home",
    previousView: "home",
    dashboardSection: "overview",
    selectedPropertyId: "",
    selectedItemId: "",
    lastAuthenticatedAt: null,
    searchParams: { query: "", city: "", commune: "", propertyType: "" },
    onboardingCompleted: false,
}

const defaultTransient: TransientAuthState = {
    isLoading: false,
    isInitialized: false,
    pendingPhone: "",
    pendingEmail: "",
    pendingRole: "",
    authMethod: "email",
    devCode: "",
    otpPurpose: "login",
    pendingMessage: "",
    settingsDefaultTab: "",
    dossierValidationFilter: "all",
}

// ─── checkAuth deduplication guard ──────────────────────────────────────────
let checkAuthPromise: Promise<void> | null = null

// ─── Session heartbeat interval ────────────────────────────────────────────
const SESSION_HEARTBEAT_INTERVAL = 10 * 60 * 1000 // 10 minutes
let heartbeatTimer: ReturnType<typeof setInterval> | null = null

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            ...defaultPersisted,
            ...defaultTransient,

            loginWithEmail: async (email: string, password: string) => {
                set({ isLoading: true })
                try {
                    const res = await apiFetch("/api/auth/login", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ email, password }),
                    })
                    const data = await res.json()

                    // Handle unverified email — redirect to email verification
                    if (res.status === 403 && data.needsVerification) {
                        set({
                            isLoading: false,
                            pendingEmail: data.email || email,
                            otpPurpose: "email_verify",
                            currentView: "email-verify",
                            devCode: data.devCode || "",
                        })
                        throw new Error(data.error)
                    }

                    if (!res.ok)
                        throw new Error(
                            data.error || "Email ou mot de passe incorrect"
                        )

                    set({
                        user: data.user,
                        isAuthenticated: true,
                        isLoading: false,
                        currentView: "dashboard",
                        lastAuthenticatedAt: Date.now(),
                    })
                    startHeartbeat()
                } catch (error) {
                    set({ isLoading: false })
                    throw error
                }
            },

            loginWithSms: async (phone: string) => {
                set({
                    isLoading: true,
                    pendingPhone: phone,
                    otpPurpose: "login",
                })
                try {
                    const res = await apiFetch("/api/auth/send-sms-otp", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ phone, purpose: "login" }),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || "Erreur")

                    set({ isLoading: false, currentView: "otp-verify" })
                } catch (error) {
                    set({ isLoading: false })
                    throw error
                }
            },

            verifySmsOtp: async (phone: string, code: string) => {
                set({ isLoading: true })
                try {
                    const res = await apiFetch("/api/auth/verify-sms-otp", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ phone, code }),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || "Code invalide")

                    if (data.needsRegistration) {
                        set({
                            isLoading: false,
                            currentView: "register",
                            authMethod: "sms",
                        })
                        return
                    }

                    // SMS OTP verified → user is now authenticated
                    set({
                        user: data.user,
                        isAuthenticated: true,
                        isLoading: false,
                        currentView: "dashboard",
                        lastAuthenticatedAt: Date.now(),
                    })
                    startHeartbeat()
                } catch (error) {
                    set({ isLoading: false })
                    throw error
                }
            },

            sendPhoneOtp: async (phone: string) => {
      set({ isLoading: true, pendingPhone: phone, otpPurpose: 'phone_verify' })
      try {
        const res = await apiFetch('/api/auth/send-sms-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ phone, purpose: 'phone_verify' }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erreur')
        set({ isLoading: false })
      } catch (error) {
        set({ isLoading: false })
        throw error
      }
    },

    verifyPhoneOtp: async (phone: string, code: string) => {
      set({ isLoading: true })
      try {
        const res = await apiFetch('/api/auth/verify-phone-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ phone, code }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Code invalide')

        // Update user's isPhoneVerified in store
        set((state) => ({
          isLoading: false,
          user: state.user ? { ...state.user, isPhoneVerified: true } : state.user,
        }))
        return data
      } catch (error) {
        set({ isLoading: false })
        throw error
      }
    },

    sendEmailOtp: async (email: string, purpose: OtpPurpose) => {
                set({
                    isLoading: true,
                    pendingEmail: email,
                    otpPurpose: purpose,
                })
                try {
                    const res = await apiFetch("/api/auth/send-email-otp", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ email, purpose }),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || "Erreur")

                    set({ isLoading: false, currentView: "email-verify" })
                } catch (error) {
                    set({ isLoading: false })
                    throw error
                }
            },

            verifyEmailOtp: async (
                email: string,
                code: string,
                purpose: OtpPurpose
            ) => {
                set({ isLoading: true })
                try {
                    const res = await apiFetch("/api/auth/verify-email-otp", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ email, code, purpose }),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || "Code invalide")

                    if (purpose === "password_reset" && data.valid) {
                        set({ isLoading: false })
                        return data
                    }

                    if (data.needsRegistration) {
                        set({
                            isLoading: false,
                            currentView: "register",
                            authMethod: "email",
                        })
                        return data
                    }

                    if (purpose === "email_verify" && data.requiresLogin) {
                        set({
                            isLoading: false,
                            currentView: "login",
                            pendingEmail: email,
                            devCode: "",
                            pendingMessage:
                                "Votre adresse email a été vérifiée avec succès. Veuillez vous connecter.",
                        })
                        return data
                    }

                    // Email OTP verified → user is now authenticated
                    if (data.user) {
                        set({
                            user: data.user,
                            isAuthenticated: true,
                            isLoading: false,
                            currentView: "dashboard",
                            lastAuthenticatedAt: Date.now(),
                        })
                        startHeartbeat()
                    }

                    return data
                } catch (error) {
                    set({ isLoading: false })
                    throw error
                }
            },

            // ─── Registration: NO auto-login → must verify OTP first ──────────────
            registerWithEmail: async data => {
                set({ isLoading: true })
                try {
                    const res = await apiFetch("/api/auth/register", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ ...data, method: "email" }),
                    })
                    const result = await res.json()
                    if (!res.ok) {
                        if (
                            res.status === 400 &&
                            result.error?.includes("existe déjà")
                        ) {
                            set({
                                isLoading: false,
                                currentView: "login",
                                pendingEmail: data.email,
                                pendingMessage: result.error,
                            })
                            return
                        }
                        throw new Error(result.error || "Erreur")
                    }

                    // Do NOT set isAuthenticated — user must verify email OTP first
                    set({
                        user: result.user,
                        isLoading: false,
                        pendingEmail: data.email,
                        otpPurpose: "email_verify",
                        currentView: "email-verify",
                        devCode: result.devCode || "",
                    })
                } catch (error) {
                    set({ isLoading: false })
                    throw error
                }
            },

            registerWithSms: async data => {
                set({ isLoading: true })
                try {
                    const res = await apiFetch("/api/auth/register", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ ...data, method: "sms" }),
                    })
                    const result = await res.json()
                    if (!res.ok) throw new Error(result.error || "Erreur")

                    // Do NOT set isAuthenticated — user must verify SMS OTP first
                    set({
                        user: result.user,
                        isLoading: false,
                        pendingPhone: data.phone,
                        otpPurpose: "login",
                        currentView: "otp-verify",
                        devCode: result.devCode || "",
                    })
                } catch (error) {
                    set({ isLoading: false })
                    throw error
                }
            },

            forgotPassword: async (
                identifier: string,
                method: "email" | "sms"
            ) => {
                set({ isLoading: true })
                try {
                    const res = await apiFetch("/api/auth/forgot-password", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ identifier, method }),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || "Erreur")

                    if (method === "email") {
                        set({
                            isLoading: false,
                            pendingEmail: identifier,
                            otpPurpose: "password_reset",
                            currentView: "email-verify",
                        })
                    } else {
                        set({
                            isLoading: false,
                            pendingPhone: identifier,
                            otpPurpose: "password_reset",
                            currentView: "otp-verify",
                        })
                    }
                } catch (error) {
                    set({ isLoading: false })
                    throw error
                }
            },

            resetPassword: async (data: {
                email?: string
                phone?: string
                code: string
                newPassword: string
            }) => {
                set({ isLoading: true })
                try {
                    const res = await apiFetch("/api/auth/reset-password", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify(data),
                    })
                    const result = await res.json()
                    if (!res.ok) throw new Error(result.error || "Erreur")

                    set({ isLoading: false, currentView: "login" })
                } catch (error) {
                    set({ isLoading: false })
                    throw error
                }
            },

            logout: async () => {
                stopHeartbeat()
                try {
                    await apiFetch("/api/auth/logout", {
                        method: "POST",
                        credentials: "include",
                    })
                } finally {
                    set({
                        user: null,
                        isAuthenticated: false,
                        currentView: "home",
                        previousView: "home",
                        pendingPhone: "",
                        pendingEmail: "",
                        authMethod: "email",
                        otpPurpose: "login",
                        devCode: "",
                        dashboardSection: "overview",
                        selectedPropertyId: "",
                        selectedItemId: "",
                        lastAuthenticatedAt: null,
                        searchParams: {
                            query: "",
                            city: "",
                            commune: "",
                            propertyType: "",
                        },
                    })
                }
            },

            setView: (view: AppView, fromPopState?: boolean) => {
                if (typeof window !== 'undefined') {
                    window.scrollTo({ top: 0, behavior: 'auto' })
                    // Ne pas repousser un état quand on revient via popstate
                    if (!fromPopState) {
                        const state = useAuthStore.getState()
                        window.history.pushState({
                            view,
                            selectedPropertyId: view === 'property-detail' ? state.selectedPropertyId : undefined,
                            dashboardSection: view === 'dashboard' ? state.dashboardSection : undefined,
                        }, '')
                    }
                }
                set(state => ({
                    previousView: state.currentView,
                    currentView: view,
                }))
            },
            setAuthMethod: method => set({ authMethod: method }),
            setOtpPurpose: purpose => set({ otpPurpose: purpose }),
            setPendingRole: role => set({ pendingRole: role }),
            setDashboardSection: (section, fromPopState) => {
                if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' })
                if (!fromPopState && typeof window !== 'undefined') {
                    window.history.pushState({ dashboardSection: section }, '')
                }
                set({ dashboardSection: section })
            },
            setSelectedPropertyId: id => set({ selectedPropertyId: id }),
            setSelectedItemId: id => set({ selectedItemId: id }),
            setSearchParams: params => set({ searchParams: params }),
            setSettingsDefaultTab: tab => set({ settingsDefaultTab: tab }),
            setDossierValidationFilter: filter => set({ dossierValidationFilter: filter }),
            setOnboardingCompleted: completed => set({ onboardingCompleted: completed }),
            updateUser: partial =>
                set(state => ({
                    user: state.user
                        ? { ...state.user, ...partial }
                        : state.user,
                })),

            switchRole: async (newRole, password) => {
                set({ isLoading: true })
                try {
                    const res = await apiFetch("/api/user/switch-role", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ role: newRole, password }),
                    })
                    const data = await res.json()
                    if (!res.ok)
                        throw new Error(
                            data.error || "Erreur lors du changement de rôle"
                        )

                    set(state => ({
                        user: state.user
                            ? { ...state.user, activeRole: newRole }
                            : state.user,
                        isLoading: false,
                        dashboardSection: "overview", // Reset to overview when switching roles
                    }))
                } catch (error) {
                    set({ isLoading: false })
                    throw error
                }
            },

            checkAuth: async () => {
                // Deduplicate: if a checkAuth is already in progress, reuse that promise
                if (checkAuthPromise) return checkAuthPromise

                checkAuthPromise = (async () => {
                    try {
                        const res = await apiFetch("/api/auth/me", {
                            credentials: "include",
                        })

                        if (res.ok) {
                            const data = await res.json()
                            set({
                                user: data.user,
                                isAuthenticated: true,
                                isInitialized: true,
                                lastAuthenticatedAt: Date.now(),
                            })
                            startHeartbeat()
                        } else if (res.status === 401) {
                            // Server explicitly says not authenticated — session is truly expired
                            // Always reset navigation to home (not just when coming from dashboard)
                            set({
                                user: null,
                                isAuthenticated: false,
                                currentView: "home",
                                previousView: "home",
                                dashboardSection: "overview",
                                selectedPropertyId: "",
                                selectedItemId: "",
                                searchParams: {
                                    query: "",
                                    city: "",
                                    commune: "",
                                    propertyType: "",
                                },
                                isInitialized: true,
                                lastAuthenticatedAt: null,
                            })
                            stopHeartbeat()
                        } else {
                            // Server error (5xx) or other non-401 error — DO NOT clear auth state
                            // The session might still be valid; just mark as initialized
                            // Keep whatever was persisted in localStorage
                            console.warn(
                                `[checkAuth] Server returned ${res.status}, keeping current auth state`
                            )
                            set({ isInitialized: true })
                        }
                    } catch {
                        // Network error → don't clear the persisted state, just mark as initialized
                        // The persisted state might still be valid when connectivity returns
                        set({ isInitialized: true })
                    } finally {
                        checkAuthPromise = null
                    }
                })()

                return checkAuthPromise
            },

            seedData: async () => {
                try {
                    const res = await apiFetch("/api/seed", {
                        method: "POST",
                        credentials: "include",
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error)
                    return data
                } catch (error) {
                    console.error("Seed error:", error)
                    throw error
                }
            },
        }),
        {
            name: "montoit-auth",
            // Only persist these fields to localStorage
            partialize: state => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
                currentView: state.currentView,
                previousView: state.previousView,
                dashboardSection: state.dashboardSection,
                selectedPropertyId: state.selectedPropertyId,
                selectedItemId: state.selectedItemId,
                lastAuthenticatedAt: state.lastAuthenticatedAt,
                searchParams: state.searchParams,
                onboardingCompleted: state.onboardingCompleted,
            }),
            // After rehydration, merge with default transient state
            merge: (persistedState, currentState) => {
                const persisted = persistedState as Partial<AuthState>
                // Validate persisted auth state — if lastAuthenticatedAt is too old,
                // don't trust the persisted isAuthenticated flag
                const MAX_SESSION_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days (matches server session)
                const isSessionStillValid = persisted.lastAuthenticatedAt
                    ? Date.now() - persisted.lastAuthenticatedAt <
                      MAX_SESSION_AGE_MS
                    : false

                return {
                    ...currentState,
                    ...persisted,
                    // If persisted session is too old, clear auth
                    isAuthenticated: isSessionStillValid
                        ? (persisted.isAuthenticated ?? false)
                        : false,
                    user: isSessionStillValid ? (persisted.user ?? null) : null,
                    onboardingCompleted: isSessionStillValid
                        ? (persisted.onboardingCompleted ?? false)
                        : false,
                    // Always reset transient state on rehydration
                    isLoading: false,
                    isInitialized: false,
                    pendingPhone: "",
                    pendingEmail: "",
                    pendingRole: "",
                    authMethod: "email",
                    devCode: "",
                    otpPurpose: "login",
                }
            },
        }
    )
)

// ─── Session Heartbeat ──────────────────────────────────────────────────────
// Periodically calls /api/auth/me to keep the session alive (sliding refresh)
// and detect server-side session expiry

function startHeartbeat() {
    if (heartbeatTimer) return // Already running
    if (typeof window === "undefined") return

    heartbeatTimer = setInterval(async () => {
        const state = useAuthStore.getState()
        if (!state.isAuthenticated) {
            stopHeartbeat()
            return
        }
        try {
            const res = await apiFetch("/api/auth/me", {
                credentials: "include",
            })
            if (res.ok) {
                const data = await res.json()
                useAuthStore.setState({
                    user: data.user,
                    isAuthenticated: true,
                    lastAuthenticatedAt: Date.now(),
                })
            } else if (res.status === 401) {
                // Session silently expired — clear auth state but
                // DO NOT reset currentView or other navigation state.
                // The view will be reset gracefully on the next:
                //   - authFetch 401 → logout() (when user tries an API call)
                //   - AppLifecycleManager.runResumeLogic() (on app resume)
                //   - page.tsx checkAuth() (on full page reload)
                useAuthStore.setState({
                    user: null,
                    isAuthenticated: false,
                    lastAuthenticatedAt: null,
                })
                stopHeartbeat()
            }
            // Server error (5xx) or other — keep state, retry next interval
        } catch {
            // Network error — silently ignore, next interval will retry
        }
    }, SESSION_HEARTBEAT_INTERVAL)
}

function stopHeartbeat() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer)
        heartbeatTimer = null
    }
}

// Start heartbeat on store creation if already authenticated
if (typeof window !== "undefined") {
    const { isAuthenticated } = useAuthStore.getState()
    if (isAuthenticated) {
        startHeartbeat()
    }
}
