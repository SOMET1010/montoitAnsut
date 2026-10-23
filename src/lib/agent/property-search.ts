import { z } from 'zod'

export const propertySearchSchema = z.object({
  commune: z.string().trim().min(1).max(80).regex(/^[\p{L}\p{M}0-9 '\-]+$/u).optional(),
  type: z.enum(['APPARTEMENT', 'MAISON', 'STUDIO', 'DUPLEX', 'PENTHOUSE', 'VILLA']).optional(),
  prix_max_fcfa: z.number().int().positive().max(100_000_000).optional(),
  chambres_min: z.number().int().min(0).max(20).optional(),
  meuble: z.boolean().optional(),
  limit: z.number().int().min(1).max(5).default(5),
}).strict()

export type PropertySearchInput = z.input<typeof propertySearchSchema>

export async function searchActiveProperties(
  input: PropertySearchInput,
  client: { from: (table: string) => any },
) {
  const filters = propertySearchSchema.parse(input)
  let query = client.from('properties')
    .select('id,title,commune,city,price,type,bedrooms,is_furnished')
    .eq('status', 'ACTIVE')
    .eq('rental_status', 'AVAILABLE')
  if (filters.commune) query = query.ilike('commune', filters.commune)
  if (filters.type) query = query.eq('type', filters.type)
  if (filters.prix_max_fcfa !== undefined) query = query.lte('price', filters.prix_max_fcfa)
  if (filters.chambres_min !== undefined) query = query.gte('bedrooms', filters.chambres_min)
  if (filters.meuble !== undefined) query = query.eq('is_furnished', filters.meuble)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(filters.limit)
  if (error) throw new Error('Recherche immobilière indisponible')
  return (data ?? []).map((property: any) => ({
    id: property.id,
    title: property.title,
    commune: property.commune,
    city: property.city,
    priceFcfa: property.price,
    type: property.type,
    bedrooms: property.bedrooms,
    furnished: property.is_furnished,
  }))
}
