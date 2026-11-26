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
import {
  REMOVED_AFTER_REVIEW,
  canRemove,
  employeeReason,
  removalReady,
  removalReasonLabel,
  removalRowText,
} from "./removal";

describe("removing an invalid activity", () => {
  it("is offered only on an engagement award that still stands", () => {
    expect(canRemove({ sourceType: "ENGAGEMENT", reversedBy: null })).toBe(true);
    expect(canRemove({ sourceType: "ENGAGEMENT", reversedBy: "REV-1" })).toBe(false);
    expect(canRemove({ sourceType: "EXTERNAL_SHARE", reversedBy: null })).toBe(false);
    expect(canRemove({ sourceType: "ADJUSTMENT", reversedBy: null })).toBe(false);
    expect(canRemove({ sourceType: "REVERSAL", reversedBy: null })).toBe(false);
  });

  it("needs a reason, and a note for Other", () => {
    expect(removalReady("", "")).toBe(false);
    expect(removalReady("SPAM", "")).toBe(true);
    expect(removalReady("OTHER", "  ")).toBe(false);
    expect(removalReady("OTHER", "Posted from a test account")).toBe(true);
  });

  it("labels the codes", () => {
    expect(removalReasonLabel("NOT_A_REAL_REPOST")).toBe("Not a real repost");
  });

  it("shows the PO team the reason and note on a removal row", () => {
    expect(removalRowText({ removalReason: "DUPLICATE", reason: "Same repost twice" })).toBe(
      "Removed: Duplicate — Same repost twice",
    );
    expect(removalRowText({ removalReason: "SPAM", reason: null })).toBe("Removed: Spam");
    expect(removalRowText({ removalReason: "SPAM", reason: REMOVED_AFTER_REVIEW })).toBe("Removed: Spam");
    expect(removalRowText({ removalReason: null, reason: "Duplicate of another activity" })).toBeUndefined();
  });

  it("shows the employee only the neutral label", () => {
    expect(employeeReason({ removalReason: "SPAM", reason: "Looks automated" })).toBe(REMOVED_AFTER_REVIEW);
    expect(employeeReason({ removalReason: null, reason: REMOVED_AFTER_REVIEW })).toBe(REMOVED_AFTER_REVIEW);
    expect(employeeReason({ removalReason: null, reason: "Missed activity" })).toBe("Missed activity");
    expect(employeeReason({ removalReason: null, reason: " " })).toBeUndefined();
  });
});
