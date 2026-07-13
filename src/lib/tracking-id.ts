/**
 * Initial demo behavior intentionally preserves surrounding whitespace.
 * ADR-0020 uses this boundary as the first automated repair scenario.
 */
export function normalizeTrackingId(trackingId: string): string {
  return trackingId;
}
