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
import { actionRequiredReason } from "./actionRequired";

describe("actionRequiredReason", () => {
  it("says why the check couldn't verify the row", () => {
    expect(actionRequiredReason({ verification: "UNVERIFIABLE", verificationReason: "TOKEN_EXPIRED" })).toBe(
      "Couldn't check: their LinkedIn link expired",
    );
    expect(actionRequiredReason({ verification: "UNVERIFIABLE", verificationReason: "SOURCE_NOT_FOUND" })).toBe(
      "Couldn't check: the post isn't on LinkedIn anymore",
    );
  });

  it("falls back for an unverifiable row without a reason, and names a row a PO held back", () => {
    expect(actionRequiredReason({ verification: "UNVERIFIABLE", verificationReason: null })).toBe("Couldn't check it on LinkedIn");
    expect(actionRequiredReason({ verification: null, verificationReason: null })).toBe("Held back by the PO team");
  });
});
