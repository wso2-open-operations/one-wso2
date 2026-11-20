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

import { describe, expect, it, vi } from "vitest";
import { fetchStarters, interpretWidget, runWidget, type WidgetSpec } from "./dashboardAgentApi";

vi.mock("@features/security/grc/shim/apiConfig", () => ({ BACKEND_BASE_URL: "http://backend.test" }));

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("fetchStarters", () => {
  it("returns the starters", async () => {
    const authFetch = vi.fn().mockResolvedValue(json(200, { starters: [{ id: "a" }] }));
    expect(await fetchStarters(authFetch)).toEqual([{ id: "a" }]);
    expect(authFetch.mock.calls[0][0]).toBe("http://backend.test/api/v1/risks/dashboard-agent/starters");
  });

  it("returns null for any refusal or failure, so the agent stays hidden", async () => {
    expect(await fetchStarters(vi.fn().mockResolvedValue(json(404, { message: "not found" })))).toBeNull();
    expect(await fetchStarters(vi.fn().mockResolvedValue(json(403, {})))).toBeNull();
    expect(await fetchStarters(vi.fn().mockRejectedValue(new Error("offline")))).toBeNull();
  });
});

describe("the Audit assistant", () => {
  it("talks to the audit endpoints, and the risk assistant to the risk ones", async () => {
    const authFetch = vi.fn().mockImplementation(() => Promise.resolve(json(200, { starters: [], action: "reply", message: "x", columns: [], rows: [] })));
    await fetchStarters(authFetch, "audit");
    await interpretWidget(authFetch, { message: "x", history: [] }, "audit");
    await runWidget(authFetch, { dataset: "controls", measures: ["control_count"], dimensions: [], filters: [], limit: 100 }, "audit");
    expect(authFetch.mock.calls.map((c) => c[0])).toEqual([
      "http://backend.test/api/v1/audits/dashboard-agent/starters",
      "http://backend.test/api/v1/audits/dashboard-agent/interpret",
      "http://backend.test/api/v1/audits/dashboard-agent/query",
    ]);
    authFetch.mockClear();
    await interpretWidget(authFetch, { message: "x", history: [] });
    expect(authFetch.mock.calls[0][0]).toBe("http://backend.test/api/v1/risks/dashboard-agent/interpret");
  });
});

describe("interpretWidget and runWidget", () => {
  it("posts the request and returns the answer", async () => {
    const authFetch = vi.fn().mockResolvedValue(json(200, { action: "clarify", question: "Which?" }));
    const res = await interpretWidget(authFetch, { message: "x", history: [] });
    expect(res).toEqual({ action: "clarify", question: "Which?" });
    const [url, init] = authFetch.mock.calls[0];
    expect(url).toBe("http://backend.test/api/v1/risks/dashboard-agent/interpret");
    expect(JSON.parse(init.body)).toEqual({ message: "x", history: [], current: null });
  });

  it("sends only the spec to run, never anything about access", async () => {
    const spec: WidgetSpec = { dataset: "risks", measures: ["risk_count"], dimensions: [], filters: [], limit: 100 };
    const authFetch = vi.fn().mockResolvedValue(json(200, { columns: [], rows: [], truncated: false }));
    await runWidget(authFetch, spec);
    expect(JSON.parse(authFetch.mock.calls[0][1].body)).toEqual(spec);
  });

  it("raises an error that carries the status", async () => {
    const authFetch = vi.fn().mockResolvedValue(json(429, { message: "slow down" }));
    await expect(runWidget(authFetch, {} as WidgetSpec)).rejects.toMatchObject({ status: 429, message: "slow down" });
  });
});
