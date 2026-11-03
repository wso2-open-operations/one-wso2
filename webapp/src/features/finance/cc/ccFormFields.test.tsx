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
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProductUnitSelect, SearchableSelect } from "./ccFormFields";

const productUnits = ["Cloud", "Docs", "Identity"];
const businessUnits = ["Products", "Ops", "Products"];

function renderSelect(
  value: number | null,
  onChange = vi.fn(),
  unavailable?: { productUnit: string; businessUnit: string },
) {
  render(
    <ProductUnitSelect
      value={value}
      onChange={onChange}
      productUnits={productUnits}
      businessUnits={businessUnits}
      unavailable={unavailable}
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

// A stored value the menus no longer offer, as on an outdated autofill rule.
describe("ProductUnitSelect with a pair no longer offered", () => {
  const gone = { productUnit: "Legacy", businessUnit: "Retired" };

  it("shows the stored pair as picked, marked as an error", () => {
    renderSelect(null, vi.fn(), gone);
    const select = screen.getByRole("combobox");
    expect(select).toHaveTextContent("Legacy");
    expect(select.closest(".MuiInputBase-root")).toHaveClass("Mui-error");
  });

  it("lists it first, apart from the units offered", () => {
    renderSelect(null, vi.fn(), gone);
    fireEvent.mouseDown(screen.getByRole("combobox"));

    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options[0]).toHaveTextContent("Legacy · Retired");
    expect(options[0]).toHaveTextContent("No longer offered");
  });

  it("reports a current unit once one is picked", () => {
    const onChange = renderSelect(null, vi.fn(), gone);
    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Docs" }));

    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("shows a current pick normally", () => {
    renderSelect(1, vi.fn(), gone);
    const select = screen.getByRole("combobox");
    expect(select).toHaveTextContent("Docs");
    expect(select.closest(".MuiInputBase-root")).not.toHaveClass("Mui-error");
  });
});

describe("ProductUnitSelect with None", () => {
  it("offers None first, which reports no unit", () => {
    const onChange = vi.fn();
    render(
      <ProductUnitSelect
        value={1}
        onChange={onChange}
        productUnits={productUnits}
        businessUnits={businessUnits}
        noneLabel="None"
      />,
    );
    fireEvent.mouseDown(screen.getByRole("combobox"));
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options[0]).toHaveTextContent("None");

    fireEvent.click(options[0]);
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe("SearchableSelect with a value no longer offered", () => {
  function renderSearchable(value: string, onChange = vi.fn()) {
    render(
      <SearchableSelect value={value} options={["Office", "Travel"]} unavailable="Gone" onChange={onChange} />,
    );
    return onChange;
  }

  it("shows the stored value, marked as an error", () => {
    renderSearchable("Gone");
    const input = screen.getByRole("combobox");
    expect(input).toHaveValue("Gone");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("lists it, marked, beside the values offered", async () => {
    renderSearchable("Gone");
    await userEvent.click(screen.getByRole("button", { name: "Open" }));

    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["GoneNo longer offered", "Office", "Travel"]);
  });

  it("isn't an error once a current value is picked", () => {
    renderSearchable("Office");
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-invalid", "false");
  });
});
