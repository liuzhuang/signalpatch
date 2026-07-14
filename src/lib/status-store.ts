import type { RepairStatusRow } from "@/lib/status";
import { getSupabaseClient } from "@/lib/supabase";

////////////////////////////////////////////////////
// 通过允许匿名执行的 get_repair_status RPC 查询最小公开状态，不开放业务表读取权限
////////////////////////////////////////////////////
export async function lookupRepairStatus(
  trackingId: string,
): Promise<RepairStatusRow | null> {
  const { data, error } = await getSupabaseClient()
    .schema("signalpatch")
    .rpc("get_repair_status", { p_tracking_id: trackingId });

  if (error) {
    throw new Error(`Repair Status 查询失败：${error.message}`);
  }

  ////////////////////////////////////////////////////
  // RPC 最多返回一行；没有对应 Tracking ID 时转换为 null 交给 API 返回 404
  ////////////////////////////////////////////////////
  return (data as RepairStatusRow[] | null)?.[0] ?? null;
}
