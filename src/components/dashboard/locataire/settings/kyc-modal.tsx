'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ScanFace, CheckCircle2, XCircle, Loader2, CreditCard, FileCheck, RefreshCw,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { authFetch } from '@/lib/auth-fetch'
import { useInAppBrowser } from '@/hooks/capacitor'
import { motion } from 'framer-motion'
import type { ProfileData } from './types'

interface KycVerificationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: ProfileData | null
  onVerified: () => void
  onRedo?: () => Promise<void>
}

export function KycVerificationModal({
  open,
  onOpenChange,
  profile,
  onVerified,
  onRedo,
}: KycVerificationModalProps) {
  // KYC face verification state (NeoFace v2 flow)
  const [kycStep, setKycStep] = useState<'idle' | 'uploading' | 'selfie' | 'verifying' | 'done'>('idle')
  const [kycDocImage, setKycDocImage] = useState<string | null>(null)
  const [kycDocImageVerso, setKycDocImageVerso] = useState<string | null>(null)
  const [kycDocumentId, setKycDocumentId] = useState<string | null>(null)
  const [kycSelfieUrl, setKycSelfieUrl] = useState<string | null>(null)
  const [kycResult, setKycResult] = useState<{ verified: boolean; message: string } | null>(null)
  const [kycOcrData, setKycOcrData] = useState<{
    typeDoc: string | null
    nom: string | null
    prenom: string | null
    dateNaissance: string | null
    sexe: string | null
    numeroDocument: string | null
    verso: {
      nni: string | null
      profession: string | null
    } | null
  } | null>(null)
  const [kycPollCount, setKycPollCount] = useState(0)

  const kycDocInputRef = useRef<HTMLInputElement>(null)
  const kycDocVersoInputRef = useRef<HTMLInputElement>(null)
  const kycPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setKycStep('idle')
      setKycDocImage(null)
      setKycDocImageVerso(null)
      setKycDocumentId(null)
      setKycSelfieUrl(null)
      setKycResult(null)
      setKycOcrData(null)
      setKycPollCount(0)
    }
  }, [open])

  // Cleanup polling interval on unmount or close
  useEffect(() => {
    return () => {
      if (kycPollIntervalRef.current) {
        clearInterval(kycPollIntervalRef.current)
      }
    }
  }, [])

  // Stop polling when modal closes
  useEffect(() => {
    if (!open && kycPollIntervalRef.current) {
      clearInterval(kycPollIntervalRef.current)
      kycPollIntervalRef.current = null
      if (kycStep === 'verifying') {
        setKycStep('selfie')
      }
    }
  }, [open, kycStep])

  // ── Compress large image to avoid 413 Payload Too Large ────────────────
  const compressImage = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // If under 1.5MB, use original
      if (file.size <= 1.5 * 1024 * 1024) {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
        return
      }

      const img = new Image()
      img.onload = () => {
        let w = img.width, h = img.height
        const maxDim = 1200
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h)
          w = Math.round(w * ratio)
          h = Math.round(h * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Impossible de compresser l\'image')); return }
        ctx.drawImage(img, 0, 0, w, h)
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Impossible de compresser l\'image')); return }
          const fr = new FileReader()
          fr.onload = () => resolve(fr.result as string)
          fr.onerror = reject
          fr.readAsDataURL(blob)
        }, 'image/jpeg', 0.85)
      }
      img.onerror = () => reject(new Error('Impossible de lire l\'image'))
      img.src = URL.createObjectURL(file)
    })
  }, [])

  // ── KYC: Select recto (preview only) ─────────────────────────────────────
  const handleKycDocSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setKycResult({ verified: false, message: 'L\'image est trop volumineuse (max 10 Mo). Veuillez choisir une photo plus légère.' })
      e.target.value = ''
      return
    }
    try {
      const dataUrl = await compressImage(file)
      setKycDocImage(dataUrl)
    } catch {
      setKycResult({ verified: false, message: 'Erreur lors du traitement de l\'image.' })
    }
    e.target.value = ''
  }, [compressImage])

  // ── KYC: Select verso (preview only) ─────────────────────────────────────
  const handleKycDocVersoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setKycResult({ verified: false, message: 'L\'image est trop volumineuse (max 10 Mo). Veuillez choisir une photo plus légère.' })
      e.target.value = ''
      return
    }
    try {
      const dataUrl = await compressImage(file)
      setKycDocImageVerso(dataUrl)
    } catch {
      setKycResult({ verified: false, message: 'Erreur lors du traitement de l\'image.' })
    }
    e.target.value = ''
  }, [compressImage])

  // ── KYC: Upload recto + verso together ───────────────────────────────────
  const handleKycUploadBoth = useCallback(async () => {
    if (!kycDocImage) return

    setKycStep('uploading')
    setKycResult(null)

    try {
      // Convert files to base64 (strip data URL prefix)
      const docFile = kycDocImage.replace(/^data:image\/[a-z]+;base64,/, '')
      const docFileVerso = kycDocImageVerso
        ? kycDocImageVerso.replace(/^data:image\/[a-z]+;base64,/, '')
        : undefined

      const result = await authFetch<{
        documentId: string
        selfieUrl: string
        ocr: boolean
        ocrData: {
          typeDoc: string | null
          nom: string | null
          prenom: string | null
          dateNaissance: string | null
          sexe: string | null
          numeroDocument: string | null
          verso: { nni: string | null; profession: string | null } | null
        } | null
      }>('/api/kyc/face-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'upload', docFile, docFileVerso }),
      })

      setKycDocumentId(result.documentId)
      setKycSelfieUrl(result.selfieUrl)
      setKycOcrData(result.ocrData || null)
      setKycStep('selfie')
    } catch (err) {
      setKycResult({
        verified: false,
        message: err instanceof Error ? err.message : "Erreur lors de l'envoi du document",
      })
      setKycStep('idle')
    }
  }, [kycDocImage, kycDocImageVerso])

  const { openInWebView } = useInAppBrowser()

  // ── KYC: Open selfie URL in app browser ────────────────────────────────────
  const handleKycOpenSelfie = useCallback(() => {
    if (!kycSelfieUrl) return
    openInWebView(kycSelfieUrl)

    // Start polling after a short delay
    setKycStep('verifying')
    setKycPollCount(0)

    // Clear any existing polling
    if (kycPollIntervalRef.current) {
      clearInterval(kycPollIntervalRef.current)
    }

    let pollAttempts = 0
    const maxAttempts = 40 // 40 * 3s = 120s max

    kycPollIntervalRef.current = setInterval(async () => {
      pollAttempts++
      setKycPollCount(pollAttempts)

      if (pollAttempts > maxAttempts) {
        if (kycPollIntervalRef.current) clearInterval(kycPollIntervalRef.current)
        setKycResult({ verified: false, message: 'Délai de vérification dépassé. Veuillez réessayer.' })
        setKycStep('idle')
        return
      }

      try {
        const result = await authFetch<{ status: string; verified: boolean; message?: string; matchingScore?: number }>(
          '/api/kyc/face-auth',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'verify', documentId: kycDocumentId }),
          }
        )

        if (result.status === 'verified') {
          if (kycPollIntervalRef.current) clearInterval(kycPollIntervalRef.current)
          setKycResult({ verified: true, message: result.message || 'Vérification KYC réussie !' })
          setKycStep('done')
          onVerified()
        } else if (result.status === 'failed') {
          if (kycPollIntervalRef.current) clearInterval(kycPollIntervalRef.current)
          setKycResult({ verified: false, message: result.message || 'La vérification a échoué.' })
          setKycStep('idle')
        }
        // If "waiting", continue polling
      } catch {
        // Network error, continue polling
      }
    }, 3000)
  }, [kycSelfieUrl, kycDocumentId, onVerified])

  // ── KYC: Reset flow ──────────────────────────────────────────────────────
  const handleKycReset = useCallback(() => {
    if (kycPollIntervalRef.current) {
      clearInterval(kycPollIntervalRef.current)
    }
    setKycStep('idle')
    setKycDocImage(null)
    setKycDocImageVerso(null)
    setKycDocumentId(null)
    setKycSelfieUrl(null)
    setKycResult(null)
    setKycOcrData(null)
    setKycPollCount(0)
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {profile?.neofaceVerified ? (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanFace className="size-5 text-brand-500" />
              Vérification KYC
            </DialogTitle>
            <DialogDescription>
              Vérification d&apos;identité par reconnaissance faciale (+20% Trust Score)
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="flex items-start gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                <CheckCircle2 className="size-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-700">Vérification KYC réussie</p>
                {profile.neofaceVerifiedAt && (
                  <p className="text-xs text-emerald-600 mt-0.5">
                    Vérifié le {new Date(profile.neofaceVerifiedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full mt-4"
            onClick={async () => {
              await authFetch('/api/kyc/face-auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'reset' }),
              }).catch(() => {})
              handleKycReset()
              await onRedo?.()
            }}
          >
            <RefreshCw className="size-4 mr-2" />
            Refaire la vérification
          </Button>
        </DialogContent>
      ) : (
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanFace className="size-5 text-brand-500" />
            Vérification KYC
          </DialogTitle>
          <DialogDescription>
            Vérification d&apos;identité par reconnaissance faciale (+20% Trust Score)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Step 1: Upload ID card (recto + verso) */}
          {(kycStep === 'idle' || kycStep === 'uploading') && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Prenez en photo le <strong>recto</strong> (face avec votre photo) puis le <strong>verso</strong> de votre CNI. Nous extrayons automatiquement vos données via OCR, puis vous prendrez un selfie pour confirmer votre identité.
              </p>

              {/* Two upload zones side by side */}
              <div className="grid grid-cols-2 gap-3">
                {/* Recto zone */}
                <div
                  onClick={() => kycDocInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      kycDocInputRef.current?.click()
                    }
                  }}
                  className={`relative cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
                    kycDocImage
                      ? 'border-brand-300 bg-brand-50/30'
                      : 'border-border hover:border-brand-400 hover:bg-brand-50/20'
                  }`}
                >
                  {kycDocImage ? (
                    <div className="space-y-1">
                      <img
                        src={kycDocImage}
                        alt="Recto CNI"
                        className="mx-auto max-h-28 rounded-lg object-contain"
                      />
                      <p className="text-[10px] text-muted-foreground">Cliquer pour changer</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
                        <CreditCard className="size-4 text-muted-foreground" />
                      </div>
                      <p className="text-xs font-medium text-foreground">Recto CNI</p>
                      <p className="text-[10px] text-muted-foreground">Photo + identité</p>
                    </div>
                  )}
                </div>

                {/* Verso zone */}
                <div
                  onClick={() => kycDocVersoInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      kycDocVersoInputRef.current?.click()
                    }
                  }}
                  className={`relative cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
                    kycDocImageVerso
                      ? 'border-brand-300 bg-brand-50/30'
                      : 'border-border hover:border-brand-400 hover:bg-brand-50/20'
                  }`}
                >
                  {kycDocImageVerso ? (
                    <div className="space-y-1">
                      <img
                        src={kycDocImageVerso}
                        alt="Verso CNI"
                        className="mx-auto max-h-28 rounded-lg object-contain"
                      />
                      <p className="text-[10px] text-muted-foreground">Cliquer pour changer</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
                        <FileCheck className="size-4 text-muted-foreground" />
                      </div>
                      <p className="text-xs font-medium text-foreground">Verso CNI</p>
                      <p className="text-[10px] text-muted-foreground">NNI + profession</p>
                    </div>
                  )}
                </div>
              </div>

              <input
                ref={kycDocInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleKycDocSelect}
              />
              <input
                ref={kycDocVersoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleKycDocVersoSelect}
              />

              {/* Continuer button (disabled until recto is selected) */}
              <Button
                onClick={handleKycUploadBoth}
                disabled={!kycDocImage || kycStep === 'uploading'}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {kycStep === 'uploading' ? (
                  <><Loader2 className="size-4 mr-2 animate-spin" /> Envoi en cours...</>
                ) : (
                  <><ScanFace className="size-4 mr-2" /> Continuer vers le selfie</>
                )}
              </Button>

              {kycStep === 'uploading' && (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Envoi et analyse du document par NeoFace...
                </div>
              )}
            </div>
          )}

          {/* Step 2: Selfie link */}
          {kycStep === 'selfie' && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-brand-50 border border-brand-200">
                <p className="text-xs font-medium text-brand-700 mb-2">
                  ✅ Document envoyé avec succès
                </p>
                <p className="text-[11px] text-brand-600">
                  Cliquez sur le bouton ci-dessous pour ouvrir l&apos;interface de prise de selfie.
                </p>

                {/* OCR data preview */}
                {kycOcrData && (
                  <div className="mt-2 p-2.5 rounded-lg bg-white/70 border border-brand-100">
                    <p className="text-[10px] font-semibold text-brand-600 uppercase tracking-wider mb-1">Données extraites de la CNI :</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                      {kycOcrData.typeDoc && <><span className="text-muted-foreground">Type</span><span className="text-foreground font-medium text-right">{kycOcrData.typeDoc}</span></>}
                      {kycOcrData.nom && <><span className="text-muted-foreground">Nom</span><span className="text-foreground font-medium text-right">{kycOcrData.nom}</span></>}
                      {kycOcrData.prenom && <><span className="text-muted-foreground">Prénom</span><span className="text-foreground font-medium text-right">{kycOcrData.prenom}</span></>}
                      {kycOcrData.dateNaissance && <><span className="text-muted-foreground">Date naiss.</span><span className="text-foreground font-medium text-right">{kycOcrData.dateNaissance}</span></>}
                      {kycOcrData.numeroDocument && <><span className="text-muted-foreground">N° doc.</span><span className="text-foreground font-medium text-right">{kycOcrData.numeroDocument}</span></>}
                      {kycOcrData.verso?.nni && <><span className="text-muted-foreground">NNI</span><span className="text-foreground font-medium text-right">{kycOcrData.verso.nni}</span></>}
                      {kycOcrData.verso?.profession && <><span className="text-muted-foreground">Profession</span><span className="text-foreground font-medium text-right">{kycOcrData.verso.profession}</span></>}
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={handleKycOpenSelfie}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <ScanFace className="size-4 mr-2" />
                Ouvrir la vérification faciale
              </Button>

              <Button
                onClick={handleKycReset}
                variant="outline"
                className="w-full h-9 text-xs border-border"
              >
                <RefreshCw className="size-3.5 mr-1.5" />
                Recommencer
              </Button>
            </div>
          )}

          {/* Step 3: Polling / Verifying */}
          {kycStep === 'verifying' && (
            <div className="space-y-3">
              <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-muted border border-border">
                <Loader2 className="size-8 animate-spin text-brand-500" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">Vérification en cours...</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Prenez votre selfie dans la fenêtre ouverte. Nous vérifions le résultat automatiquement.
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Tentative {kycPollCount}/40
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleKycOpenSelfie}
                  variant="outline"
                  className="flex-1 h-9 text-xs border-brand-200 text-brand-600 hover:bg-brand-50"
                >
                  <ScanFace className="size-3.5 mr-1.5" />
                  R&#39;ouvrir le selfie
                </Button>
                <Button
                  onClick={handleKycReset}
                  variant="outline"
                  className="flex-1 h-9 text-xs border-border"
                >
                  <XCircle className="size-3.5 mr-1.5" />
                  Annuler
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Done (success or failure) */}
          {kycStep === 'done' && kycResult && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl border ${
                kycResult.verified
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex size-10 items-center justify-center rounded-full shrink-0 mt-0.5 ${
                  kycResult.verified ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'
                }`}>
                  {kycResult.verified ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${kycResult.verified ? 'text-emerald-700' : 'text-red-700'}`}>
                    {kycResult.verified ? 'Vérification KYC réussie !' : 'Vérification échouée'}
                  </p>
                  <p className={`text-xs mt-0.5 ${kycResult.verified ? 'text-emerald-600' : 'text-red-600'}`}>
                    {kycResult.message}
                  </p>

                  {/* OCR data on success */}
                  {kycResult.verified && kycOcrData && (
                    <div className="mt-3 p-2.5 rounded-lg bg-white/70 border border-emerald-100">
                      <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">Données extraites de la CNI :</p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                        {kycOcrData.typeDoc && <><span className="text-muted-foreground">Type</span><span className="text-foreground font-medium text-right">{kycOcrData.typeDoc}</span></>}
                        {kycOcrData.nom && <><span className="text-muted-foreground">Nom</span><span className="text-foreground font-medium text-right">{kycOcrData.nom}</span></>}
                        {kycOcrData.prenom && <><span className="text-muted-foreground">Prénom</span><span className="text-foreground font-medium text-right">{kycOcrData.prenom}</span></>}
                        {kycOcrData.dateNaissance && <><span className="text-muted-foreground">Date naiss.</span><span className="text-foreground font-medium text-right">{kycOcrData.dateNaissance}</span></>}
                        {kycOcrData.numeroDocument && <><span className="text-muted-foreground">N° doc.</span><span className="text-foreground font-medium text-right">{kycOcrData.numeroDocument}</span></>}
                        {kycOcrData.verso?.nni && <><span className="text-muted-foreground">NNI</span><span className="text-foreground font-medium text-right">{kycOcrData.verso.nni}</span></>}
                        {kycOcrData.verso?.profession && <><span className="text-muted-foreground">Profession</span><span className="text-foreground font-medium text-right">{kycOcrData.verso.profession}</span></>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {!kycResult.verified && (
                <Button
                  variant="link"
                  className="text-[11px] text-brand-500 p-0 h-auto mt-2"
                  onClick={handleKycReset}
                >
                  <RefreshCw className="size-3 mr-1" />
                  Réessayer
                </Button>
              )}
            </motion.div>
          )}

          {/* Error state (on idle) */}
          {kycStep === 'idle' && kycResult && !kycResult.verified && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-lg border bg-red-50 border-red-200"
            >
              <div className="flex items-start gap-2">
                <XCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-red-700">{kycResult.message}</p>
                  <Button
                    variant="link"
                    className="text-[11px] text-brand-500 p-0 h-auto mt-1"
                    onClick={() => { setKycResult(null) }}
                  >
                    <RefreshCw className="size-3 mr-1" />
                    Réessayer
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </DialogContent>
      )}
    </Dialog>
  )
}
