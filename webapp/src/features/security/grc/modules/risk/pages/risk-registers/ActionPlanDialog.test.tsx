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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ActionPlanDialog from "./ActionPlanDialog";
import { riskDetail } from "./riskDetailFixture";

vi.mock("@features/security/grc/shim/useAuthApiClient", () => ({ useAuthApiClient: () => vi.fn() }));
vi.mock("@features/security/grc/shim/apiConfig", () => ({ BACKEND_BASE_URL: "http://backend.test" }));

const suggestActionPlan = vi.hoisted(() => vi.fn());
vi.mock("../../api/riskApi", async (importActual) => ({
  ...(await importActual<typeof import("../../api/riskApi")>()),
  suggestActionPlan,
}));

beforeEach(() => suggestActionPlan.mockReset());

describe("ActionPlanDialog", () => {
  it("gives the description textarea the accessible name Action Plan Description", () => {
    render(<ActionPlanDialog open onClose={vi.fn()} onConfirm={vi.fn()} riskDetail={riskDetail()} />);

    const field = screen.getByRole("textbox", { name: "Action Plan Description" });
    expect(field.tagName).toBe("TEXTAREA");
  });

  it("lets the user apply the suggestion again after editing the text it filled in", async () => {
    suggestActionPlan.mockResolvedValue({ description: "Rotate the keys.", reason: "r", confidence: "high" });
    const detail = riskDetail({ risk_categories: [{ id: 7, name: "Secrets", description: null }] });
    render(<ActionPlanDialog open onClose={vi.fn()} onConfirm={vi.fn()} riskDetail={detail} />);

    await userEvent.click(screen.getByRole("button", { name: "Generate Action Description" }));
    await userEvent.click(await screen.findByRole("button", { name: "Use this suggestion" }));
    expect(screen.getByRole("button", { name: "Suggestion in use" })).toBeDisabled();

    await userEvent.type(screen.getByRole("textbox", { name: "Action Plan Description" }), " Also rotate tokens.");

    expect(screen.getByRole("button", { name: "Use this suggestion" })).toBeEnabled();
  });
});
