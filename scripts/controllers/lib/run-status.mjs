// 【做什么】将 Automation Run 阶段（build/preview/repair/production）映射为面向用户的 Repair Status
// 【说明】库模块，无 CLI 入口；由 record-run.mjs import
const stageStatuses = {
  build: "BUILDING",
  preview: "VERIFYING",
  repair: "REPAIRING",
  production: "RELEASED",
};

////////////////////////////////////////////////////
// 只有阶段成功或明确转人工时才改变面向 Feedback 用户展示的 Repair Status
////////////////////////////////////////////////////
export function repairStatusForRun(stage, state) {
  if (state === "HUMAN_REQUIRED") {
    return "HUMAN_REQUIRED";
  }
  if (state !== "SUCCEEDED") {
    return null;
  }
  return stageStatuses[stage] ?? null;
}
