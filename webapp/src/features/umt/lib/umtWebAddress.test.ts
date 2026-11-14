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
import { toWebAddress } from "./umtWebAddress";

describe("toWebAddress", () => {
  it.each([
    ["https://docs.example.com/umt", "https://docs.example.com/umt"],
    ["http://docs.example.com", "http://docs.example.com"],
    ["  https://docs.example.com/umt \n", "https://docs.example.com/umt"],
  ])("keeps the web address %j", (value, expected) => {
    expect(toWebAddress(value)).toBe(expected);
  });

  it.each([
    ["a javascript: value", "javascript:alert(1)"],
    ["a data: value", "data:text/html,<script>alert(1)</script>"],
    ["a different scheme", "ftp://docs.example.com"],
    ["a bare hostname", "docs.example.com"],
    ["a blank", "   "],
    ["an empty string", ""],
  ])("treats %s as no link", (_label, value) => {
    expect(toWebAddress(value)).toBe("");
  });

  it("treats a missing value as no link", () => {
    expect(toWebAddress(null)).toBe("");
    expect(toWebAddress(undefined)).toBe("");
  });
});
