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
import type { GeographyStatus } from "../eventsTypes";
import { failureText, freshnessText, sinceText } from "./geography";

const NOW = new Date("2026-11-23T12:00:00Z");
const base: GeographyStatus = {
  synced_at: "2026-11-23T09:00:00Z",
  synced_by: null,
  attempted_at: "2026-11-23T09:00:00Z",
  error: null,
  country_count: 241,
  state_count: 337,
  countries_with_states: [],
  stale: false,
  refresh_hours: 24,
};

describe("sinceText", () => {
  it.each([
    ["2026-11-23T11:59:50Z", "just now"],
    ["2026-11-23T11:59:00Z", "1 minute ago"],
    ["2026-11-23T11:48:00Z", "12 minutes ago"],
    ["2026-11-23T09:00:00Z", "3 hours ago"],
    ["2026-11-21T12:00:00Z", "2 days ago"],
  ])("%s → %s", (iso, text) => expect(sinceText(iso, NOW)).toBe(text));
});

describe("freshness", () => {
  it("says who synced, or that it was automatic", () => {
    expect(freshnessText(base, NOW)).toBe("Synced 3 hours ago automatically.");
    expect(freshnessText({ ...base, synced_by: "admin@example.com" }, NOW)).toBe(
      "Synced 3 hours ago by admin@example.com.",
    );
  });

  it("says when the lists are still the template's", () => {
    expect(freshnessText({ ...base, synced_at: null }, NOW)).toMatch(/template's lists/);
  });
});

describe("failure", () => {
  it("is silent when the last attempt worked", () => {
    expect(failureText(base, NOW)).toBeNull();
  });

  it("names the error and which lists are still in use", () => {
    const text = failureText(
      { ...base, attempted_at: "2026-11-23T11:48:00Z", error: "Couldn't reach Salesforce." },
      NOW,
    );
    expect(text).toBe(
      "The last sync, 12 minutes ago, failed: Couldn't reach Salesforce. The lists from 3 hours ago are still in use.",
    );
  });
});
