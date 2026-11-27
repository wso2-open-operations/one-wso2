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

// The browser's copy of the SDR-owner rule — worded exactly as the server's
// (invariants.sdr_owner_problems), so nothing changes when review runs.

import { describe, expect, it } from "vitest";
import { normaliseSdr, sdrOwnerHint, sdrOwnerProblem } from "./sdrOwner";

describe("sdr owner", () => {
  it.each(["nadia.sdr@wso2.com", " Nadia.SDR@ChoreoLabs.com ", "a.b+c@wso2.com"])("accepts %s", (v) => {
    expect(sdrOwnerProblem(v)).toBeNull();
  });

  it.each(["nadia@gmail.com", "nadia@wso2.com.evil.io", "nadia@mail.wso2.com", "nadia@wso2", "Nadia <nadia@wso2.com>"])(
    "refuses %s",
    (v) => {
      expect(sdrOwnerProblem(v)).toBe(
        `“${normaliseSdr(v)}” isn’t a WSO2 address. Use the SDR’s @wso2.com or @choreolabs.com email.`,
      );
    },
  );

  it("asks for one when empty", () => {
    expect(sdrOwnerProblem("  ")).toBe(
      "Add the SDR owner — the sales development rep who follows up these leads.",
    );
    expect(sdrOwnerHint("").tone).toBe("plain");
  });

  it("stores lower-case and trimmed", () => {
    expect(normaliseSdr(" Nadia@WSO2.com ")).toBe("nadia@wso2.com");
  });
});
