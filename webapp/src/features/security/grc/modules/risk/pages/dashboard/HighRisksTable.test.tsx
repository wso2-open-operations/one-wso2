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

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import type { HighRiskItem } from "../../api/riskApi";
import HighRisksTable from "./HighRisksTable";

const risks = (prefix: string, count: number): HighRiskItem[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    risk_code: `${prefix}-${i + 1}`,
    risk_title: `${prefix} risk ${i + 1}`,
    register_name: "Register",
    owner_name: "Owner",
    identified_date: null,
    treatment_strategy: null,
    implementation_date: null,
  }));

describe("HighRisksTable", () => {
  it("returns to the first page when the risks change", async () => {
    const { rerender } = render(<HighRisksTable data={risks("Old", 7)} />, { wrapper: MemoryRouter });
    await userEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(screen.getByText("Old risk 6")).toBeInTheDocument();

    rerender(<HighRisksTable data={risks("New", 7)} />);

    expect(screen.getByText("New risk 1")).toBeInTheDocument();
    expect(screen.queryByText("New risk 6")).not.toBeInTheDocument();
  });
});
