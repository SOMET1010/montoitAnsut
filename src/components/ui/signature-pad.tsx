'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser, RotateCcw, PenTool } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SignaturePadProps {
  /** Called when the user confirms their signature with a base64 PNG data URL */
  onConfirm: (signatureDataUrl: string) => void
  /** Called when the user cancels */
  onCancel: () => void
  /** Whether the parent is processing the signature */
  loading?: boolean
  /** The signatory name to display under the signature line */
  signatoryName?: string
  /** The signatory role (e.g., "Locataire", "Propriétaire") */
  signatoryRole?: string
}

export function SignaturePad({
  onConfirm,
  onCancel,
  loading = false,
  signatoryName,
  signatoryRole,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)

  // Set up canvas dimensions and styling
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const container = canvas.parentElement
      if (!container) return
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1

      canvas.width = rect.width * dpr
      canvas.height = 200 * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = '200px'

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(dpr, dpr)
        ctx.strokeStyle = '#1a1a2e'
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
      }
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [])

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()

    if ('touches' in e) {
      const touch = e.touches[0]
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }, [])

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const pos = getPos(e)
    if (!pos) return
    setIsDrawing(true)
    lastPosRef.current = pos

    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
    }
  }, [getPos])

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawing) return
    const pos = getPos(e)
    if (!pos) return

    const ctx = canvasRef.current?.getContext('2d')
    if (ctx && lastPosRef.current) {
      ctx.beginPath()
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    }
    lastPosRef.current = pos
    setHasSignature(true)
  }, [isDrawing, getPos])

  const stopDrawing = useCallback(() => {
    setIsDrawing(false)
    lastPosRef.current = null
  }, [])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const dpr = window.devicePixelRatio || 1
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
    }
    setHasSignature(false)
  }, [])

  const handleConfirm = useCallback(() => {
    if (!hasSignature) return
    const canvas = canvasRef.current
    if (!canvas) return

    // Get signature as base64 PNG
    const dataUrl = canvas.toDataURL('image/png')
    onConfirm(dataUrl)
  }, [hasSignature, onConfirm])

  return (
    <div className="space-y-4">
      {/* Signatory info */}
      {(signatoryName || signatoryRole) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <PenTool className="size-4 text-brand-500" />
          <span>
            Signature de{' '}
            {signatoryRole && <span className="font-medium text-foreground">{signatoryRole}</span>}
            {signatoryName && <span> — {signatoryName}</span>}
          </span>
        </div>
      )}

      {/* Canvas container */}
      <div className="relative rounded-xl border-2 border-dashed border-muted-foreground/30 bg-white overflow-hidden">
        {/* Placeholder when empty */}
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-muted-foreground/40 text-sm select-none">
              Dessinez votre signature ici
            </p>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="w-full touch-none cursor-crosshair"
          style={{ height: 200 }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        {/* Signature line */}
        <div className="absolute bottom-6 left-8 right-8 border-b-2 border-muted-foreground/20" />
        <div className="absolute bottom-2 left-8 text-[10px] text-muted-foreground/40 select-none">
          Signature
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={clearCanvas}
          disabled={!hasSignature || loading}
          className="gap-1.5"
        >
          <RotateCcw className="size-3.5" />
          Effacer
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={!hasSignature || loading}
            className={cn(
              'gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground',
              !hasSignature && 'opacity-50 cursor-not-allowed'
            )}
          >
            {loading ? (
              <>
                <span className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Validation...
              </>
            ) : (
              <>
                <Eraser className="size-3.5" />
                Confirmer la signature
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
