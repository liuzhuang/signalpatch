import { NextResponse } from "next/server";

import { findRepairStatus } from "@/lib/status";
import { lookupRepairStatus } from "@/lib/status-store";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ trackingId: string }>;
}

////////////////////////////////////////////////////
// 从动态路由取得 Tracking ID，经统一规范化后调用受限查询；未命中与服务故障使用不同状态码
////////////////////////////////////////////////////
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { trackingId } = await context.params;
    const status = await findRepairStatus(trackingId, lookupRepairStatus);
    if (!status) {
      return NextResponse.json(
        { error: "未找到对应 Tracking ID" },
        { status: 404 },
      );
    }
    return NextResponse.json(status);
  } catch (error) {
    ////////////////////////////////////////////////////
    // Supabase 或运行时异常只写服务端日志，对外隐藏底层错误并返回 503
    ////////////////////////////////////////////////////
    console.error("Repair Status lookup failed", error);
    return NextResponse.json(
      { error: "Repair Status 服务暂时不可用" },
      { status: 503 },
    );
  }
}
