import { readFile } from "node:fs/promises";

import { parse } from "yaml";

const riskOrder = ["R0", "R1", "R2", "R3"];

export function riskRank(risk) {
  return riskOrder.indexOf(risk);
}

export function requiresRiskEscalation(proposedRisk, requiredRisk) {
  return riskRank(requiredRisk) > riskRank(proposedRisk);
}

export async function loadPolicy(path = ".ai/policy.yaml") {
  return parse(await readFile(path, "utf8"));
}

export function globToRegExp(glob) {
  let pattern = "";
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    if (char === "*" && glob[index + 1] === "*") {
      if (glob[index + 2] === "/") {
        pattern += "(?:.*/)?";
        index += 2;
      } else {
        pattern += ".*";
        index += 1;
      }
    } else if (char === "*") {
      pattern += "[^/]*";
    } else if (char === "?") {
      pattern += "[^/]";
    } else {
      pattern += char.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
    }
  }
  return new RegExp(`^${pattern}$`);
}

export function matchesAny(path, patterns) {
  return patterns.some((pattern) => globToRegExp(pattern).test(path));
}

export function requiredRisk(policy, paths, proposedRisk = "R0") {
  let result = proposedRisk;
  for (const risk of riskOrder) {
    if (paths.some((path) => matchesAny(path, policy.risk_rules[risk] ?? []))) {
      if (riskRank(risk) > riskRank(result)) {
        result = risk;
      }
    }
  }
  return result;
}

export function policyViolations(policy, paths, allowedPaths, risk) {
  const violations = [];
  for (const path of paths) {
    if (!matchesAny(path, allowedPaths)) {
      violations.push({ type: "outside-allowed-paths", path });
    }
    if (
      ["R0", "R1"].includes(risk) &&
      matchesAny(path, policy.protected_paths ?? [])
    ) {
      violations.push({ type: "protected-path", path });
    }
  }
  return violations;
}
