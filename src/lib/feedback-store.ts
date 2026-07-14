import type { FeedbackInput } from "@/lib/feedback";
import { getSupabaseClient } from "@/lib/supabase";

////////////////////////////////////////////////////
// submit_feedback RPC 返回数据库生成的不可预测 Tracking ID 与初始 Repair Status
////////////////////////////////////////////////////
interface SubmitFeedbackRow {
  tracking_id: string;
  repair_status: string;
  created_at: string;
}

////////////////////////////////////////////////////
// 应用不直接写 feedback 表，只调用允许匿名执行的受限 RPC；smoke-test 数据会被标记为 synthetic
////////////////////////////////////////////////////
export async function submitFeedback(input: FeedbackInput) {
  const { data, error } = await getSupabaseClient()
    .schema("signalpatch")
    .rpc("submit_feedback", {
      p_message: input.message,
      p_context: input.context,
      p_synthetic: input.context.feature === "smoke-test",
    });

  if (error) {
    throw new Error(`Feedback 写入失败：${error.message}`);
  }

  ////////////////////////////////////////////////////
  // RPC 必须返回一行结果；空结果视为写入协议异常，不能伪造成功响应
  ////////////////////////////////////////////////////
  const row = (data as SubmitFeedbackRow[] | null)?.[0];
  if (!row) {
    throw new Error("Feedback 写入后未返回 Tracking ID");
  }

  return {
    trackingId: row.tracking_id,
    repairStatus: row.repair_status,
    submittedAt: row.created_at,
  };
}
