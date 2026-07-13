import { NextResponse } from "next/server";

import { findRepairStatus } from "@/lib/status";
import { lookupRepairStatus } from "@/lib/status-store";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ trackingId: string }>;
}

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
    console.error("Repair Status lookup failed", error);
    return NextResponse.json(
      { error: "Repair Status 服务暂时不可用" },
      { status: 503 },
    );
  }
}
