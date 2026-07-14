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
