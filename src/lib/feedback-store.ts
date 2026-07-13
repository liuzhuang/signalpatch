import type { FeedbackInput } from "@/lib/feedback";
import { getSupabaseClient } from "@/lib/supabase";

interface SubmitFeedbackRow {
  tracking_id: string;
  repair_status: string;
  created_at: string;
}

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
