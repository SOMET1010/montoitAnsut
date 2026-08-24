import 'server-only'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { geocodeLocation, getStaticMapImageDataUrl, isAzureMapsConfigured } from '@/lib/azure-maps'
import type { AzureToolDefinition } from '@/lib/azure-openai'

// ─── Tool definitions exposed to the model ───────────────────────────────────

export const SUTA_TOOLS: AzureToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'search_properties',
      description: 'Recherche des biens immobiliers disponibles sur Mon Toit selon des critères. Utilise cet outil dès que l\'utilisateur décrit un bien qu\'il cherche (type, commune, budget...).',
      parameters: {
        type: 'object',
        properties: {
          commune: { type: 'string', description: 'Commune ou quartier d\'Abidjan, ex: Cocody' },
          type: { type: 'string', enum: ['APPARTEMENT', 'MAISON', 'STUDIO', 'DUPLEX', 'PENTHOUSE', 'VILLA'] },
          minPrice: { type: 'number', description: 'Loyer minimum en FCFA/mois' },
          maxPrice: { type: 'number', description: 'Loyer maximum en FCFA/mois' },
          minBedrooms: { type: 'number', description: 'Nombre de pièces minimum' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_location_map',
      description: 'Affiche une carte d\'une localité (commune, quartier) dans le chat. Utilise cet outil quand l\'utilisateur demande à voir où se trouve un quartier ou un bien.',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'Nom du lieu à afficher, ex: "Cocody Riviera"' },
        },
        required: ['location'],
      },
    },
  },
]

// ─── Result types returned to the frontend alongside the text answer ────────

export interface PropertyResultCard {
  id: string
  title: string
  price: number
  commune: string | null
  city: string
  type: string
  bedrooms: number | null
  area: number
  image: string | null
}

export interface ToolSideEffects {
  properties?: PropertyResultCard[]
  mapImage?: string | null
  mapLabel?: string | null
}

// ─── Tool execution ───────────────────────────────────────────────────────────

async function executeSearchProperties(args: {
  commune?: string
  type?: string
  minPrice?: number
  maxPrice?: number
  minBedrooms?: number
}): Promise<{ resultForModel: string; sideEffects: ToolSideEffects }> {
  const supabase = getSupabaseAdminClient()

  let query = supabase
    .from('properties')
    .select('id, title, price, commune, city, type, bedrooms, area, property_images(url, order)')
    .eq('status', 'ACTIVE')
    .eq('rental_status', 'disponible')
    .order('created_at', { ascending: false })
    .limit(5)

  if (args.commune) query = query.ilike('commune', `%${args.commune}%`)
  if (args.type) query = query.eq('type', args.type)
  if (args.minPrice) query = query.gte('price', args.minPrice)
  if (args.maxPrice) query = query.lte('price', args.maxPrice)
  if (args.minBedrooms) query = query.gte('bedrooms', args.minBedrooms)

  const { data, error } = await query
  if (error) {
    console.error('[SUTA search_properties]', error)
    return { resultForModel: 'Erreur lors de la recherche de biens.', sideEffects: {} }
  }

  const results = (data ?? []) as any[]
  const cards: PropertyResultCard[] = results.map((p) => ({
    id: p.id,
    title: p.title,
    price: p.price,
    commune: p.commune,
    city: p.city,
    type: p.type,
    bedrooms: p.bedrooms,
    area: p.area,
    image: (p.property_images || []).sort((a: any, b: any) => a.order - b.order)[0]?.url || null,
  }))

  const resultForModel = cards.length === 0
    ? 'Aucun bien disponible ne correspond à ces critères actuellement.'
    : `${cards.length} bien(s) trouvé(s) : ${cards.map((c) => `${c.title} (${c.type}, ${c.commune || c.city}, ${c.price.toLocaleString('fr-FR')} FCFA/mois)`).join(' ; ')}`

  return { resultForModel, sideEffects: { properties: cards } }
}

async function executeShowLocationMap(args: { location?: string }): Promise<{ resultForModel: string; sideEffects: ToolSideEffects }> {
  if (!args.location) {
    return { resultForModel: 'Aucune localité précisée.', sideEffects: {} }
  }

  if (!isAzureMapsConfigured()) {
    return { resultForModel: 'La carte n\'est pas disponible pour le moment (service non configuré).', sideEffects: {} }
  }

  try {
    const geocoded = await geocodeLocation(args.location)
    if (!geocoded) {
      return { resultForModel: `Localité "${args.location}" introuvable.`, sideEffects: {} }
    }

    const mapImage = await getStaticMapImageDataUrl(geocoded.lat, geocoded.lon)
    return {
      resultForModel: `Carte affichée pour ${geocoded.formattedAddress}.`,
      sideEffects: { mapImage, mapLabel: geocoded.formattedAddress },
    }
  } catch (error) {
    console.error('[SUTA show_location_map]', error)
    return { resultForModel: 'Impossible d\'afficher la carte pour le moment.', sideEffects: {} }
  }
}

export async function executeSutaTool(
  name: string,
  argsJson: string
): Promise<{ resultForModel: string; sideEffects: ToolSideEffects }> {
  let args: Record<string, unknown> = {}
  try {
    args = JSON.parse(argsJson || '{}')
  } catch {
    // malformed arguments — proceed with empty args, handlers validate what they need
  }

  switch (name) {
    case 'search_properties':
      return executeSearchProperties(args)
    case 'show_location_map':
      return executeShowLocationMap(args)
    default:
      return { resultForModel: `Outil inconnu : ${name}`, sideEffects: {} }
  }
}
