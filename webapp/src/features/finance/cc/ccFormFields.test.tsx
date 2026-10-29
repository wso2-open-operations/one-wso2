/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductUnitSelect } from "./ccFormFields";

const productUnits = ["Cloud", "Docs", "Identity"];
const businessUnits = ["Products", "Ops", "Products"];

function renderSelect(value: number | null, onChange = vi.fn()) {
  render(
    <ProductUnitSelect
      value={value}
      onChange={onChange}
      productUnits={productUnits}
      businessUnits={businessUnits}
    />,
  );
  return onChange;
}

describe("ProductUnitSelect", () => {
  it("shows the chosen product unit by name", () => {
    renderSelect(1);
    expect(screen.getByRole("combobox")).toHaveTextContent("Docs");
  });

  it("lists the product units under their business unit headings", () => {
    renderSelect(null);
    fireEvent.mouseDown(screen.getByRole("combobox"));

    // MUI gives a Select's ListSubheader the option role too, so headings and units read in order.
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Products",
      "Cloud",
      "Identity",
      "Ops",
      "Docs",
    ]);
  });

  it("reports the picked product unit by its index in the units list", () => {
    const onChange = renderSelect(null);
    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Identity" }));

    expect(onChange).toHaveBeenCalledWith(2);
  });
});
