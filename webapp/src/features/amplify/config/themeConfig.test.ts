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
import { AMPLIFY_BAR, AMPLIFY_BAR_DEFAULTS, hexColorOr, resolveAmplifyBar } from "./themeConfig";

describe("hexColorOr", () => {
  it.each(["#abc", "#ABCD", "#0a1b2c", "#0A1B2C80"])("accepts the hex colour %s", (value) => {
    expect(hexColorOr(value, "#000000")).toBe(value);
  });

  it("trims surrounding spaces", () => {
    expect(hexColorOr("  #123456 ", "#000000")).toBe("#123456");
  });

  it.each([
    ["an empty string", ""],
    ["a colour name", "green"],
    ["no hash", "089c2f"],
    ["five digits", "#12345"],
    ["a non-hex digit", "#12345g"],
    ["an rgb() value", "rgb(0, 0, 0)"],
    ["CSS injection", "#fff; background: url(x)"],
    ["a number", 0x089c2f],
    ["null", null],
    ["undefined", undefined],
  ])("falls back for %s", (_label, value) => {
    expect(hexColorOr(value, "#000000")).toBe("#000000");
  });
});

describe("resolveAmplifyBar", () => {
  it("keeps the defaults without a config", () => {
    expect(resolveAmplifyBar(undefined)).toEqual({ positive: "#089c2f", negative: "#d92c16" });
    expect(resolveAmplifyBar({})).toEqual(AMPLIFY_BAR_DEFAULTS);
  });

  it("uses valid overrides", () => {
    expect(
      resolveAmplifyBar({ ONE_WSO2_AMPLIFY_POSITIVE_COLOR: "#00f", ONE_WSO2_AMPLIFY_NEGATIVE_COLOR: "#ff8800" }),
    ).toEqual({ positive: "#00f", negative: "#ff8800" });
  });

  it("falls back per colour when one override is invalid", () => {
    expect(
      resolveAmplifyBar({ ONE_WSO2_AMPLIFY_POSITIVE_COLOR: "blue", ONE_WSO2_AMPLIFY_NEGATIVE_COLOR: "#123" }),
    ).toEqual({ positive: AMPLIFY_BAR_DEFAULTS.positive, negative: "#123" });
  });

  it("reads window.config when no config is passed", () => {
    const previous = window.config;
    try {
      window.config = { ...previous, ONE_WSO2_AMPLIFY_NEGATIVE_COLOR: "#abcdef" };
      expect(resolveAmplifyBar()).toEqual({ positive: AMPLIFY_BAR_DEFAULTS.positive, negative: "#abcdef" });
    } finally {
      window.config = previous;
    }
  });

  it("starts the app on the defaults when config.js sets nothing", () => {
    expect(AMPLIFY_BAR).toEqual(AMPLIFY_BAR_DEFAULTS);
  });
});
