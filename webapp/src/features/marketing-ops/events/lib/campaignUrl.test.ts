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
import { campaignUrlHint } from "./campaignUrl";

const URL = "https://wso2.lightning.force.com/lightning/r/Campaign/701VM00000wKhfJYAS/view";

describe("campaignUrlHint", () => {
  it("asks for a URL when there is none", () => {
    expect(campaignUrlHint("  ").tone).toBe("plain");
  });

  it("refuses a link with no campaign ID before asking Salesforce", () => {
    expect(campaignUrlHint("https://example.com/report/00O1").tone).toBe("error");
  });

  it("says it is checking while Salesforce is asked", () => {
    expect(campaignUrlHint(URL, { checking: true }).text).toMatch(/checking Salesforce/);
  });

  it("names the campaign Salesforce found, and flags an inactive one", () => {
    const hint = campaignUrlHint(URL, {
      checking: false,
      check: {
        result: "found",
        campaign: { id: "701VM00000wKhfJYAS", name: "DSI Forum Tunisia 2026", status: "Completed", isActive: false },
      },
    });
    expect(hint).toEqual({ tone: "ok", text: "DSI Forum Tunisia 2026 · Completed, inactive — added to every row." });
  });

  it("refuses a campaign Salesforce doesn't have", () => {
    const hint = campaignUrlHint(URL, { checking: false, check: { result: "not_found" } });
    expect(hint.tone).toBe("error");
    expect(hint.text).toMatch(/no campaign with ID 701VM00000wKhfJYAS/);
  });

  it("never reads an unreachable Salesforce as a missing campaign", () => {
    expect(campaignUrlHint(URL, { checking: false, check: { result: "unavailable" } }).tone).toBe("plain");
    expect(campaignUrlHint(URL, { checking: false }).tone).toBe("plain");
  });
});
