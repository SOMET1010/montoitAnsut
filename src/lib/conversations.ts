import type { getSupabaseAdminClient } from '@/lib/supabase/admin'

function generateId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Find the existing 1:1 conversation between two users, or create one.
 * Used wherever a relationship between two parties (candidature, lease...)
 * should guarantee a reachable conversation, instead of leaving "Contacter"
 * buttons to create one lazily (and sometimes fail to).
 */
export async function getOrCreateConversation(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userIdA: string,
  userIdB: string,
  propertyId?: string | null
): Promise<string> {
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .or(`and(participant1_id.eq.${userIdA},participant2_id.eq.${userIdB}),and(participant1_id.eq.${userIdB},participant2_id.eq.${userIdA})`)
    .limit(1)

  if (existing && existing.length > 0) {
    return existing[0].id as string
  }

  const { data: created, error } = await supabase
    .from('conversations')
    .insert({
      id: generateId(),
      participant1_id: userIdA,
      participant2_id: userIdB,
      property_id: propertyId || null,
    } as any)
    .select('id')
    .single()

  if (error) throw error
  return created.id as string
}
