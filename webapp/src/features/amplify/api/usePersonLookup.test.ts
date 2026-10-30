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
import { looksLikeId, nameOrUnknown } from "./usePersonLookup";

const UUID = "0198a7c4-1b2d-7e3f-8a9b-0c1d2e3f4a5b";

describe("looksLikeId", () => {
  it("treats a uuid, an empty value and whitespace as no name", () => {
    expect(looksLikeId(UUID)).toBe(true);
    expect(looksLikeId(` ${UUID} `)).toBe(true);
    expect(looksLikeId("")).toBe(true);
    expect(looksLikeId("   ")).toBe(true);
    expect(looksLikeId(null)).toBe(true);
    expect(looksLikeId(undefined)).toBe(true);
    expect(looksLikeId("Ada Lovelace")).toBe(false);
  });
});

describe("nameOrUnknown", () => {
  it("prefers the directory's name, then a real recorded name", () => {
    expect(nameOrUnknown("Ada Lovelace", "someone else")).toBe("Ada Lovelace");
    expect(nameOrUnknown(undefined, "  Grace Hopper ")).toBe("Grace Hopper");
  });

  it("never shows an id or a blank as a name", () => {
    expect(nameOrUnknown(undefined, UUID)).toBe("Unknown employee");
    expect(nameOrUnknown(undefined, "   ")).toBe("Unknown employee");
    expect(nameOrUnknown("   ", "   ")).toBe("Unknown employee");
    expect(nameOrUnknown(undefined, null)).toBe("Unknown employee");
  });
});
