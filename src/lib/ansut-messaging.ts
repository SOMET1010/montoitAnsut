/**
 * ANSUT Messaging Service
 * Handles SMS and Email sending via the ANSUT API (Côte d'Ivoire)
 * 
 * SMS:  POST {{baseUrl}}/api/SendSMS
 * Email: POST {{baseUrl}}/api/message/send (channel: "Email")
 */

// ─── Configuration ──────────────────────────────────────────────────────────────

const ANSUT_BASE_URL = process.env.ANSUT_API_BASE_URL || ''
const ANSUT_USERNAME = process.env.ANSUT_API_USERNAME || ''
const ANSUT_PASSWORD = process.env.ANSUT_API_PASSWORD || ''
const ANSUT_SMS_SENDER = process.env.ANSUT_SMS_SENDER || 'ANSUT'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface SendSmsParams {
  to: string           // Phone number(s) in format 225XXXXXXXXXX (semicolon-separated for multiple)
  text: string         // SMS message content
  dlrUrl?: string      // Optional delivery report URL
}

export interface SendEmailParams {
  to: string           // Email address(es)
  subject: string      // Email subject
  content: string      // Email content (HTML if isHtml=true)
  cc?: string          // Carbon copy (semicolon-separated)
  bcc?: string         // Blind carbon copy (semicolon-separated)
  isHtml?: boolean     // Whether content is HTML (default: true)
}

export interface MessagingResult {
  success: boolean
  message: string
  data?: unknown
}

// ─── Phone Number Formatting ────────────────────────────────────────────────────

/**
 * Format a phone number for the ANSUT API.
 * Accepts formats: +225XXXXXXXXXX, 225XXXXXXXXXX, 0XXXXXXXXXX, XXXXXXXXXX
 * Returns: 225XXXXXXXXXX (no + prefix)
 */
export function formatPhoneForAnsut(phone: string): string {
  // Remove all spaces and dashes
  let cleaned = phone.replace(/[\s\-]/g, '')
  
  // Remove + prefix
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1)
  }
  
  // If starts with 0 (local CI format), prepend 225
  if (cleaned.startsWith('0')) {
    cleaned = '225' + cleaned
  }
  
  // If doesn't start with 225, prepend it
  if (!cleaned.startsWith('225')) {
    cleaned = '225' + cleaned
  }
  
  return cleaned
}

/**
 * Normalize a phone number to a clean 10-digit format (CI).
 * Strips +225 or 225 prefix, keeps only digits.
 * Examples:
 *   "+2250140984943" → "0140984943"
 *   "2250140984943"  → "0140984943"
 *   "0140984943"     → "0140984943"
 */
export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('225') && cleaned.length > 10) {
    cleaned = cleaned.slice(3)
  }
  return cleaned
}

// ─── OTP Code Generation ────────────────────────────────────────────────────────

/**
 * Generate a random numeric OTP code of specified length
 */
export function generateOtpCode(length: number = 6): string {
  const digits = '0123456789'
  const array = new Uint8Array(length)
  globalThis.crypto.getRandomValues(array)
  let code = ''
  for (let i = 0; i < length; i++) {
    let randomIndex = array[i]
    while (randomIndex >= 250) {
      const fallback = new Uint8Array(1)
      globalThis.crypto.getRandomValues(fallback)
      randomIndex = fallback[0]
    }
    code += digits[randomIndex % 10]
  }
  return code
}

// ─── Resilient request helper ────────────────────────────────────────────────────

const ANSUT_TIMEOUT_MS = 8000
const ANSUT_MAX_ATTEMPTS = 2
const ANSUT_RETRY_DELAY_MS = 400

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * POST to the ANSUT API with a bounded timeout and a single retry on
 * transient failures (network error or 5xx) — never retried on 4xx, since
 * those are configuration/validation errors that won't fix themselves.
 * This is what makes OTP delivery resilient to the API's occasional blips
 * instead of failing outright on the first hiccup.
 */
async function postToAnsut(
  path: string,
  body: Record<string, unknown>,
  logTag: string
): Promise<MessagingResult> {
  if (!ANSUT_BASE_URL) {
    console.warn(`[${logTag}] ANSUT_API_BASE_URL not configured, skipping send`)
    return { success: false, message: 'API ANSUT non configurée' }
  }

  let lastError: MessagingResult = { success: false, message: 'Erreur réseau' }

  for (let attempt = 1; attempt <= ANSUT_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), ANSUT_TIMEOUT_MS)

    try {
      const response = await fetch(`${ANSUT_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      clearTimeout(timeout)

      const data = await response.json().catch(() => null)

      if (response.ok) {
        console.log(`[${logTag}] ✅ Sent successfully (attempt ${attempt})`)
        return { success: true, message: 'Envoyé avec succès', data }
      }

      console.error(`[${logTag}] ❌ Failed (attempt ${attempt}):`, response.status, data)
      lastError = { success: false, message: 'Échec de l\'envoi', data }

      // Only retry on server-side errors — a 4xx won't succeed on retry.
      if (response.status < 500 || attempt === ANSUT_MAX_ATTEMPTS) {
        return lastError
      }
    } catch (error) {
      clearTimeout(timeout)
      const isTimeout = error instanceof Error && error.name === 'AbortError'
      console.error(`[${logTag}] ❌ ${isTimeout ? 'Timeout' : 'Network error'} (attempt ${attempt}):`, error)
      lastError = { success: false, message: isTimeout ? 'Délai dépassé lors de l\'envoi' : 'Erreur réseau lors de l\'envoi' }
    }

    if (attempt < ANSUT_MAX_ATTEMPTS) {
      await sleep(ANSUT_RETRY_DELAY_MS)
    }
  }

  return lastError
}

// ─── SMS Sending ────────────────────────────────────────────────────────────────

/**
 * Send an SMS via the ANSUT API
 * POST {{baseUrl}}/api/SendSMS
 */
export async function sendSms(params: SendSmsParams): Promise<MessagingResult> {
  const { to, text, dlrUrl } = params
  const formattedTo = formatPhoneForAnsut(to)

  const body: Record<string, string> = {
    to: formattedTo,
    from: ANSUT_SMS_SENDER,
    text,
    username: ANSUT_USERNAME,
    password: ANSUT_PASSWORD,
  }

  if (dlrUrl) {
    body.dlrUrl = dlrUrl
  }

  return postToAnsut('/SendSMS', body, 'ANSUT SMS')
}

// ─── Email Sending ──────────────────────────────────────────────────────────────

/**
 * Send an Email via the ANSUT API
 * POST {{baseUrl}}/api/message/send (channel: "Email")
 */
export async function sendEmail(params: SendEmailParams): Promise<MessagingResult> {
  const { to, subject, content, cc, bcc, isHtml = true } = params

  const body: Record<string, unknown> = {
    to,
    from: ANSUT_SMS_SENDER,
    content,
    subject,
    username: ANSUT_USERNAME,
    password: ANSUT_PASSWORD,
    channel: 'Email',
    ishtml: isHtml,
  }

  if (cc) body.cc = cc
  if (bcc) body.bcc = bcc

  return postToAnsut('/message/send', body, 'ANSUT Email')
}

// ─── OTP Templates ──────────────────────────────────────────────────────────────

/**
 * Send an OTP code by SMS
 */
export async function sendOtpSms(phone: string, code: string, purpose: 'login' | 'email_verify' | 'password_reset' = 'login'): Promise<MessagingResult> {
  const purposeLabels = {
    login: 'connexion',
    email_verify: 'vérification',
    password_reset: 'réinitialisation',
  }

  const text = `Mon Toit - Votre code de ${purposeLabels[purpose]} est : ${code}. Valide 5 minutes. Ne partagez jamais ce code.`

  return sendSms({ to: phone, text })
}

/**
 * Send an OTP code by Email
 */
export async function sendOtpEmail(email: string, code: string, firstName: string, purpose: 'login' | 'email_verify' | 'password_reset' = 'email_verify'): Promise<MessagingResult> {
  const purposeLabels = {
    login: 'connexion',
    email_verify: 'vérification d\'email',
    password_reset: 'réinitialisation de mot de passe',
  }

  const subject = `Mon Toit - Code de ${purposeLabels[purpose]}`
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #fafafa;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background: linear-gradient(135deg, #FF6C2F, #FF8C5A); padding: 32px 24px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 700;">🏠 Mon Toit</h1>
            <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Plateforme de location ANSUT</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding: 32px 24px;">
            <p style="margin: 0 0 16px; font-size: 16px; color: #171717;">Bonjour <strong>${firstName}</strong>,</p>
            <p style="margin: 0 0 24px; font-size: 14px; color: #525252; line-height: 1.6;">
              Vous avez demandé un code de ${purposeLabels[purpose]}. Voici votre code de vérification :
            </p>
            <!-- OTP Code -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="text-align: center; padding: 20px; background: #FFF7ED; border-radius: 8px; border: 2px dashed #FF6C2F;">
                  <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #FF6C2F; font-family: 'Courier New', monospace;">${code}</span>
                </td>
              </tr>
            </table>
            <p style="margin: 24px 0 0; font-size: 13px; color: #737373; line-height: 1.5;">
              ⏱ Ce code est valable pendant <strong>5 minutes</strong>.<br>
              🔒 Ne partagez jamais ce code avec qui que ce soit.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding: 20px 24px; background: #fafafa; text-align: center; border-top: 1px solid #e5e5e5;">
            <p style="margin: 0; font-size: 12px; color: #a3a3a3;">
              Si vous n'avez pas fait cette demande, ignorez cet email.<br>
              © ${new Date().getFullYear()} Mon Toit — ANSUT, Côte d'Ivoire
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  return sendEmail({
    to: email,
    subject,
    content: htmlContent,
    isHtml: true,
  })
}
