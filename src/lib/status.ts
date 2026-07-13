import { normalizeTrackingId } from "@/lib/tracking-id";

export interface RepairStatusRow {
  repair_status: string;
  updated_at: string;
}

export interface PublicRepairStatus {
  trackingId: string;
  repairStatus: string;
  updatedAt: string;
}

export async function findRepairStatus(
  trackingId: string,
  lookup: (normalizedTrackingId: string) => Promise<RepairStatusRow | null>,
): Promise<PublicRepairStatus | null> {
  const normalizedTrackingId = normalizeTrackingId(trackingId);
  const row = await lookup(normalizedTrackingId);
  if (!row) {
    return null;
  }

  return {
    trackingId: normalizedTrackingId,
    repairStatus: row.repair_status,
    updatedAt: row.updated_at,
  };
}
