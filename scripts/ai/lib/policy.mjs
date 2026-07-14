import { readFile } from "node:fs/promises";

import { parse } from "yaml";

const riskOrder = ["R0", "R1", "R2", "R3"];

////////////////////////////////////////////////////
// 风险数组的顺序同时定义等级高低，所有比较都通过同一排名完成
////////////////////////////////////////////////////
export function riskRank(risk) {
  return riskOrder.indexOf(risk);
}

export function requiresRiskEscalation(proposedRisk, requiredRisk) {
  return riskRank(requiredRisk) > riskRank(proposedRisk);
}

export async function loadPolicy(path = ".ai/policy.yaml") {
  return parse(await readFile(path, "utf8"));
}

////////////////////////////////////////////////////
// 把策略中的 **、* 和 ? 转成路径正则，匹配语义与目录边界保持一致
////////////////////////////////////////////////////
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

  ////////////////////////////////////////////////////
  // 从模型建议等级开始逐级扫描规则，只保留更高风险的命中结果
  ////////////////////////////////////////////////////
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

  ////////////////////////////////////////////////////
  // 所有风险都受 Contract 路径限制；R0 和 R1 还不能修改策略保护路径
  ////////////////////////////////////////////////////
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
