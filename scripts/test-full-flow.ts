/**
 * Test du flux complet :
 * 1. Locataire soumet candidature → 2. TC valide dossier → 3. Propriétaire accepte → 4. Signature bail
 *
 * ⚠️  Test au niveau base de données (contourne les routes API).
 * Les effets de bord (notifications, création de paiements) sont déclenchés par
 * les handlers API (/api/tc/rental-files, /api/leases/[id]/sign) et ne sont PAS
 * reproduits ici. Les 2 "échecs" attendus sont documentés dans les étapes.
 *
 * Utilise les données existantes (users, properties). Crée et nettoie les données temporaires.
 *
 * Usage : node --env-file=.env.local --experimental-transform-types scripts/test-full-flow.ts
 */

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// ─── Env Setup ──────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Erreur : variables NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises dans .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ─── Helpers ────────────────────────────────────────────────────────────────
function generateId(): string {
  return crypto.randomUUID()
}

let passed = 0
let failed = 0

function check(step: string, condition: boolean, details?: string) {
  const icon = condition ? '✅' : '❌'
  console.log(`  ${icon} ${step}${details ? ` — ${details}` : ''}`)
  if (condition) passed++
  else failed++
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('  TEST : FLUX COMPLET CANDIDATURE')
  console.log('═══════════════════════════════════════════════════════\n')

  // ── Résoudre les IDs des utilisateurs existants ──────────────────────────
  console.log('🔍 Résolution des utilisateurs existants...')

  const { data: tenantUser } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .eq('id', '851fc553-d358-4029-b038-6b7244b147bd')
    .single()

  if (!tenantUser) {
    console.error('❌ Locataire YOUSSOUF DIAKITE introuvable en base')
    process.exit(1)
  }
  console.log(`  👤 Locataire : ${tenantUser.first_name} ${tenantUser.last_name} (${tenantUser.id.slice(0, 8)}...)`)

  const { data: ownerUser } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .eq('id', 'b165e0c9-3604-4547-a792-0442c3d3d4b8')
    .single()

  if (!ownerUser) {
    console.error('❌ Propriétaire AKOUN B ABOA introuvable en base')
    process.exit(1)
  }
  console.log(`  👤 Propriétaire : ${ownerUser.first_name} ${ownerUser.last_name} (${ownerUser.id.slice(0, 8)}...)`)

  const { data: tcUser } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .eq('id', 'f20df688-acf0-4161-8c2c-2f12492414b0')
    .single()

  if (!tcUser) {
    console.error('❌ TC Aya Diabaté introuvable en base')
    process.exit(1)
  }
  console.log(`  👤 Tiers de Confiance : ${tcUser.first_name} ${tcUser.last_name} (${tcUser.id.slice(0, 8)}...)`)

  // ── Trouver une propriété disponible du propriétaire ─────────────────────
  const { data: ownerProps } = await supabase
    .from('properties')
    .select('id, title, rental_status')
    .eq('owner_id', ownerUser.id)
    .neq('rental_status', 'loue')
    .limit(5)

  if (!ownerProps || ownerProps.length === 0) {
    console.error('❌ Aucune propriété disponible pour ce propriétaire')
    process.exit(1)
  }

  const property = ownerProps[0]
  console.log(`  🏠 Propriété : ${property.title} (statut: ${property.rental_status})`)

  // ── IDs des données temporaires ──────────────────────────────────────────
  const rentalFileId = generateId()
  const applicationId = generateId()
  const leaseId = generateId()

  let cleanupDone = false

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // ÉTAPE 1 : Créer le dossier locataire et la candidature
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n1️⃣  ÉTAPE 1 : Dossier locataire + Candidature')
    console.log('────────────────────────────────────────────')

    // Créer le dossier locataire en DRAFT
    const { error: createRfErr } = await supabase.from('rental_files').insert({
      id: rentalFileId,
      tenant_id: tenantUser.id,
      status: 'SUBMITTED', // Directement soumis
      tenant_category: 'SALARIE',
      monthly_income: 500000,
      employer: 'Test Corp',
      employment_type: 'CDI',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    check('Dossier locataire créé (SUBMITTED)', !createRfErr, createRfErr?.message)

    // Créer la candidature
    const { error: createAppErr } = await supabase.from('applications').insert({
      id: applicationId,
      rental_file_id: rentalFileId,
      property_id: property.id,
      tenant_id: tenantUser.id,
      status: 'SUBMITTED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    check('Candidature soumise (SUBMITTED)', !createAppErr, createAppErr?.message)

    // Vérifier qu'aucune notification n'a été envoyée (dossier pas validé)
    const { data: noNotifs } = await supabase
      .from('notifications')
      .select('id')
      .eq('entity_id', applicationId)
    check('Aucune notification propriétaire (dossier non validé)', !noNotifs?.length,
      noNotifs?.length ? `${noNotifs.length} notification(s) trouvée(s)` : 'OK')

    // ═══════════════════════════════════════════════════════════════════════
    // ÉTAPE 2 : TC valide le dossier
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n2️⃣  ÉTAPE 2 : Validation TC (APPROVE)')
    console.log('─────────────────────────────────')

    const { error: approveErr } = await supabase
      .from('rental_files')
      .update({
        status: 'VALIDATED',
        reviewed_by_id: tcUser.id,
        reviewed_at: new Date().toISOString(),
        valid_until: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', rentalFileId)
    check('Dossier → VALIDATED', !approveErr, approveErr?.message)

    // Vérifier que la candidature est restée en SUBMITTED (pas sync)
    const { data: appAfterTC } = await supabase
      .from('applications')
      .select('status')
      .eq('id', applicationId)
      .single()
    check('Candidature reste SUBMITTED (pas sync TC→app)', appAfterTC?.status === 'SUBMITTED',
      `Statut: ${appAfterTC?.status}`)

    // Vérifier que les notifications différées ont été envoyées
    const { data: deferredNotifs } = await supabase
      .from('notifications')
      .select('id, title, user_id')
      .eq('entity_id', applicationId)
    check('Notifications différées envoyées', !!deferredNotifs?.length,
      `${deferredNotifs?.length || 0} notification(s)`)

    // ═══════════════════════════════════════════════════════════════════════
    // ÉTAPE 3 : Propriétaire accepte → Bail créé
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n3️⃣  ÉTAPE 3 : Acceptation propriétaire')
    console.log('───────────────────────────────────')

    // Créer le bail
    const { error: createLeaseErr } = await supabase.from('leases').insert({
      id: leaseId,
      status: 'PENDING_SIGNATURE',
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      monthly_rent: 150000,
      charges: 20000,
      deposit: 300000,
      property_id: property.id,
      tenant_id: tenantUser.id,
      owner_id: ownerUser.id,
      rental_file_id: rentalFileId,
      created_at: new Date().toISOString(),
    })
    check('Bail créé (PENDING_SIGNATURE)', !createLeaseErr, createLeaseErr?.message)

    // Mettre à jour le statut du dossier locataire
    const { error: acceptRfErr } = await supabase
      .from('rental_files')
      .update({ status: 'ACCEPTED', updated_at: new Date().toISOString() })
      .eq('id', rentalFileId)
    check('Dossier locataire → ACCEPTED', !acceptRfErr, acceptRfErr?.message)

    // Mettre à jour la candidature
    const { error: acceptAppErr } = await supabase
      .from('applications')
      .update({ status: 'ACCEPTED', updated_at: new Date().toISOString() })
      .eq('id', applicationId)
    check('Candidature → ACCEPTED', !acceptAppErr, acceptAppErr?.message)

    // Marquer la propriété comme louée
    const { error: rentErr } = await supabase
      .from('properties')
      .update({ rental_status: 'loue', updated_at: new Date().toISOString() })
      .eq('id', property.id)
    check('Propriété → loue', !rentErr, rentErr?.message)

    // ═══════════════════════════════════════════════════════════════════════
    // ÉTAPE 4 : Signature bail (propriétaire + locataire)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n4️⃣  ÉTAPE 4 : Signature du bail')
    console.log('───────────────────────────────')

    const signOtp = crypto.randomBytes(16).toString('hex')

    // Propriétaire signe
    const { error: ownerSignErr } = await supabase
      .from('leases')
      .update({
        owner_signed_at: new Date().toISOString(),
        owner_sign_otp: signOtp,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leaseId)
    check('Propriétaire a signé', !ownerSignErr, ownerSignErr?.message)

    // Locataire signe → bail ACTIF
    const { error: tenantSignErr, data: updatedLease } = await supabase
      .from('leases')
      .update({
        tenant_signed_at: new Date().toISOString(),
        tenant_sign_otp: signOtp,
        status: 'ACTIVE',
        updated_at: new Date().toISOString(),
      })
      .eq('id', leaseId)
      .select()
      .single()

    check('Locataire a signé', !tenantSignErr, tenantSignErr?.message)
    check('Bail → ACTIVE', updatedLease?.status === 'ACTIVE', `Statut: ${updatedLease?.status}`)

    // ═══════════════════════════════════════════════════════════════════════
    // VÉRIFICATIONS FINALES
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n5️⃣  VÉRIFICATIONS FINALES')
    console.log('────────────────────────')

    // Bail vérifié
    check('Bail : propriétaire a signé', !!updatedLease?.owner_signed_at)
    check('Bail : locataire a signé', !!updatedLease?.tenant_signed_at)

    // Propriété vérifiée
    const { data: finalProp } = await supabase
      .from('properties')
      .select('rental_status')
      .eq('id', property.id)
      .single()
    check('Propriété marquée louée', finalProp?.rental_status === 'loue', `Statut: ${finalProp?.rental_status}`)

    // Candidature vérifiée
    const { data: finalApp } = await supabase
      .from('applications')
      .select('status')
      .eq('id', applicationId)
      .single()
    check('Candidature → ACCEPTED', finalApp?.status === 'ACCEPTED', `Statut: ${finalApp?.status}`)

    // Paiements initiaux
    const { data: payments } = await supabase
      .from('payments')
      .select('reference, amount, status')
      .eq('lease_id', leaseId)

    if (payments && payments.length > 0) {
      const hasCaution = payments.some(p => p.reference?.startsWith('CAUTION'))
      const hasAvance = payments.some(p => p.reference?.startsWith('AVANCE'))
      check(`Paiements créés : ${payments.length}`, true, payments.map(p => `${p.reference}: ${p.amount} FCFA`).join(', '))
      check('Caution présente', hasCaution)
      check('Avance présente', hasAvance)
    } else {
      check('Paiements créés par signature', false, 'Aucun paiement trouvé')
    }

    // ═══════════════════════════════════════════════════════════════════════
    // NETTOYAGE
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n🧹 Nettoyage...')
    await supabase.from('payments').delete().eq('lease_id', leaseId).then()
    await supabase.from('leases').delete().eq('id', leaseId).then()
    await supabase.from('notifications').delete().eq('entity_id', applicationId).then()
    await supabase.from('applications').delete().eq('id', applicationId).then()
    await supabase.from('rental_files').delete().eq('id', rentalFileId).then()
    // Restaurer le statut d'origine de la propriété (seulement si changé par le test)
    const { data: checkProp } = await supabase.from('properties').select('rental_status').eq('id', property.id).single()
    if (checkProp?.rental_status === 'loue') {
      await supabase.from('properties').update({ rental_status: property.rental_status }).eq('id', property.id).then()
    }
    cleanupDone = true
    console.log('  ✅ Données de test nettoyées')

  } catch (err) {
    console.error('\n❌ Erreur pendant le test:', err instanceof Error ? err.message : err)
  } finally {
    if (!cleanupDone) {
      console.log('\n⚠️  Nettoyage d\'urgence...')
      await supabase.from('payments').delete().eq('lease_id', leaseId).then(() => {}, () => {})
      await supabase.from('leases').delete().eq('id', leaseId).then(() => {}, () => {})
      await supabase.from('notifications').delete().eq('entity_id', applicationId).then(() => {}, () => {})
      await supabase.from('applications').delete().eq('id', applicationId).then(() => {}, () => {})
      await supabase.from('rental_files').delete().eq('id', rentalFileId).then(() => {}, () => {})
      await supabase.from('properties').update({ rental_status: property.rental_status }).eq('id', property.id).then(() => {}, () => {})
    }
  }

  // ── RÉSULTAT ──────────────────────────────────────────────────────────────
  const total = passed + failed
  console.log(`\n═══════════════════════════════════════════════════════`)
  console.log(`  RÉSULTAT FINAL`)
  console.log(`  ✅ ${passed}/${total} étapes réussies`)
  if (failed === 0) {
    console.log('  ✅ FLUX COMPLET VALIDÉ')
    process.exit(0)
  } else {
    console.log(`  ❌ ${failed} échec(s)`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Erreur fatale:', err)
  process.exit(1)
})
