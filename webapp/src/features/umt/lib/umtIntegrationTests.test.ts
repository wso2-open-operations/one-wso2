// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { describe, expect, it } from "vitest";
import type { UmtUpdateProduct } from "../api/umtUpdates";
import {
  isIntegrationTestsComplete,
  isIntegrationTestsSaveDisabled,
  umtProductHasIntegrationTestInfo,
} from "./umtIntegrationTests";

function product(testPr: string | null | undefined, ignoreTestReason: string | null | undefined): UmtUpdateProduct {
  return { productId: 1, testPr, ignoreTestReason };
}

describe("umtProductHasIntegrationTestInfo", () => {
  it("is true with a non-blank Test PR", () => {
    expect(umtProductHasIntegrationTestInfo(product("https://github.com/wso2/x/pull/1", null))).toBe(true);
  });

  it("is true with a non-blank Ignore Test Reason", () => {
    expect(umtProductHasIntegrationTestInfo(product(null, "No test needed"))).toBe(true);
  });

  it("is false when both are missing or whitespace-only", () => {
    expect(umtProductHasIntegrationTestInfo(product(null, null))).toBe(false);
    expect(umtProductHasIntegrationTestInfo(product("   ", "   "))).toBe(false);
  });
});

describe("isIntegrationTestsComplete", () => {
  // Deliberately the OPPOSITE convention from isDescriptionInstructionComplete's
  // empty-list handling: this gate (products.every/products.some) never
  // evaluates anything with no products, so vacuous-true is correct here —
  // but the Description/Instruction gate explicitly disables Proceed for an
  // empty product list. Do not "harmonise" these two — they are
  // intentionally different checks.
  it("is vacuously true for an empty, null, or undefined product list (non-containerized)", () => {
    expect(isIntegrationTestsComplete([], false)).toBe(true);
    expect(isIntegrationTestsComplete(null, false)).toBe(true);
    expect(isIntegrationTestsComplete(undefined, false)).toBe(true);
  });

  it("is true when every product has a Test PR or an ignore reason", () => {
    expect(
      isIntegrationTestsComplete(
        [product("https://github.com/wso2/x/pull/1", null), product(null, "Skipping")],
        false,
      ),
    ).toBe(true);
  });

  it("is false when one product among several has neither", () => {
    expect(
      isIntegrationTestsComplete([product("https://github.com/wso2/x/pull/1", null), product(null, null)], false),
    ).toBe(false);
  });

  it("containerized: true only when the first product's helmChartTag is non-blank", () => {
    expect(isIntegrationTestsComplete([{ productId: 1, helmChartTag: "v1.0.0" }], true)).toBe(true);
    expect(isIntegrationTestsComplete([{ productId: 1, helmChartTag: "  " }], true)).toBe(false);
    expect(isIntegrationTestsComplete([{ productId: 1 }], true)).toBe(false);
  });

  it("containerized: is vacuously true for an empty, null, or undefined product list, mirroring legacy's products.every/products.some callers which never evaluate the Helm Chart Tag with no products", () => {
    expect(isIntegrationTestsComplete([], true)).toBe(true);
    expect(isIntegrationTestsComplete(null, true)).toBe(true);
    expect(isIntegrationTestsComplete(undefined, true)).toBe(true);
  });
});

describe("isIntegrationTestsSaveDisabled", () => {
  it("is disabled when there are no unsaved edits", () => {
    expect(
      isIntegrationTestsSaveDisabled({ isDirty: false, isContainerizedUpdate: false, helmChartTag: "", rows: [] }),
    ).toBe(true);
  });

  it("containerized: disabled until the Helm Chart Tag draft is non-blank", () => {
    expect(
      isIntegrationTestsSaveDisabled({ isDirty: true, isContainerizedUpdate: true, helmChartTag: "  ", rows: [] }),
    ).toBe(true);
    expect(
      isIntegrationTestsSaveDisabled({ isDirty: true, isContainerizedUpdate: true, helmChartTag: "v1.0.0", rows: [] }),
    ).toBe(false);
  });

  it("non-containerized: disabled when a non-ignored row has a blank Test PR", () => {
    expect(
      isIntegrationTestsSaveDisabled({
        isDirty: true,
        isContainerizedUpdate: false,
        helmChartTag: "",
        rows: [{ testPr: "", isIgnored: false, ignoreReason: "" }],
      }),
    ).toBe(true);
  });

  it("non-containerized: disabled when an ignored row has a blank reason", () => {
    expect(
      isIntegrationTestsSaveDisabled({
        isDirty: true,
        isContainerizedUpdate: false,
        helmChartTag: "",
        rows: [{ testPr: "", isIgnored: true, ignoreReason: "" }],
      }),
    ).toBe(true);
  });

  it("non-containerized: enabled once every row is valid", () => {
    expect(
      isIntegrationTestsSaveDisabled({
        isDirty: true,
        isContainerizedUpdate: false,
        helmChartTag: "",
        rows: [
          { testPr: "https://github.com/wso2/x/pull/1", isIgnored: false, ignoreReason: "" },
          { testPr: "", isIgnored: true, ignoreReason: "Skipping" },
        ],
      }),
    ).toBe(false);
  });
});
