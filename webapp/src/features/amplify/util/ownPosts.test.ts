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
  DECLINE_REASONS,
  declineMessageMaxLength,
  declineReasonText,
  OWN_POST_FEATURE_TOP_UP,
  OWN_POST_STATUS_LABELS,
  REVIEW_TABS,
  ownPostAwards,
} from "./ownPosts";
import { REASON_MAX_LENGTH } from "./points";

describe("declineReasonText", () => {
  it("is the chosen reason alone when there is no message", () => {
    expect(declineReasonText("Not about Choreo Labs", "")).toBe("Not about Choreo Labs");
    expect(declineReasonText("Other", "   ")).toBe("Other");
  });

  it("adds the trimmed message after a dash", () => {
    expect(declineReasonText("Already rewarded", "  Paid in October. ")).toBe("Already rewarded — Paid in October.");
  });

  it("leaves room for the message within the API's 1000 characters", () => {
    for (const reason of DECLINE_REASONS) {
      const longest = declineReasonText(reason, "x".repeat(declineMessageMaxLength(reason)));
      expect(longest.length).toBe(REASON_MAX_LENGTH);
    }
  });
});

describe("own post wording", () => {
  it("names each status the way people see it", () => {
    expect(OWN_POST_STATUS_LABELS).toEqual({
      PENDING: "Waiting for review",
      APPROVED: "Approved",
      AMPLIFIED: "Featured",
      REJECTED: "Declined",
    });
  });

  it("features an approved post for the difference between the two rules", () => {
    expect(OWN_POST_FEATURE_TOP_UP).toBe(15);
  });

  it("has one tab per status, Waiting first", () => {
    expect(REVIEW_TABS.map((t) => [t.segment, t.status])).toEqual([
      ["waiting", "PENDING"],
      ["approved", "APPROVED"],
      ["featured", "AMPLIFIED"],
      ["declined", "REJECTED"],
    ]);
  });
});

describe("ownPostAwards", () => {
  it("takes approval and the featured total from the values in force, and the top-up as their difference", () => {
    expect(ownPostAwards({ OWN_POST: 12, OWN_POST_AMPLIFIED: 30 })).toEqual({ approved: 12, featured: 30, topUp: 18 });
  });

  it("falls back to 10, 25 and 15 while the values are unknown", () => {
    expect(ownPostAwards(undefined)).toEqual({ approved: 10, featured: 25, topUp: 15 });
    expect(ownPostAwards({ REPOST: 2 })).toEqual({ approved: 10, featured: 25, topUp: 15 });
  });

  it("falls back per action, and never offers a negative top-up", () => {
    expect(ownPostAwards({ OWN_POST: 20 })).toEqual({ approved: 20, featured: 25, topUp: 5 });
    expect(ownPostAwards({ OWN_POST: 40, OWN_POST_AMPLIFIED: 30 })).toEqual({ approved: 40, featured: 30, topUp: 0 });
  });
});
