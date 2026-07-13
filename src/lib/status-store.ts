import type { RepairStatusRow } from "@/lib/status";
import { getSupabaseClient } from "@/lib/supabase";

export async function lookupRepairStatus(
  trackingId: string,
): Promise<RepairStatusRow | null> {
  const { data, error } = await getSupabaseClient()
    .schema("signalpatch")
    .rpc("get_repair_status", { p_tracking_id: trackingId });

  if (error) {
    throw new Error(`Repair Status 查询失败：${error.message}`);
  }

  return (data as RepairStatusRow[] | null)?.[0] ?? null;
}
