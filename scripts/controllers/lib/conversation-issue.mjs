// 【做什么】对话来源 Issue Contract/Request 的 Schema 校验与 GitHub Issue Body 生成
// 【说明】库模块，无 CLI 入口；被 enqueue-conversation-issue、publish-conversation-issues import
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import Ajv2020 from "ajv/dist/2020.js";

////////////////////////////////////////////////////
// 模块加载时编译统一 Issue Contract Schema，后续入队和发布共用同一校验器
////////////////////////////////////////////////////
const issueContractSchema = JSON.parse(
  await readFile(
    new URL("../../../.ai/schemas/issue-contract.schema.json", import.meta.url),
    "utf8",
  ),
);
const validateIssueContract = new Ajv2020({
  allErrors: true,
  strict: true,
}).compile(issueContractSchema);
const confirmationReference = "conversation:explicit-user-confirmation";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function failure(message) {
  throw new Error(`Invalid conversation issue request: ${message}`);
}

////////////////////////////////////////////////////
// 对话来源除 Schema 合法外，还必须带唯一且固定的显式用户确认引用
////////////////////////////////////////////////////
export function assertConversationContract(contract) {
  if (!validateIssueContract(contract)) {
    failure(
      validateIssueContract.errors
        .map((error) => `${error.instancePath || "/"} ${error.message}`)
        .join("; "),
    );
  }
  if (contract.source.kind !== "codex-conversation") {
    failure("source.kind must be codex-conversation");
  }
  if (
    contract.source.references.length !== 1 ||
    contract.source.references[0] !== confirmationReference
  ) {
    failure("explicit user confirmation is required");
  }
  return contract;
}

export function newConversationRequest(
  contract,
  submittedAt = new Date().toISOString(),
) {
  ////////////////////////////////////////////////////
  // 为每次已确认 Contract 生成独立请求 ID，供本地队列和 GitHub 发布防重
  ////////////////////////////////////////////////////
  return {
    version: 1,
    requestId: randomUUID(),
    submittedAt,
    contract: assertConversationContract(contract),
  };
}

export function assertConversationRequest(request) {
  ////////////////////////////////////////////////////
  // 发布器不信任队列文件，因此重新检查封装版本、UUID、时间和内层 Contract
  ////////////////////////////////////////////////////
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    failure("request must be an object");
  }
  if (request.version !== 1) {
    failure("version must be 1");
  }
  if (
    typeof request.requestId !== "string" ||
    !uuidPattern.test(request.requestId)
  ) {
    failure("requestId must be a UUID");
  }
  if (
    typeof request.submittedAt !== "string" ||
    Number.isNaN(Date.parse(request.submittedAt))
  ) {
    failure("submittedAt must be an ISO timestamp");
  }
  assertConversationContract(request.contract);
  return request;
}
