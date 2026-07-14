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

////////////////////////////////////////////////////
// 查询函数通过参数注入存储实现，先统一规范化 Tracking ID，再把数据库字段转换为公开响应字段
////////////////////////////////////////////////////
export async function findRepairStatus(
  trackingId: string,
  lookup: (normalizedTrackingId: string) => Promise<RepairStatusRow | null>,
): Promise<PublicRepairStatus | null> {
  const normalizedTrackingId = normalizeTrackingId(trackingId);
  const row = await lookup(normalizedTrackingId);
  if (!row) {
    return null;
  }

  ////////////////////////////////////////////////////
  // 响应返回实际用于查询的规范化 ID，保证原始 ID 与带首尾空白的 ID 得到完全一致的结果
  ////////////////////////////////////////////////////
  return {
    trackingId: normalizedTrackingId,
    repairStatus: row.repair_status,
    updatedAt: row.updated_at,
  };
}
