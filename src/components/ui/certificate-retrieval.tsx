'use client'

import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, Search, Check, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CertificateData {
  alias: string
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  createdAt?: string
}

interface RetrievedCertificate {
  hasCertificate: boolean
  alias: string | null
  storedLocally: boolean
  synced?: boolean
  data?: {
    email?: string
    phone?: string
  }
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface CertificateRetrievalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCertificateFound?: (alias: string, email?: string, phone?: string) => void
  onGenerateNew?: () => void
}

// ─── Component ──────────────────────────────────────────────────────────────

export function CertificateRetrieval({
  open,
  onOpenChange,
  onCertificateFound,
  onGenerateNew,
}: CertificateRetrievalProps) {
  const { user } = useAuthStore()

  const [searchEmail, setSearchEmail] = useState('')
  const [searchPhone, setSearchPhone] = useState('')
  const [searchAlias, setSearchAlias] = useState('')
  const [searchMode, setSearchMode] = useState<'email-phone' | 'alias'>('email-phone')
  const [checking, setChecking] = useState(false)
  const [retrievedCert, setRetrievedCert] = useState<RetrievedCertificate | null>(null)
  const [certificateList, setCertificateList] = useState<CertificateData[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSearchEmail(user?.email || '')
      setSearchPhone(user?.phone || '')
      setSearchAlias('')
      setSearchMode('email-phone')
      setRetrievedCert(null)
      setCertificateList([])
    }
  }, [open, user])

  // Handle check certificate
  const handleCheckCertificate = useCallback(async () => {
    if (searchMode === 'alias') {
      if (!searchAlias || searchAlias.trim().length === 0) {
        toast.error('Alias requis', {
          description: 'Veuillez entrer votre alias de certificat',
          duration: 5000,
        })
        return
      }
    } else {
      // Vérifier qu'au moins un champ est rempli (mode email/téléphone)
      if (!searchEmail && !searchPhone) {
        toast.error('Informations requises', {
          description: 'Veuillez entrer au moins : votre email OU votre numéro de téléphone (format 225...)',
          duration: 5000,
        })
        return
      }

      // Vérifier le format du téléphone si fourni
      if (searchPhone && !/^225\d{8,9}$/.test(searchPhone.replace(/\s/g, ''))) {
        toast.error('Format de téléphone invalide', {
          description: 'Le téléphone doit être au format 225XXXXXXXX (10 chiffres minimum)',
          duration: 5000,
        })
        return
      }

      // Vérifier le format de l'email si fourni
      if (searchEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(searchEmail)) {
        toast.error('Format d\'email invalide', {
          description: 'Veuillez entrer une adresse email valide',
          duration: 5000,
        })
        return
      }
    }

    setChecking(true)
    setRetrievedCert(null)

    try {
      const params = new URLSearchParams()
      if (searchMode === 'alias') {
        params.set('alias', searchAlias)
      } else {
        if (searchEmail) params.set('email', searchEmail)
        if (searchPhone) params.set('phone', searchPhone)
      }

      const result = await authFetch<RetrievedCertificate>(
        `/api/certificates/check?${params.toString()}`
      )

      setRetrievedCert(result)

      if (result.hasCertificate && result.alias) {
        toast.success('Certificat trouvé !', {
          description: `Alias: ${result.alias}`,
        })
        if (onCertificateFound) {
          onCertificateFound(result.alias, result.data?.email, result.data?.phone)
        }
      } else {
        toast.info('Aucun certificat trouvé', {
          description: 'Aucun certificat existant pour ces informations.',
        })
      }
    } catch (err) {
      if (err instanceof AuthError) {
        toast.error(err.message || 'Erreur lors de la vérification')
      } else {
        toast.error('Erreur lors de la vérification du certificat')
      }
    } finally {
      setChecking(false)
    }
  }, [searchEmail, searchPhone, searchAlias, searchMode, onCertificateFound])

  // Handle retrieve all certificates
  const handleRetrieveCertificates = useCallback(async () => {
    setLoadingList(true)
    try {
      const body: Record<string, string> = {}

      if (searchMode === 'alias') {
        body.alias = searchAlias
        body.onlyAlias = 'true'
      } else {
        if (searchEmail) body.email = searchEmail
        if (searchPhone) body.phone = searchPhone
        body.onlyAlias = 'true'
      }

      const result = await authFetch<{ data: CertificateData[] }>(
        '/api/certificates/retrieve',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )

      setCertificateList(result.data || [])

      if (result.data && result.data.length > 0) {
        toast.success(`${result.data.length} certificat(s) trouvé(s)`)
      } else {
        toast.info('Aucun certificat trouvé')
      }
    } catch (err) {
      if (err instanceof AuthError) {
        toast.error(err.message || 'Erreur lors de la récupération')
      } else {
        toast.error('Erreur lors de la récupération des certificats')
      }
    } finally {
      setLoadingList(false)
    }
  }, [searchEmail, searchPhone, searchAlias, searchMode])

  // Handle sync certificate
  const handleSyncCertificate = useCallback(async (cert: CertificateData) => {
    if (!cert.alias) return

    setSyncing(true)
    try {
      // Sync the certificate with local database
      const result = await authFetch<{ aliasCertificat: string; synced: boolean }>(
        '/api/signature/generate-certificate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: cert.firstName || '',
            lastName: cert.lastName || '',
            email: cert.email || searchEmail,
            phone: cert.phone || searchPhone,
          }),
        }
      )

      if (result.aliasCertificat) {
        toast.success('Certificat synchronisé avec succès !')
        setRetrievedCert({
          hasCertificate: true,
          alias: result.aliasCertificat,
          storedLocally: true,
          synced: true,
          data: {
            email: cert.email || searchEmail,
            phone: cert.phone || searchPhone,
          },
        })
        if (onCertificateFound) {
          onCertificateFound(result.aliasCertificat, cert.email || searchEmail, cert.phone || searchPhone)
        }
      }
    } catch (err) {
      if (err instanceof AuthError) {
        toast.error(err.message || 'Erreur lors de la synchronisation')
      } else {
        toast.error('Erreur lors de la synchronisation du certificat')
      }
    } finally {
      setSyncing(false)
    }
  }, [searchEmail, searchPhone, onCertificateFound])

  // Handle use certificate
  const handleUseCertificate = useCallback(() => {
    if (retrievedCert?.alias) {
      if (onCertificateFound) {
        onCertificateFound(
          retrievedCert.alias,
          retrievedCert.data?.email,
          retrievedCert.data?.phone
        )
      }
      onOpenChange(false)
    }
  }, [retrievedCert, onCertificateFound, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-brand-500" />
            Récupérer un certificat existant
          </DialogTitle>
          <DialogDescription className="pt-2">
            Vérifiez si vous avez déjà un certificat de signature électronique chez CRYPTONEO.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Search mode toggle */}
          <div className="flex gap-2 p-1 rounded-lg bg-muted">
            <button
              type="button"
              onClick={() => setSearchMode('email-phone')}
              className={cn(
                'flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                searchMode === 'email-phone'
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Par Email / Téléphone
            </button>
            <button
              type="button"
              onClick={() => setSearchMode('alias')}
              className={cn(
                'flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                searchMode === 'alias'
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Par Alias
            </button>
          </div>

          <Separator className="my-4" />

          {/* Search form */}
          <div className="space-y-3">
            {/* Info banner */}
            {searchMode === 'email-phone' ? (
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                <p className="text-sm text-blue-700">
                  <span className="font-semibold">Champs obligatoires :</span> Au moins l&apos;un des deux champs ci-dessous est requis pour rechercher votre certificat.
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                <p className="text-sm text-blue-700">
                  <span className="font-semibold">Champ obligatoire :</span> Entrez votre alias de certificat pour le rechercher.
                </p>
              </div>
            )}

            {searchMode === 'email-phone' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="search-email">
                    Email <span className="text-muted-foreground text-xs">(optionnel si téléphone renseigné)</span>
                  </Label>
                  <Input
                    id="search-email"
                    type="email"
                    placeholder="votre@email.com"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="search-phone">
                    Téléphone <span className="text-muted-foreground text-xs">(optionnel si email renseigné)</span>
                  </Label>
                  <Input
                    id="search-phone"
                    type="tel"
                    placeholder="2250707XXXXX"
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="search-alias">
                  Alias du certificat <span className="text-red-500 text-xs ml-1">*</span>
                </Label>
                <Input
                  id="search-alias"
                  type="text"
                  placeholder="EX: CERT-123456"
                  value={searchAlias}
                  onChange={(e) => setSearchAlias(e.target.value.toUpperCase())}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  L'alias est généralement fourni lors de la création de votre certificat de signature électronique.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleCheckCertificate}
                disabled={checking}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              >
                {checking ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Vérification...
                  </>
                ) : (
                  <>
                    <Search className="size-4" />
                    Vérifier
                  </>
                )}
              </Button>
              <Button
                onClick={handleRetrieveCertificates}
                disabled={loadingList}
                variant="outline"
                className="flex-1 gap-2"
              >
                {loadingList ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Recherche...
                  </>
                ) : (
                  <>
                    <RefreshCw className="size-4" />
                    Tous les certificats
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Certificate found */}
          {retrievedCert?.hasCertificate && (
            <Card className="border-brand-200 bg-brand-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-brand-100 shrink-0">
                    <Check className="size-5 text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-brand-900">Certificat trouvé !</p>
                    <p className="text-sm text-brand-700 mt-0.5">
                      Un certificat existe pour ces informations.
                    </p>
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-brand-600">
                        <span className="font-medium">Alias :</span> {retrievedCert.alias}
                      </p>
                      {retrievedCert.data?.email && (
                        <p className="text-xs text-brand-600">
                          <span className="font-medium">Email :</span> {retrievedCert.data.email}
                        </p>
                      )}
                      {retrievedCert.data?.phone && (
                        <p className="text-xs text-brand-600">
                          <span className="font-medium">Téléphone :</span> {retrievedCert.data.phone}
                        </p>
                      )}
                    </div>
                    {retrievedCert.synced && (
                      <Badge className="mt-2 bg-green-100 text-green-700">
                        Synchronisé avec succès
                      </Badge>
                    )}
                    {retrievedCert.storedLocally && !retrievedCert.synced && (
                      <Badge className="mt-2 bg-blue-100 text-blue-700">
                        Déjà enregistré localement
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* No certificate found */}
          {retrievedCert && !retrievedCert.hasCertificate && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 shrink-0">
                    <AlertCircle className="size-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-amber-900">Aucun certificat trouvé</p>
                    <p className="text-sm text-amber-700 mt-0.5">
                      Aucun certificat de signature électronique n&apos;existe pour ces informations.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Certificate list */}
          {certificateList.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Certificats trouvés ({certificateList.length})
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {certificateList.map((cert, idx) => (
                  <Card
                    key={idx}
                    className="border-border hover:border-brand-300 transition-colors cursor-pointer"
                    onClick={() => handleSyncCertificate(cert)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {cert.alias}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {cert.firstName} {cert.lastName}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={syncing}
                          className="shrink-0"
                        >
                          {syncing ? <Loader2 className="size-3.5 animate-spin" /> : 'Utiliser'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Info message */}
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
            <p className="text-xs text-blue-700">
              <span className="font-medium">Note :</span> Si vous avez déjà un certificat
              chez CRYPTONEO, vous pouvez le réutiliser ici. Sinon, générez un nouveau
              certificat.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          {onGenerateNew && (
            <Button
              variant="outline"
              onClick={() => {
                onGenerateNew()
                onOpenChange(false)
              }}
              className="w-full sm:w-auto"
            >
              Générer un nouveau certificat
            </Button>
          )}
          {retrievedCert?.hasCertificate && (
            <Button
              onClick={handleUseCertificate}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Utiliser ce certificat
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
