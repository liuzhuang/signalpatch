const stageStatuses = {
  build: "BUILDING",
  preview: "VERIFYING",
  repair: "REPAIRING",
  production: "RELEASED",
};

export function repairStatusForRun(stage, state) {
  if (state === "HUMAN_REQUIRED") {
    return "HUMAN_REQUIRED";
  }
  if (state !== "SUCCEEDED") {
    return null;
  }
  return stageStatuses[stage] ?? null;
}
