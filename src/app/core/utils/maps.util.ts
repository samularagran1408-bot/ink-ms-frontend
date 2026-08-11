export interface EventPlaceLocation {
  address: string;
  latitude: number | null;
  longitude: number | null;
}

/** URL de indicaciones en Google Maps (app o web). */
export function googleMapsDirectionsUrl(location: {
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): string | null {
  const lat = location.latitude;
  const lng = location.longitude;
  if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  const address = location.location?.trim();
  if (!address) {
    return null;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

export function googleMapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
