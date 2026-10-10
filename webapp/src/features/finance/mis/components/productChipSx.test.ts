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
import type { Theme } from "@mui/material/styles";
import { productChipSx } from "./productChipSx";

function stylesFor(product: string) {
  let dark: Record<string, string> = {};
  const theme = {
    applyStyles: (_mode: string, styles: Record<string, string>) => {
      dark = styles;
      return { "@dark": styles };
    },
  } as unknown as Theme;
  return { light: productChipSx(product)(theme), dark };
}

function contrast(foreground: string, background: string) {
  const channel = (hex: string, start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (hex: string) =>
    0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("a product chip", () => {
  it("takes the product's own colour for its text, its border and its wash", () => {
    const iam = stylesFor("IAM").light;
    expect(iam.color).toBe("#6d28d9");
    expect(iam.borderColor).toBe("rgba(109, 40, 217, 0.45)");
    expect(iam.backgroundColor).toBe("rgba(109, 40, 217, 0.1)");
  });

  it("paints APIM in the same blue as API Platform", () => {
    expect(stylesFor("APIM").light.color).toBe(stylesFor("API Platform").light.color);
  });

  it("gives each known product a different colour", () => {
    const colours = ["API Platform", "IAM", "Integration", "Choreo", "Agent Platform", "Moesif"].map(
      (product) => stylesFor(product).light.color,
    );
    expect(new Set(colours).size).toBe(colours.length);
  });

  it("still outlines a product it does not know, in slate", () => {
    const unknown = stylesFor("Something else").light;
    expect(unknown.color).toBe("#475569");
    expect(unknown.borderColor).toContain("71, 85, 105");
  });

  it("uses a lighter ink in the dark scheme, readable on a black canvas", () => {
    const { dark } = stylesFor("IAM");
    expect(dark.color).toBe("#c4b5fd");
    expect(contrast(dark.color, "#000000")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(stylesFor("Something else").dark.color, "#000000")).toBeGreaterThanOrEqual(4.5);
  });
});
