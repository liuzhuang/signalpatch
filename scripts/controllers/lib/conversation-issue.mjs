import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import Ajv2020 from "ajv/dist/2020.js";

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
  return {
    version: 1,
    requestId: randomUUID(),
    submittedAt,
    contract: assertConversationContract(contract),
  };
}

export function assertConversationRequest(request) {
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

export function issueBodyForRequest(request) {
  const { contract, requestId } = assertConversationRequest(request);
  return [
    `## Problem\n\n${contract.problemSummary}`,
    `## Actual behavior\n\n${contract.actualBehavior}`,
    `## Expected behavior\n\n${contract.expectedBehavior}`,
    "<!-- signalpatch-contract:start -->",
    "```json",
    JSON.stringify(contract, null, 2),
    "```",
    "<!-- signalpatch-contract:end -->",
    `<!-- signalpatch-conversation-request:${requestId} -->`,
    "_This Issue contains redacted evidence only. Raw conversations are not included._",
  ].join("\n\n");
}

export function issueLabelsForRequest(request) {
  return [
    "ai:ready",
    `risk:${assertConversationRequest(request).contract.riskLevel.toLowerCase()}`,
  ];
}
