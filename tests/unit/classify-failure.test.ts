import { describe, expect, it } from "vitest";

import { classifyFailure } from "../../scripts/ai/classify-failure.mjs";

describe("classifyFailure", () => {
  it.each([
    ["ERR_PNPM_NO_SCRIPT Command verify not found", "err_pnpm_no_script"],
    ["npm error Missing script: verify", "missing script:"],
    [
      'ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "verify" not found',
      "err_pnpm_recursive_exec_first_fail: command not found",
    ],
  ])("classifies %s as configuration failure", (log, matched) => {
    expect(classifyFailure(log)).toEqual({
      kind: "configuration",
      matched: [matched],
    });
  });

  it("preserves transient infrastructure failure classification", () => {
    expect(
      classifyFailure("Runner lost communication with the server"),
    ).toEqual({
      kind: "infrastructure",
      matched: ["runner lost communication"],
    });
  });

  it("classifies ordinary test failures as application failures", () => {
    expect(
      classifyFailure("AssertionError: expected false to be true"),
    ).toEqual({
      kind: "application",
      matched: [],
    });
  });

  it("does not treat an arbitrary missing-script phrase as package-manager evidence", () => {
    expect(
      classifyFailure(
        "AssertionError: expected message to contain missing script:",
      ),
    ).toEqual({
      kind: "application",
      matched: [],
    });
  });
});
