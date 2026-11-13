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
import { hoodie, powerbank } from "../testing/fixtures";
import {
  missingOptions,
  optionParamName,
  priceRange,
  selectedVariant,
  selectionFromSearch,
  selectionToSearch,
  valueState,
} from "./variantState";

describe("optionParamName", () => {
  it("is the option's name as a lower-case address word", () => {
    expect(optionParamName("Colour")).toBe("colour");
    expect(optionParamName("Cup size")).toBe("cup-size");
  });
});

describe("selectionFromSearch", () => {
  it("reads values by option name, ignoring case", () => {
    expect(selectionFromSearch(hoodie(), "colour=black&size=M")).toEqual({ Colour: "black", Size: "m" });
  });

  it("drops values the product doesn't have", () => {
    expect(selectionFromSearch(hoodie(), "colour=purple&size=M&fit=slim")).toEqual({ Size: "m" });
  });

  it("chooses an option that has only one value", () => {
    const oneColour = hoodie({ options: [{ name: "Colour", values: [{ id: "black", value: "Black", swatchHex: null }] }] });
    expect(selectionFromSearch(oneColour, "")).toEqual({ Colour: "black" });
  });
});

describe("selectionToSearch", () => {
  it("writes the chosen values by option name, in the product's option order", () => {
    expect(selectionToSearch(hoodie(), { Size: "s", Colour: "grey" })).toBe("colour=Heather+grey&size=S");
  });
});

describe("selectedVariant", () => {
  it("is the variant for a full choice", () => {
    expect(selectedVariant(hoodie(), { Colour: "black", Size: "m" })?.sku).toBe("HOODIE-BLK-M");
  });

  it("is undefined until every option is chosen, and for a combination nobody makes", () => {
    expect(selectedVariant(hoodie(), { Colour: "black" })).toBeUndefined();
    expect(selectedVariant(hoodie(), { Colour: "grey", Size: "m" })).toBeUndefined();
  });

  it("is the only variant of a product with no options", () => {
    expect(selectedVariant(powerbank(), {})?.sku).toBe("POWERBANK");
  });
});

describe("missingOptions", () => {
  it("names the options still to choose", () => {
    expect(missingOptions(hoodie(), { Size: "m" })).toEqual(["Colour"]);
    expect(missingOptions(hoodie(), { Colour: "black", Size: "m" })).toEqual([]);
  });
});

describe("valueState", () => {
  it("is available when a variant with that value can be bought now", () => {
    expect(valueState(hoodie(), {}, "Colour", "black")).toBe("available");
    expect(valueState(hoodie(), { Colour: "black" }, "Size", "s")).toBe("available");
  });

  it("is out of stock when every matching variant is out of stock", () => {
    expect(valueState(hoodie(), {}, "Colour", "grey")).toBe("out_of_stock");
    expect(valueState(hoodie(), { Colour: "grey" }, "Size", "s")).toBe("out_of_stock");
  });

  it("is sold out when every matching variant is gone for good", () => {
    const limited = hoodie({
      variants: hoodie().variants.map((v) => (v.id === "v-grey-s" ? { ...v, availability: "SOLD_OUT" as const } : v)),
    });
    expect(valueState(limited, {}, "Colour", "grey")).toBe("sold_out");
  });

  it("is unavailable when no variant has that value with the other choices", () => {
    expect(valueState(hoodie(), { Colour: "grey" }, "Size", "m")).toBe("unavailable");
  });

  it("ignores the option's own current choice when judging its other values", () => {
    expect(valueState(hoodie(), { Colour: "black", Size: "m" }, "Colour", "grey")).toBe("unavailable");
    expect(valueState(hoodie(), { Colour: "black", Size: "s" }, "Colour", "grey")).toBe("out_of_stock");
  });
});

describe("priceRange", () => {
  it("spans the variants' prices", () => {
    expect(priceRange(hoodie())).toEqual({ min: 90, max: 95 });
  });

  it("is the base price when there are no variants", () => {
    expect(priceRange(hoodie({ variants: [] }))).toEqual({ min: 90, max: 90 });
  });
});
