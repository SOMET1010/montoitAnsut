'use client'

import { FileText, Download, Eye } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useInAppBrowser } from '@/hooks/capacitor'

interface DocumentInfo {
  url: string
  name: string
  type?: string
}

interface DocumentPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Support both interfaces
  document?: DocumentInfo | null
  documentUrl?: string
  documentName?: string
}

const typeLabels: Record<string, string> = {
  ID_CARD: 'Carte d\'identité',
  PASSPORT: 'Passeport',
  PAY_SLIP: 'Bulletin de salaire',
  EMPLOYMENT_CONTRACT: 'Contrat de travail',
  WORK_CERTIFICATE: 'Attestation de travail',
  BANK_STATEMENT: 'Relevé bancaire',
  GUARANTOR_ID: 'PI Garant',
  GUARANTOR_INCOME_PROOF: 'Revenus Garant',
  PROOF_OF_ADDRESS: 'Justificatif de domicile',
  PARENT_ADDRESS_PROOF: 'Justificatif parental',
  RCCM_REGISTRATION: 'Registre RCCM',
  TAX_DECLARATION: 'Déclaration fiscale',
  SCHOOL_CERTIFICATE: 'Certificat de scolarité',
  SCHOLARSHIP_CERTIFICATE: 'Attestation de bourse',
  PROPERTY_TITLE: 'Titre de propriété',
  UTILITY_BILL: 'Facture',
  BANK_ACCOUNT_DETAILS: 'RIB',
  OTHER: 'Autre',
  TITRE_FONCIER: 'Titre foncier',
  ACTE_NOTARIE: 'Acte notarié',
  ATTESTATION_PROPRIETE: 'Attestation de propriété',
  RCCM: 'RCCM',
  AGREMENT: 'Agrément',
}

function getFileExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname
    return pathname.split('.').pop()?.toLowerCase() || ''
  } catch {
    return url.split('.').pop()?.toLowerCase() || ''
  }
}

function isImageFile(url: string): boolean {
  const ext = getFileExtension(url)
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)
}

function isPdfFile(url: string): boolean {
  const ext = getFileExtension(url)
  return ext === 'pdf'
}

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  document,
  documentUrl,
  documentName,
}: DocumentPreviewDialogProps) {
  // Normalize to common props
  const url = document?.url || documentUrl || ''
  const name = document?.name || documentName || ''
  const docType = document?.type

  const { openInWebView } = useInAppBrowser()

  if (!url) return null

  const isImage = isImageFile(url)
  const isPdf = isPdfFile(url)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-w-[95vw] max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-2">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="size-5 text-brand-500" />
              Aperçu du document
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {docType && (
              <Badge variant="outline" className="text-xs">
                {typeLabels[docType] || docType}
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">{name}</span>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden rounded-lg border border-border bg-muted/30">
          {isImage ? (
            <div className="flex items-center justify-center p-2 sm:p-4 max-h-[55vh] sm:max-h-[65vh] overflow-auto">
              <img
                src={url}
                alt={name}
                className="max-w-full max-h-[50vh] sm:max-h-[60vh] object-contain rounded"
              />
            </div>
          ) : isPdf ? (
            <iframe
              src={url}
              className="w-full h-[50vh] sm:h-[65vh] rounded"
              title={name}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="size-16 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground font-medium">Aperçu non disponible</p>
              <p className="text-sm text-muted-foreground mt-1">
                Ce type de document ne peut pas être prévisualisé en ligne
              </p>
            </div>
          )}
        </div>

        <div className="shrink-0 flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => openInWebView(url)}
          >
            <Eye className="size-4" />
            Ouvrir
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            onClick={() => {
              const a = window.document.createElement('a')
              a.href = url
              a.download = name
              a.target = '_blank'
              window.document.body.appendChild(a)
              a.click()
              window.document.body.removeChild(a)
            }}
          >
            <Download className="size-4" />
            Télécharger
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
