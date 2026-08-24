import 'server-only'

// ─── Azure Maps client ────────────────────────────────────────────────────────
// Used by SUTA to geocode a place name and render a small static map image.
// Biased to Côte d'Ivoire / Abidjan since that's the only market Mon Toit
// operates in. No-ops with a clear error if the key isn't configured yet.

const AZURE_MAPS_BASE_URL = 'https://atlas.microsoft.com'
const ABIDJAN_CENTER = { lat: 5.3600, lon: -4.0083 }

function getSubscriptionKey(): string {
  const key = process.env.AZURE_MAPS_SUBSCRIPTION_KEY
  if (!key) {
    throw new Error('Azure Maps non configuré. Vérifiez AZURE_MAPS_SUBSCRIPTION_KEY.')
  }
  return key
}

export function isAzureMapsConfigured(): boolean {
  return !!process.env.AZURE_MAPS_SUBSCRIPTION_KEY
}

export interface GeocodedLocation {
  lat: number
  lon: number
  formattedAddress: string
}

/**
 * Resolve a free-text place name (commune, quartier, adresse) to
 * coordinates, biased around Abidjan.
 */
export async function geocodeLocation(query: string): Promise<GeocodedLocation | null> {
  const key = getSubscriptionKey()

  const url = new URL(`${AZURE_MAPS_BASE_URL}/search/address/json`)
  url.searchParams.set('api-version', '1.0')
  url.searchParams.set('subscription-key', key)
  url.searchParams.set('query', `${query}, Abidjan, Côte d'Ivoire`)
  url.searchParams.set('countrySet', 'CI')
  url.searchParams.set('lat', String(ABIDJAN_CENTER.lat))
  url.searchParams.set('lon', String(ABIDJAN_CENTER.lon))
  url.searchParams.set('radius', '100000')
  url.searchParams.set('limit', '1')

  const response = await fetch(url.toString())
  if (!response.ok) {
    console.error('[Azure Maps] Geocoding failed:', response.status, await response.text().catch(() => ''))
    return null
  }

  const data = await response.json()
  const result = data?.results?.[0]
  if (!result?.position) return null

  return {
    lat: result.position.lat,
    lon: result.position.lon,
    formattedAddress: result.address?.freeformAddress || query,
  }
}

/**
 * Render a small static map image (PNG) centered on a point, with a pin.
 * Returns a base64 data URL so the subscription key never reaches the
 * client — the frontend only ever sees the finished image.
 */
export async function getStaticMapImageDataUrl(
  lat: number,
  lon: number,
  opts: { width?: number; height?: number; zoom?: number } = {}
): Promise<string> {
  const key = getSubscriptionKey()
  const { width = 480, height = 300, zoom = 13 } = opts

  const url = new URL(`${AZURE_MAPS_BASE_URL}/map/static/png`)
  url.searchParams.set('api-version', '1.0')
  url.searchParams.set('subscription-key', key)
  url.searchParams.set('layer', 'basic')
  url.searchParams.set('style', 'main')
  url.searchParams.set('zoom', String(zoom))
  url.searchParams.set('center', `${lon},${lat}`)
  url.searchParams.set('width', String(width))
  url.searchParams.set('height', String(height))
  url.searchParams.set('pins', `default|co${'FF6C2F'}||'${lon} ${lat}'`)

  const response = await fetch(url.toString())
  if (!response.ok) {
    console.error('[Azure Maps] Static image failed:', response.status, await response.text().catch(() => ''))
    throw new Error('Impossible de générer la carte')
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  return `data:image/png;base64,${buffer.toString('base64')}`
}
