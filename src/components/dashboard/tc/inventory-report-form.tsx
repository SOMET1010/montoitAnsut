'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Save, CheckCircle2, FileText, Building2, Key, Clock, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useBackHandler } from '@/hooks/use-back-handler'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

// ─── Constants ────────────────────────────────────────────────────────────────

const DESIGNATIONS = [
  'SOL',
  'PEINTURE DES MURS',
  'PEINTURE DES PLAFONDS',
  'PORTES',
  'ÉLECTRICITÉ',
  'ROBINETTERIE',
  'ÉVIER INOX DE LAVABO',
  'DOUCHE ET SDB',
  'NOMBRE DE CLÉS',
] as const

const ROOM_COLUMNS = [
  'CUISINE',
  'SALLE D\'EAU CH. PRINCIPALE',
  'SALLE D\'EAU AUTRES CHAMBRES',
  'AUTRE PIÈCE',
  'AUTRE PIÈCE',
] as const

// Shorter labels for mobile
const ROOM_COLUMNS_SHORT = [
  'Cuisine',
  'Salle de bain princ.',
  'Salle de bain autres',
  'Autre pièce 1',
  'Autre pièce 2',
] as const

type Condition = 'BON' | 'MAUVAIS' | null

interface CellState {
  condition: Condition
  observation: string
  keyCount: number | null
}

interface GridState {
  [rowIdx: string]: {
    [colIdx: string]: CellState
  }
}

const defaultCellState = (): CellState => ({
  condition: null,
  observation: '',
  keyCount: null,
})

const createDefaultGrid = (): GridState => {
  const grid: GridState = {}
  for (let r = 0; r < DESIGNATIONS.length; r++) {
    grid[r] = {}
    for (let c = 0; c < ROOM_COLUMNS.length; c++) {
      grid[r][c] = defaultCellState()
    }
  }
  return grid
}

type InventoryType = 'INVENTORY_ENTRANCE' | 'INVENTORY_EXIT'

interface PropertyInfo {
  id: string
  title: string
  type: string
  commune: string
  images: Array<{ id: string; url: string; order: number }>
  owner: {
    id: string
    firstName: string
    lastName: string
    phone: string
    email: string
  }
}

interface ExistingReport {
  id: string
  propertyId: string
  type: InventoryType
  status: string
  generalObservations: string | null
  totalKeys: number | null
  leaseId: string | null
  items: Array<{
    id: string
    designation: string
    designationOrder: number
    kitchen: string | null
    mainBathroom: string | null
    otherBathroom: string | null
    otherRoom1: string | null
    otherRoom2: string | null
    observations: string | null
  }>
  property: {
    id: string
    title: string
    address: string
    city: string
    commune: string | null
  }
}

type ReportItemPayload = {
  designation: string
  designationOrder: number
  kitchen: string | null
  mainBathroom: string | null
  otherBathroom: string | null
  otherRoom1: string | null
  otherRoom2: string | null
  observations: string | null
}

const typeLabels: Record<string, string> = {
  INVENTORY_ENTRANCE: 'Entrée des lieux',
  INVENTORY_EXIT: 'Sortie des lieux',
}

export function InventoryReportForm() {
  const { user, isAuthenticated, selectedItemId, selectedPropertyId, setDashboardSection, setSelectedItemId, setSelectedPropertyId } = useAuthStore()
  const [grid, setGrid] = useState<GridState>(createDefaultGrid)
  const [inventoryType, setInventoryType] = useState<InventoryType>('INVENTORY_ENTRANCE')
  const [generalObservations, setGeneralObservations] = useState('')
  const [propertyInfo, setPropertyInfo] = useState<PropertyInfo | null>(null)
  const [existingReport, setExistingReport] = useState<ExistingReport | null>(null)
  const [reportId, setReportId] = useState<string | null>(null)
  const [leaseId, setLeaseId] = useState('')
  const [saving, setSaving] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [showPublishDialog, setShowPublishDialog] = useState(false)
  const [publishLoading, setPublishLoading] = useState(false)

  const effectivePropertyId = selectedPropertyId || selectedItemId

  const navigateBack = () => {
    const role = user?.activeRole || user?.role
    if (role === 'PROPRIETAIRE') {
      setSelectedItemId('')
      setSelectedPropertyId('')
      setDashboardSection('my-properties')
    } else if (selectedPropertyId && !selectedItemId) {
      // Venue de property-verify-detail → retour à la liste des biens à vérifier
      setSelectedItemId('')
      setSelectedPropertyId('')
      setDashboardSection('property-verifications')
    } else {
      // Sinon → retour à la liste des rapports (comportement par défaut)
      setSelectedItemId('')
      setSelectedPropertyId('')
      setDashboardSection('inventory-reports')
    }
  }

  const goBack = () => navigateBack()

  // Register hardware back button handler (Android Capacitor)
  useBackHandler('inventory-report-form', goBack)

  // Load existing report data into the grid
  const loadReportIntoGrid = useCallback((report: ExistingReport) => {
    const newGrid = createDefaultGrid()
    for (const item of report.items) {
      const rowIdx = item.designationOrder - 1
      if (rowIdx < 0 || rowIdx >= DESIGNATIONS.length) continue

      const isKeyRow = rowIdx === 8
      const roomFields = ['kitchen', 'mainBathroom', 'otherBathroom', 'otherRoom1', 'otherRoom2'] as const
      const roomMapping = [0, 1, 2, 3, 4]

      for (let cIdx = 0; cIdx < roomMapping.length; cIdx++) {
        const colIdx = roomMapping[cIdx]
        const value = item[roomFields[cIdx]]

        if (isKeyRow && value) {
          const numMatch = value.match(/(\d+)/)
          newGrid[rowIdx][colIdx] = {
            ...defaultCellState(),
            keyCount: numMatch ? parseInt(numMatch[1], 10) : null,
            observation: item.observations || '',
          }
        } else {
          newGrid[rowIdx][colIdx] = {
            condition: (value === 'BON' || value === 'MAUVAIS') ? value : null,
            observation: item.observations || '',
            keyCount: null,
          }
        }
      }
    }
    setGrid(newGrid)
    setInventoryType(report.type)
    setGeneralObservations(report.generalObservations || '')
    setLeaseId(report.leaseId || '')
    setReportId(report.id)
  }, [])

  // Fetch data on mount
  useEffect(() => {
    if (!isAuthenticated) {
      setInitialLoading(false)
      return
    }

    const loadData = async () => {
      // Try to load as an existing report (only if selectedItemId is set)
      if (selectedItemId) {
        try {
          const d = await authFetch<{ reports: ExistingReport[] }>(`/api/tc/inventory-reports?propertyId=${selectedItemId}`)
          if (d.reports && d.reports.length > 0) {
            const match = d.reports.find((r: ExistingReport) => r.id === selectedItemId)
            if (match) {
              setExistingReport(match)
              loadReportIntoGrid(match)
              setPropertyInfo({
                id: match.property.id,
                title: match.property.title,
                type: '',
                commune: match.property.commune || '',
                images: [],
                owner: { id: '', firstName: '', lastName: '', phone: '', email: '' },
              })
              setInitialLoading(false)
              return
            }
          }
        } catch {
          // Continue
        }

        // Try to load by report ID directly
        try {
          const d = await authFetch<{ reports: ExistingReport[] }>('/api/tc/inventory-reports')
          const match = d.reports?.find((r: ExistingReport) => r.id === selectedItemId)
          if (match) {
            setExistingReport(match)
            loadReportIntoGrid(match)
            setPropertyInfo({
              id: match.property.id,
              title: match.property.title,
              type: '',
              commune: match.property.commune || '',
              images: [],
              owner: { id: '', firstName: '', lastName: '', phone: '', email: '' },
            })
            setInitialLoading(false)
            return
          }
        } catch {
          // Continue
        }
      }

      // Otherwise, load property info for creating a new report
      const propId = effectivePropertyId
      if (propId) {
        try {
          const d = await authFetch<{ property: PropertyInfo }>(`/api/tc/verifications?propertyId=${propId}`)
          setPropertyInfo(d.property || null)
        } catch {
          try {
            const d2 = await authFetch<{ property: PropertyInfo }>(`/api/properties/${propId}`)
            setPropertyInfo(d2.property || null)
          } catch {
            setPropertyInfo(null)
          }
        }
      }

      setInitialLoading(false)
    }

    loadData()
  }, [isAuthenticated, selectedItemId, effectivePropertyId, loadReportIntoGrid])

  const setCondition = (rowIdx: number, colIdx: number, condition: Condition) => {
    setGrid((prev) => ({
      ...prev,
      [rowIdx]: {
        ...prev[rowIdx],
        [colIdx]: { ...prev[rowIdx][colIdx], condition },
      },
    }))
  }

  const setKeyCount = (rowIdx: number, colIdx: number, keyCount: number | null) => {
    setGrid((prev) => ({
      ...prev,
      [rowIdx]: {
        ...prev[rowIdx],
        [colIdx]: { ...prev[rowIdx][colIdx], keyCount },
      },
    }))
  }

  // Calculate total keys
  const totalKeys = (() => {
    let total = 0
    for (let c = 0; c < ROOM_COLUMNS.length; c++) {
      const val = grid[8]?.[c]?.keyCount
      if (val) total += val
    }
    return total
  })()

  const buildItemsPayload = () => {
    const items: ReportItemPayload[] = []
    for (let r = 0; r < DESIGNATIONS.length; r++) {
      const isKeyRow = r === 8
      const cell0 = grid[r]?.[0]
      const cell1 = grid[r]?.[1]
      const cell2 = grid[r]?.[2]
      const cell3 = grid[r]?.[3]
      const cell4 = grid[r]?.[4]

      items.push({
        designation: DESIGNATIONS[r],
        designationOrder: r + 1,
        kitchen: isKeyRow ? (cell0?.keyCount !== null && cell0?.keyCount !== undefined ? `${cell0.keyCount} clé(s)` : null) : (cell0?.condition || null),
        mainBathroom: isKeyRow ? (cell1?.keyCount !== null && cell1?.keyCount !== undefined ? `${cell1.keyCount} clé(s)` : null) : (cell1?.condition || null),
        otherBathroom: isKeyRow ? (cell2?.keyCount !== null && cell2?.keyCount !== undefined ? `${cell2.keyCount} clé(s)` : null) : (cell2?.condition || null),
        otherRoom1: isKeyRow ? (cell3?.keyCount !== null && cell3?.keyCount !== undefined ? `${cell3.keyCount} clé(s)` : null) : (cell3?.condition || null),
        otherRoom2: isKeyRow ? (cell4?.keyCount !== null && cell4?.keyCount !== undefined ? `${cell4.keyCount} clé(s)` : null) : (cell4?.condition || null),
        observations: cell0?.observation || null,
      })
    }
    return items
  }

  const handleSaveDraft = async () => {
    setSaving(true)
    try {
      if (reportId) {
        await authFetch('/api/tc/inventory-reports', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportId,
            items: buildItemsPayload(),
            generalObservations,
            totalKeys,
            status: 'DRAFT',
          }),
        })
      } else {
        await authFetch('/api/tc/inventory-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            propertyId: effectivePropertyId,
            type: inventoryType,
            leaseId: leaseId || undefined,
            status: 'DRAFT',
            items: buildItemsPayload(),
            generalObservations,
            totalKeys,
          }),
        })
      }
      toast.success('Brouillon sauvegardé !')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleValidate = async () => {
    let hasAnyCondition = false
    for (let r = 0; r < DESIGNATIONS.length; r++) {
      for (let c = 0; c < ROOM_COLUMNS.length; c++) {
        if (grid[r]?.[c]?.condition) {
          hasAnyCondition = true
          break
        }
      }
      if (hasAnyCondition) break
    }

    if (!hasAnyCondition) {
      toast.error('Veuillez remplir au moins une évaluation avant de valider')
      return
    }

    setSaving(true)
    try {
      if (reportId) {
        await authFetch('/api/tc/inventory-reports', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportId,
            items: buildItemsPayload(),
            generalObservations,
            totalKeys,
            status: 'COMPLETED',
          }),
        })
      } else {
        await authFetch('/api/tc/inventory-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            propertyId: effectivePropertyId,
            type: inventoryType,
            leaseId: leaseId || undefined,
            status: 'COMPLETED',
            items: buildItemsPayload(),
            generalObservations,
            totalKeys,
          }),
        })
      }
      toast.success('État des lieux validé avec succès !')
      setSaving(false)
      setShowPublishDialog(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la validation')
      setSaving(false)
    }
  }

  const handlePublishNow = async () => {
    if (!effectivePropertyId) {
      toast.error('Aucun bien associé à cet état des lieux')
      return
    }
    setPublishLoading(true)
    try {
      await authFetch('/api/tc/verifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: effectivePropertyId, action: 'APPROVE' }),
      })
      toast.success('Bien publié avec succès !')
      goBack()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la publication')
    } finally {
      setPublishLoading(false)
    }
  }

  const handlePublishLater = () => {
    goBack()
  }

  if (initialLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 rounded bg-muted animate-pulse" />
        <div className="h-96 rounded-xl bg-muted animate-pulse" />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={goBack} className="gap-2 -ml-2">
        <ArrowLeft className="size-4" /> Retour aux rapports
      </Button>

      {/* Header */}
      <div className="bg-gradient-to-r from-brand-500/10 to-transparent rounded-xl p-4 sm:p-6 -mx-4 sm:-mx-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-brand-100 shrink-0">
            <FileText className="size-6 text-brand-500" />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                {reportId ? 'Modifier l\'État des Lieux' : 'État des Lieux'}
              </h1>
              {existingReport && (
                <Badge variant="outline" className="text-xs">Brouillon</Badge>
              )}
            </div>
            {propertyInfo ? (
              <div className="flex items-center gap-2 mt-1 min-w-0">
                <Building2 className="size-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground truncate">{propertyInfo.title} — {propertyInfo.commune || propertyInfo.type}</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-0.5">
                {reportId ? 'Modifier le rapport d\'état des lieux existant' : 'Créez un nouvel état des lieux pour un bien'}
              </p>
            )}
          </div>
        </div>

        {/* Stat badges */}
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="secondary" className="bg-brand-50 text-brand-700">
            <FileText className="size-3 mr-1" /> {inventoryType === 'INVENTORY_ENTRANCE' ? 'Entrée des lieux' : 'Sortie des lieux'}
          </Badge>
          <Badge variant="secondary" className="bg-amber-50 text-amber-700">
            <Key className="size-3 mr-1" /> {totalKeys} clé{totalKeys > 1 ? 's' : ''}
          </Badge>
        </div>
      </div>

      {/* Options row: Type selector + Lease */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground block mb-2">Type d&apos;état des lieux</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInventoryType('INVENTORY_ENTRANCE')}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    inventoryType === 'INVENTORY_ENTRANCE'
                      ? 'bg-brand-500 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  Entrée
                </button>
                <button
                  onClick={() => setInventoryType('INVENTORY_EXIT')}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    inventoryType === 'INVENTORY_EXIT'
                      ? 'bg-brand-500 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  Sortie
                </button>
              </div>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground block mb-2">Bail associé (optionnel)</label>
              <Input
                placeholder="ID du bail..."
                value={leaseId}
                onChange={(e) => setLeaseId(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Desktop Table */}
      <Card className="hidden sm:block border-border overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
            <table className="w-full min-w-[800px] sm:min-w-[900px] border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-2 sm:px-3 py-3 text-left text-xs font-bold text-foreground border-b border-r border-border w-8 sm:w-10">
                    N°
                  </th>
                  <th className="px-2 sm:px-3 py-3 text-left text-xs font-bold text-foreground border-b border-r border-border min-w-[100px] sm:min-w-[140px]">
                    DÉSIGNATIONS
                  </th>
                  {ROOM_COLUMNS.map((col, i) => (
                    <th
                      key={i}
                      className="px-1 sm:px-2 py-3 text-center text-[9px] sm:text-[10px] font-bold text-foreground border-b border-r border-border min-w-[80px] sm:min-w-[110px] leading-tight"
                    >
                      <span className="sm:hidden">{ROOM_COLUMNS_SHORT[i]}</span>
                      <span className="hidden sm:inline">{col}</span>
                    </th>
                  ))}
                  <th className="px-2 sm:px-3 py-3 text-left text-xs font-bold text-foreground border-b border-border min-w-[120px] sm:min-w-[150px]">
                    OBSERVATIONS
                  </th>
                </tr>
              </thead>

              <tbody>
                {DESIGNATIONS.map((designation, rowIdx) => {
                  const isKeyRow = rowIdx === 8
                  return (
                    <tr
                      key={rowIdx}
                      className={cn(
                        'hover:bg-muted/30 transition-colors',
                        isKeyRow && 'bg-amber-50/50'
                      )}
                    >
                      <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-sm text-muted-foreground border-b border-r border-border text-center font-medium">
                        {rowIdx + 1}
                      </td>
                      <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-foreground border-b border-r border-border whitespace-nowrap">
                        {isKeyRow && <Key className="size-3 sm:size-3.5 inline mr-1 sm:mr-1.5 text-brand-500" />}
                        {designation}
                      </td>

                      {ROOM_COLUMNS.map((_, colIdx) => (
                        <td
                          key={colIdx}
                          className="px-1 sm:px-2 py-1.5 sm:py-2 border-b border-r border-border text-center"
                        >
                          {isKeyRow ? (
                            <Input
                              type="number"
                              min={0}
                              placeholder="—"
                              value={grid[rowIdx]?.[colIdx]?.keyCount ?? ''}
                              onChange={(e) => {
                                const val = e.target.value
                                setKeyCount(rowIdx, colIdx, val === '' ? null : parseInt(val, 10))
                              }}
                              className="w-14 sm:w-16 h-8 text-center text-sm mx-auto"
                            />
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setCondition(rowIdx, colIdx, 'BON')}
                                className={cn(
                                  'px-3 py-1.5 rounded-md text-xs font-bold transition-all',
                                  grid[rowIdx]?.[colIdx]?.condition === 'BON'
                                    ? 'bg-green-500 text-white shadow-sm ring-2 ring-green-200 scale-105'
                                    : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 hover:border-green-300'
                                )}
                              >
                                BON
                              </button>
                              <button
                                onClick={() => setCondition(rowIdx, colIdx, 'MAUVAIS')}
                                className={cn(
                                  'px-3 py-1.5 rounded-md text-xs font-bold transition-all',
                                  grid[rowIdx]?.[colIdx]?.condition === 'MAUVAIS'
                                    ? 'bg-red-500 text-white shadow-sm ring-2 ring-red-200 scale-105'
                                    : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 hover:border-red-300'
                                )}
                              >
                                MAUVAIS
                              </button>
                            </div>
                          )}
                        </td>
                      ))}

                      <td className="px-1 sm:px-2 py-1.5 sm:py-2 border-b border-border">
                        <Input
                          placeholder="..."
                          value={grid[rowIdx]?.[0]?.observation ?? ''}
                          onChange={(e) => {
                            const val = e.target.value
                            setGrid((prev) => {
                              const newGrid = { ...prev }
                              for (let c = 0; c < ROOM_COLUMNS.length; c++) {
                                newGrid[rowIdx] = {
                                  ...newGrid[rowIdx],
                                  [c]: { ...newGrid[rowIdx]?.[c], observation: val },
                                }
                              }
                              return newGrid
                            })
                          }}
                          className="h-8 text-xs sm:text-sm"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              <tfoot>
                <tr className="bg-muted/50">
                  <td colSpan={2} className="px-2 sm:px-3 py-3 text-xs sm:text-sm font-bold text-foreground border-t border-border text-right">
                    TOTAL :
                  </td>
                  <td colSpan={4} className="px-2 sm:px-3 py-3 border-t border-border text-center">
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                      <Key className="size-3.5 sm:size-4 text-brand-500" />
                      <span className="text-lg sm:text-xl font-bold text-brand-500">{totalKeys}</span>
                      <span className="text-[10px] sm:text-xs text-muted-foreground">clé(s)</span>
                    </div>
                  </td>
                  <td className="px-2 sm:px-3 py-3 border-t border-border"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Card Layout — fully responsive per designation card */}
      <div className="sm:hidden space-y-4">
        {DESIGNATIONS.map((designation, rowIdx) => {
          const isKeyRow = rowIdx === 8
          return (
            <Card key={rowIdx} className={cn('border-border overflow-hidden', isKeyRow && 'border-amber-200 bg-amber-50/30')}>
              {/* Designation header */}
              <div className={cn(
                'flex items-center gap-2.5 px-4 py-3 border-b border-border',
                isKeyRow ? 'bg-amber-50' : 'bg-muted/40'
              )}>
                <span className="size-7 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-bold shrink-0">
                  {rowIdx + 1}
                </span>
                <span className="text-sm font-semibold text-foreground leading-tight">
                  {isKeyRow && <Key className="size-3.5 inline mr-1.5 text-brand-500" />}
                  {designation}
                </span>
              </div>

              <div className="p-3 space-y-1">
                {/* Room rows */}
                {ROOM_COLUMNS.map((_, colIdx) => (
                  <div
                    key={colIdx}
                    className={cn(
                      'flex items-center gap-2.5 px-2 py-2 rounded-lg',
                      colIdx % 2 === 0 ? 'bg-muted/20' : 'bg-transparent'
                    )}
                  >
                    {/* Room label */}
                    <span className="text-xs text-muted-foreground w-[5.5rem] shrink-0 leading-tight">
                      {ROOM_COLUMNS_SHORT[colIdx]}
                    </span>

                    {/* Condition or key count */}
                    <div className="flex-1 flex items-center">
                      {isKeyRow ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min={0}
                            placeholder="—"
                            value={grid[rowIdx]?.[colIdx]?.keyCount ?? ''}
                            onChange={(e) => {
                              const val = e.target.value
                              setKeyCount(rowIdx, colIdx, val === '' ? null : parseInt(val, 10))
                            }}
                            className="w-16 h-9 text-center text-sm"
                          />
                          <span className="text-xs text-muted-foreground">clé(s)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setCondition(rowIdx, colIdx, 'BON')}
                            className={cn(
                              'min-h-[36px] min-w-[52px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95',
                              grid[rowIdx]?.[colIdx]?.condition === 'BON'
                                ? 'bg-green-500 text-white shadow-sm ring-2 ring-green-300'
                                : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                            )}
                          >
                            BON
                          </button>
                          <button
                            onClick={() => setCondition(rowIdx, colIdx, 'MAUVAIS')}
                            className={cn(
                              'min-h-[36px] min-w-[52px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95',
                              grid[rowIdx]?.[colIdx]?.condition === 'MAUVAIS'
                                ? 'bg-red-500 text-white shadow-sm ring-2 ring-red-300'
                                : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                            )}
                          >
                            MAUVAIS
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Observation */}
                <div className="mt-2 pt-2 border-t border-border px-2">
                  <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">
                    Observation
                  </label>
                  <Input
                    placeholder="Observation..."
                    value={grid[rowIdx]?.[0]?.observation ?? ''}
                    onChange={(e) => {
                      const val = e.target.value
                      setGrid((prev) => {
                        const newGrid = { ...prev }
                        for (let c = 0; c < ROOM_COLUMNS.length; c++) {
                          newGrid[rowIdx] = {
                            ...newGrid[rowIdx],
                            [c]: { ...newGrid[rowIdx]?.[c], observation: val },
                          }
                        }
                        return newGrid
                      })
                    }}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </Card>
          )
        })}

        {/* Total keys */}
        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <span className="text-sm font-bold text-foreground">TOTAL CLÉS</span>
            <div className="flex items-center gap-1.5">
              <Key className="size-4 text-brand-500" />
              <span className="text-xl font-bold text-brand-500">{totalKeys}</span>
              <span className="text-xs text-muted-foreground">clé(s)</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* General Observations */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Observations générales</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Observations générales sur l'état du logement..."
            value={generalObservations}
            onChange={(e) => setGeneralObservations(e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-end">
        <Button
          variant="outline"
          onClick={goBack}
          className="gap-2 order-3 sm:order-1"
        >
          <ArrowLeft className="size-4" /> Annuler
        </Button>
        <Button
          variant="outline"
          onClick={handleSaveDraft}
          disabled={saving}
          className="gap-2 border-brand-200 text-brand-600 hover:bg-brand-50 order-2 sm:order-2"
        >
          <Save className="size-4" /> Sauvegarder le brouillon
        </Button>
        <Button
          onClick={handleValidate}
          disabled={saving}
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 order-1 sm:order-3"
        >
          <CheckCircle2 className="size-4" /> Valider l&apos;état des lieux
        </Button>
      </div>

      {/* Publish confirmation dialog */}
      <Dialog open={showPublishDialog} onOpenChange={(open) => {
        if (!open && !publishLoading) goBack()
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-green-50 sm:mx-0">
              <CheckCircle2 className="size-7 text-green-600" />
            </div>
            <DialogTitle className="text-center sm:text-left">
              État des lieux validé ✓
            </DialogTitle>
            <DialogDescription className="text-center sm:text-left">
              L&apos;état des lieux a été validé avec succès.
              {propertyInfo ? (
                <> Souhaitez-vous <strong>publier</strong> le bien <strong>{propertyInfo.title}</strong> dès maintenant ?</>
              ) : (
                <> Souhaitez-vous publier le bien dès maintenant ?</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
              <Building2 className="size-5 text-green-600 shrink-0 mt-0.5" />
              <div className="text-sm text-green-800">
                <p className="font-medium">Publier le bien maintenant</p>
                <p className="text-green-700 mt-0.5">
                  Le bien sera visible sur la plateforme et les locataires pourront le consulter et postuler.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted border border-border">
              <Clock className="size-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Publier plus tard</p>
                <p className="mt-0.5">
                  Vous pourrez publier ce bien depuis la liste des biens à vérifier.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handlePublishLater}
              disabled={publishLoading}
              className="gap-2 order-2 sm:order-1"
            >
              <Clock className="size-4" /> Plus tard
            </Button>
            <Button
              onClick={handlePublishNow}
              disabled={publishLoading}
              className="bg-green-600 hover:bg-green-700 text-white gap-2 order-1 sm:order-2"
            >
              {publishLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              {publishLoading ? 'Publication...' : 'Publier le bien'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
