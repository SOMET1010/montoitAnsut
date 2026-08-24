import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { resolveRequestUser } from '@/lib/auth/request-user'
import { notify } from '@/lib/notify'
import { getOrCreateConversation } from '@/lib/conversations'

function generateId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// POST /api/applications — Create a new application (candidature)
export async function POST(req: NextRequest) {
  try {
    const { userId, applyCookies } = await resolveRequestUser(req)
    if (!userId) {
      const resp = NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
      return applyCookies(resp)
    }

    const supabase = getSupabaseAdminClient()

    const { data: profile } = await supabase
      .from('users')
      .select('role, active_role')
      .eq('id', userId)
      .single()

    const effectiveRole = profile?.active_role || profile?.role
    if (effectiveRole !== 'LOCATAIRE') {
      const resp = NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      return applyCookies(resp)
    }

    const body = await req.json()
    const { propertyId } = body as {
      propertyId: string
    }

    if (!propertyId) {
      return NextResponse.json({ error: 'propertyId requis' }, { status: 400 })
    }

    // Check property exists
    const { data: property } = await supabase
      .from('properties')
      .select('id, owner_id, rental_status')
      .eq('id', propertyId)
      .single()

    if (!property) {
      return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 })
    }

    if (property.rental_status === 'loue') {
      return NextResponse.json({ error: 'Ce bien est déjà loué' }, { status: 400 })
    }

    // Check if tenant already applied to this property
    const { data: existingApp } = await supabase
      .from('applications')
      .select('id')
      .eq('tenant_id', userId)
      .eq('property_id', propertyId)
      .in('status', ['DRAFT', 'SUBMITTED'])
      .maybeSingle()

    if (existingApp) {
      return NextResponse.json({ error: 'Vous avez déjà candidaté pour ce bien' }, { status: 409 })
    }

    // Find or create a rental_file draft
    const { data: draftRentalFile } = await supabase
      .from('rental_files')
      .select('*')
      .eq('tenant_id', userId)
      .eq('status', 'DRAFT')
      .maybeSingle()

    let rentalFile: any
    if (draftRentalFile) {
      rentalFile = draftRentalFile
    } else {
      const { data: created } = await supabase
        .from('rental_files')
        .insert({
          id: generateId(),
          tenant_id: userId,
          status: 'DRAFT',
        } as any)
        .select()
        .single()
      rentalFile = created
    }

    // Keep rental_file as DRAFT — the tenant must explicitly submit it
    // from their dashboard after uploading documents. The application itself
    // is still created as SUBMITTED so the owner is notified.

    // Create application record
    const appId = generateId()
    const now = new Date().toISOString()
    const { data: application, error: appError } = await supabase
      .from('applications')
      .insert({
        id: appId,
        rental_file_id: rentalFile.id,
        property_id: propertyId,
        tenant_id: userId,
        status: 'SUBMITTED',
        created_at: now,
        updated_at: now,
      } as any)
      .select()
      .single()

    if (appError && appError.code === '23505') {
      // Race condition : un autre appel a créé une candidature entre-temps
      return NextResponse.json({ error: 'Vous avez déjà candidaté pour ce bien' }, { status: 409 })
    }

    if (appError) {
      console.error('Create application error:', appError)
      return NextResponse.json({ error: 'Erreur lors de la création de la candidature' }, { status: 500 })
    }

    const app = application as any

    // Get property info for response
    const { data: propertyInfo } = await supabase
      .from('properties')
      .select('id, title, address, city, type, price, currency')
      .eq('id', propertyId)
      .single()

    const { data: propertyImages } = await supabase
      .from('property_images')
      .select('url')
      .eq('property_id', propertyId)
      .order('order', { ascending: true })

    // Notify the property owner ONLY if the tenant's rental file is validated
    const { data: validatedRentalFile } = await supabase
      .from('rental_files')
      .select('id')
      .eq('tenant_id', userId)
      .in('status', ['VALIDATED', 'ACCEPTED'])
      .maybeSingle()

    if (validatedRentalFile) {
      await notify({
        userId: property.owner_id,
        type: 'DOSSIER_UPDATE',
        title: 'Nouvelle candidature',
        message: `Un locataire a soumis une candidature pour votre bien "${propertyInfo?.title || ''}".`,
        actionUrl: 'candidatures',
        entityId: appId,
      })
    }

    // Ensure a conversation between tenant and owner exists from the start,
    // so the owner can always reach the applicant (fixes "Contacter" not
    // creating a conversation before a lease exists).
    await getOrCreateConversation(supabase, userId, property.owner_id, propertyId)

    const resp = NextResponse.json({
      data: {
        id: app.id,
        status: app.status,
        rentalFileId: app.rental_file_id,
        propertyId: app.property_id,
        createdAt: app.created_at,
        updatedAt: app.updated_at,
        property: propertyInfo ? {
          id: propertyInfo.id,
          title: propertyInfo.title,
          address: propertyInfo.address,
          city: propertyInfo.city,
          type: propertyInfo.type,
          price: propertyInfo.price,
          currency: propertyInfo.currency,
          images: (propertyImages || []).slice(0, 1).map(i => ({ url: i.url })),
        } : null,
      },
    })
    return applyCookies(resp)
  } catch (error) {
    console.error('Applications POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId, applyCookies } = await resolveRequestUser(req)
    if (!userId) {
      const resp = NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
      return applyCookies(resp)
    }

    const supabase = getSupabaseAdminClient()

    const profileResult = await supabase
      .from('users')
      .select('role, active_role')
      .eq('id', userId)
      .single()
    const profile = profileResult.data as { role: string; active_role: string } | null
    const effectiveRole = profile?.active_role || profile?.role

    if (effectiveRole !== 'LOCATAIRE') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || undefined
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))

    let query = supabase.from('applications').select('*', { count: 'exact' }).eq('tenant_id', userId)
    if (status) {
      query = query.eq('status', status)
    }
    query = query.order('updated_at', { ascending: false }).range((page - 1) * limit, page * limit - 1)

    const queryResult = await query
    const applications = queryResult.data as any[]
    const total = queryResult.count

    const rentalFileIds = (applications ?? []).map((a: any) => a.rental_file_id).filter(Boolean)

    let documentsMap: Record<string, any[]> = {}
    let leasesMap: Record<string, any[]> = {}
    let reviewedByMap: Record<string, any> = {}
    let appPropMap = new Map<string, any>()
    let appOwnerMap = new Map<string, any>()

    if (rentalFileIds.length > 0) {
      const [docResult, leaseResult] = await Promise.all([
        supabase.from('rental_file_documents').select('*').in('rental_file_id', rentalFileIds).order('created_at', { ascending: false }),
        supabase.from('leases').select('*, property:properties!property_id(*)').in('rental_file_id', rentalFileIds),
      ])

      const docsData = (docResult.data ?? []) as any[]
      for (const doc of docsData) {
        if (!documentsMap[doc.rental_file_id]) documentsMap[doc.rental_file_id] = []
        documentsMap[doc.rental_file_id].push(doc)
      }

      const leasesData = (leaseResult.data ?? []) as any[]
      for (const lease of leasesData) {
        if (!leasesMap[lease.rental_file_id]) leasesMap[lease.rental_file_id] = []
        leasesMap[lease.rental_file_id].push(lease)
      }

      // Also fetch property details directly from applications.property_id (not just leases)
      const appPropertyIds = [...new Set((applications ?? []).map((a: any) => a.property_id).filter(Boolean))]
      const { data: appProperties } = appPropertyIds.length > 0
        ? await supabase
            .from('properties')
            .select('*')
            .in('id', appPropertyIds)
        : { data: [] as any[] }

      appPropMap = new Map((appProperties ?? []).map((p: any) => [p.id, p]))

      // Fetch owner info for direct property references
      const appOwnerIds = [...new Set((appProperties ?? []).map((p: any) => p.owner_id).filter(Boolean))]
      const { data: appOwners } = appOwnerIds.length > 0
        ? await supabase
            .from('users')
            .select('id, first_name, last_name')
            .in('id', appOwnerIds)
        : { data: [] as any[] }
      appOwnerMap = new Map((appOwners ?? []).map((o: any) => [o.id, o]))

      // Fetch images for all relevant properties
      const allPropIds = [...new Set([...appPropertyIds])]
      if (allPropIds.length > 0) {
        const propertyImagesResult = await supabase
          .from('property_images')
          .select('id, url, property_id')
          .in('property_id', allPropIds)
          .order('order', { ascending: true })
        const propertyImages = propertyImagesResult.data as any[]

        const propImageMap: Record<string, any[]> = {}
        for (const img of propertyImages ?? []) {
          if (!propImageMap[img.property_id]) propImageMap[img.property_id] = []
          propImageMap[img.property_id].push(img)
        }

        for (const lease of leasesData) {
          if (lease.property && propImageMap[lease.property_id]) {
            lease.property.images = propImageMap[lease.property_id].slice(0, 1).map((i: any) => ({ url: i.url }))
          }
        }
      }

      const ownerIds = [...new Set(leasesData.map((l: any) => l.owner_id).filter(Boolean))]
      if (ownerIds.length > 0) {
        const ownersResult = await supabase
          .from('users')
          .select('id, first_name, last_name')
          .in('id', ownerIds)
        const owners = ownersResult.data as any[]
        const ownerMap: Record<string, any> = {}
        for (const o of owners ?? []) {
          ownerMap[o.id] = o
        }
        for (const lease of leasesData) {
          if (lease.property && ownerMap[lease.owner_id]) {
            lease.property.owner = {
              id: ownerMap[lease.owner_id].id,
              firstName: ownerMap[lease.owner_id].first_name,
              lastName: ownerMap[lease.owner_id].last_name,
            }
          }
        }
      }

      const reviewedByIds = [...new Set((applications ?? []).map((a: any) => a.reviewed_by_id).filter(Boolean))]
      if (reviewedByIds.length > 0) {
        const reviewersResult = await supabase
          .from('users')
          .select('id, first_name, last_name')
          .in('id', reviewedByIds)
        const reviewers = reviewersResult.data as any[]
        for (const r of reviewers ?? []) {
          reviewedByMap[r.id] = { id: r.id, firstName: r.first_name, lastName: r.last_name }
        }
      }
    }

    const enrichedApplications = (applications ?? []).map((app: any) => {
      const statusTimeline = getStatusTimeline(app.status)
      const leaseProperty = leasesMap[app.rental_file_id]?.[0]?.property
      const directProperty = app.property_id ? appPropMap.get(app.property_id) : null
      const directOwner = directProperty && appOwnerMap.get(directProperty.owner_id)

      // Prefer lease property, fall back to direct property from applications table
      const linkedProperty = leaseProperty ? {
        id: leaseProperty.id,
        title: leaseProperty.title,
        address: leaseProperty.address,
        city: leaseProperty.city,
        type: leaseProperty.type,
        price: leaseProperty.price,
        currency: leaseProperty.currency,
        images: leaseProperty.images || [],
        owner: leaseProperty.owner || null,
      } : directProperty ? {
        id: directProperty.id,
        title: directProperty.title,
        address: directProperty.address,
        city: directProperty.city,
        type: directProperty.type,
        price: directProperty.price,
        currency: directProperty.currency,
        images: [],
        owner: directOwner ? {
          id: directOwner.id,
          firstName: directOwner.first_name,
          lastName: directOwner.last_name,
        } : null,
      } : null

      const docs = documentsMap[app.rental_file_id] || []
      const totalDocs = docs.length
      const validatedDocs = docs.filter((d: any) => d.status === 'VALIDATED').length
      const rejectedDocs = docs.filter((d: any) => d.status === 'REJECTED').length

      return {
        id: app.id,
        status: app.status,
        monthlyIncome: app.monthly_income,
        employer: app.employer,
        employmentType: app.employment_type,
        guarantorName: app.guarantor_name,
        guarantorPhone: app.guarantor_phone,
        guarantorRelation: app.guarantor_relation,
        rejectionReason: app.rejection_reason,
        tcComment: app.tc_comment,
        reviewedAt: app.reviewed_at,
        validUntil: app.valid_until,
        createdAt: app.created_at,
        updatedAt: app.updated_at,
        statusTimeline,
        linkedProperty,
        documentProgress: {
          total: totalDocs,
          validated: validatedDocs,
          rejected: rejectedDocs,
          pending: totalDocs - validatedDocs - rejectedDocs,
        },
        reviewedBy: reviewedByMap[app.reviewed_by_id] || null,
        documents: docs.map((d: any) => ({
          id: d.id,
          type: d.type,
          name: d.name,
          status: d.status,
          createdAt: d.created_at,
        })),
        leases: (leasesMap[app.id] || []).map((l: any) => ({
          id: l.id,
          status: l.status,
          startDate: l.start_date,
          endDate: l.end_date,
          monthlyRent: l.monthly_rent,
          property: l.property ? {
            id: l.property.id,
            title: l.property.title,
            address: l.property.address,
            city: l.property.city,
            type: l.property.type,
            price: l.property.price,
            currency: l.property.currency,
            images: (l.property.images || []).slice(0, 1),
            owner: l.property.owner || null,
          } : null,
        })),
      }
    })

    const allStatusesResult = await supabase
      .from('applications')
      .select('status')
      .eq('tenant_id', userId)
    const allStatuses = allStatusesResult.data as any[]

    const stats: Record<string, number> = {}
    for (const a of allStatuses ?? []) {
      stats[a.status] = (stats[a.status] || 0) + 1
    }

    const resp = NextResponse.json({
      data: enrichedApplications,
      pagination: {
        page,
        limit,
        total: total ?? 0,
        totalPages: Math.ceil((total ?? 0) / limit),
      },
      stats,
    })
    return applyCookies(resp)
  } catch (error) {
    console.error('Applications GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

function getStatusTimeline(currentStatus: string) {
  const steps = [
    { status: 'SUBMITTED', label: 'Soumis' },
    { status: 'TC_REVIEW', label: 'En vérification' },
    { status: 'VALIDATED', label: 'Validé' },
    { status: 'ACCEPTED', label: 'Accepté' },
  ]

  const statusOrder = ['SUBMITTED', 'TC_REVIEW', 'VALIDATED', 'ACCEPTED']
  const currentIndex = statusOrder.indexOf(currentStatus)
  const isRejected = currentStatus === 'REJECTED'
  const isExpired = currentStatus === 'EXPIRED'

  const timelineSteps = steps.map((step, index) => ({
    ...step,
    completed: index < currentIndex,
    active: index === currentIndex,
  }))

  if (isRejected) {
    return timelineSteps.concat([{ status: 'REJECTED', label: 'Rejeté', completed: false, active: true }])
  }

  if (isExpired) {
    return timelineSteps.concat([{ status: 'EXPIRED', label: 'Expiré', completed: false, active: true }])
  }

  return timelineSteps
}
