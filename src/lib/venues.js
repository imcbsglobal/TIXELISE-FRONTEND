export function normalizeVenue(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

export function venueKey(value) {
  return normalizeVenue(value).toLowerCase()
}

export function collectVenues(events) {
  const venues = new Map()

  events.forEach((event) => {
    const label = normalizeVenue(event?.venue)
    if (!label) return

    const key = label.toLowerCase()
    if (!venues.has(key)) venues.set(key, label)
  })

  return [...venues.values()].sort((a, b) => a.localeCompare(b))
}
