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
import { findMentionQuery, insertCode, insertLink, prefixLines, wrapSelection } from "./markdownEditing";

describe("toolbar edits", () => {
  it("wraps the selection, or inserts and selects a placeholder", () => {
    expect(wrapSelection("a b c", 2, 3, "**", "**", "x")).toEqual({ text: "a **b** c", start: 4, end: 5 });
    expect(wrapSelection("ab", 1, 1, "*", "*", "italic")).toEqual({ text: "a*italic*b", start: 2, end: 8 });
  });

  it("makes a link with the URL selected", () => {
    const edit = insertLink("see docs", 4, 8);
    expect(edit.text).toBe("see [docs](https://)");
    expect(edit.text.slice(edit.start, edit.end)).toBe("https://");
  });

  it("uses inline code for one line and a fence for several", () => {
    expect(insertCode("a x b", 2, 3).text).toBe("a `x` b");
    expect(insertCode("x\ny", 0, 3).text).toBe("```\nx\ny\n```");
  });

  it("prefixes every touched line", () => {
    expect(prefixLines("a\nb\nc", 0, 3, "bullet").text).toBe("- a\n- b\nc");
    expect(prefixLines("a", 1, 1, "quote").text).toBe("> a");
  });
});

describe("findMentionQuery", () => {
  it("finds the @name being typed", () => {
    expect(findMentionQuery("hi @Ja", 6)).toEqual({ start: 3, query: "Ja" });
    expect(findMentionQuery("@Jane Sm", 8)).toEqual({ start: 0, query: "Jane Sm" });
  });

  it("ignores a bare @, an email address and a finished line", () => {
    expect(findMentionQuery("hi @", 4)).toBeNull();
    expect(findMentionQuery("jane@wso2", 9)).toBeNull();
    expect(findMentionQuery("@ja\nx", 5)).toBeNull();
    expect(findMentionQuery("@ja  ", 5)).toBeNull();
  });
});
