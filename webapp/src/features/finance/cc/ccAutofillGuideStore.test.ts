/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { dismissAutofillGuide, isAutofillGuideDismissed } from "./ccAutofillGuideStore";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("ccAutofillGuideStore", () => {
  it("remembers a dismissal per user", () => {
    expect(isAutofillGuideDismissed("sub-jane")).toBe(false);
    dismissAutofillGuide("sub-jane");

    expect(isAutofillGuideDismissed("sub-jane")).toBe(true);
    expect(isAutofillGuideDismissed("sub-john")).toBe(false);
    expect(localStorage.getItem("one-wso2.cc-autofill-guide.v1.sub-jane")).toBe("true");
  });

  it("remembers nothing without a user", () => {
    dismissAutofillGuide(undefined);

    expect(isAutofillGuideDismissed(undefined)).toBe(false);
    expect(localStorage.length).toBe(0);
  });

  it("treats blocked storage as not dismissed", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(isAutofillGuideDismissed("sub-jane")).toBe(false);
    expect(() => dismissAutofillGuide("sub-jane")).not.toThrow();
  });
});
