import { describe, expect, it, vi } from 'vitest'
import { propertySearchSchema, searchActiveProperties } from './property-search'

describe('SUTA read-only property search', () => {
  it('rejects unbounded results and unexpected fields', () => {
    expect(propertySearchSchema.safeParse({ limit: 100 }).success).toBe(false)
    expect(propertySearchSchema.safeParse({ status: 'PENDING_VERIFICATION' }).success).toBe(false)
    expect(propertySearchSchema.safeParse({ commune: 'Cocody', limit: 5 }).success).toBe(true)
  })

  it('only queries active listings and limits results', async () => {
    const calls: Array<[string, unknown]> = []
    const query: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn((...args: [string, unknown]) => { calls.push(args); return query }),
      ilike: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn(async () => ({ data: [{ id: 'one', title: 'Studio', price: 100000 }], error: null })),
    }
    const from = vi.fn(() => query)
    const result = await searchActiveProperties({ commune: 'Cocody', limit: 2 }, { from })
    expect(from).toHaveBeenCalledWith('properties')
    expect(calls).toContainEqual(['status', 'ACTIVE'])
    expect(query.limit).toHaveBeenCalledWith(2)
    expect(result).toHaveLength(1)
  })
})
