// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { describe, expect, it } from "vitest";
import { EMPTY_DRAFT } from "./approval";
import { bucketOf, defaultGate, gateSummaries, sectionsFor } from "./dealSections";
import { detail as makeDetail, field } from "./callInsight.fixtures";
import type { DealField } from "../types";

const f = (key: string, gate: string, overrides: Partial<DealField> = {}) =>
  field({ key, gate, label: key, letters: ["E"], proposal: null, state: "EMPTY", ...overrides });

const fields = [
  f("pendingOne", "Qualify", { state: "SUGGESTED", proposal: { value: "x", rationale: null, confidence: 0.8, evidence: [], pending: true } }),
  f("emptyRequired", "Qualify"),
  f("filled", "Qualify", { state: "FILLED", salesforceValue: "y" }),
  f("emptyOptional", "Qualify", { optional: true }),
  f("notApplicable", "Qualify", { applicable: false }),
  f("filledButWrong", "Qualify", { state: "FILLED", salesforceValue: "No" }),
  f("later", "Technical Proof", { letters: ["DC"] }),
];
const detail = makeDetail({ fields, currentStage: "Qualify", incomplete: ["emptyRequired", "filledButWrong"] });

describe("dealSections", () => {
  it("sorts each field into review, missing, done, optional or not needed", () => {
    const bucket = (key: string) => bucketOf(fields.find((x) => x.key === key)!, detail, EMPTY_DRAFT);
    expect(bucket("pendingOne")).toBe("review");
    expect(bucket("emptyRequired")).toBe("missing");
    expect(bucket("filled")).toBe("done");
    expect(bucket("emptyOptional")).toBe("optional");
    expect(bucket("notApplicable")).toBe("notNeeded");
    // A value that is there but doesn't satisfy the stage still blocks it.
    expect(bucket("filledButWrong")).toBe("missing");
  });

  it("puts a field the AM has edited up for review", () => {
    const draft = { edits: { filled: "z" }, roleMatches: {} };
    expect(bucketOf(fields[2], detail, draft)).toBe("review");
  });

  it("counts what each stage still needs, in gate order", () => {
    expect(gateSummaries(detail, EMPTY_DRAFT)).toEqual([
      { gate: "Qualify", review: 1, missing: 2, done: 1, complete: false },
      { gate: "Technical Proof", review: 0, missing: 1, done: 0, complete: false },
    ]);
  });

  it("scopes to one stage, or to one Letter across every stage", () => {
    expect(sectionsFor(detail, EMPTY_DRAFT, { gate: "Technical Proof" }).missing.map((x) => x.key)).toEqual(["later"]);
    expect(sectionsFor(detail, EMPTY_DRAFT, { letter: "DC" }).missing.map((x) => x.key)).toEqual(["later"]);
  });

  it("opens on the current stage, or the first with work when the current has no fields", () => {
    expect(defaultGate(detail, gateSummaries(detail, EMPTY_DRAFT))).toBe("Qualify");
    const closed = makeDetail({ fields, currentStage: "Closed Won", incomplete: [] });
    expect(defaultGate(closed, gateSummaries(closed, EMPTY_DRAFT))).toBe("Qualify");
  });
});
