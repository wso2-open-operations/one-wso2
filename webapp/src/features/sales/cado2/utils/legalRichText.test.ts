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
import { cleanLegalText, isEmptyLegalText, legalPlainText, sanitizeLegalHtml, toLegalHtml } from "./legalRichText";

// Rich legal texts (2026-10-24), the same allow-list as the backend.
describe("legalRichText", () => {
  it("keeps bold, italic, underline, https and mailto links, and paragraph alignment", () => {
    const out = sanitizeLegalHtml(
      '<p style="text-align: center; color: red"><strong>B</strong> <em>I</em> <u>U</u> <a href="https://wso2.com">L</a> <a href="mailto:legal@wso2.com">M</a></p>',
    );
    expect(out).toContain('<p style="text-align: center">');
    expect(out).toContain("<strong>B</strong>");
    expect(out).toContain("<em>I</em>");
    expect(out).toContain("<u>U</u>");
    expect(out).toContain('href="https://wso2.com"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('href="mailto:legal@wso2.com"');
    expect(out).not.toContain("color");
  });

  it("drops anything else", () => {
    const out = sanitizeLegalHtml('<p onclick="x">a<script>alert(1)</script><a href="javascript:alert(1)">b</a><img src="https://x/y.png"><span style="text-align:center">c</span></p>');
    for (const banned of ["onclick", "script", "javascript", "img", "span", "style"]) expect(out).not.toContain(banned);
    expect(out).toContain("a");
  });

  it("reads a plain text from before as paragraphs", () => {
    expect(toLegalHtml("One\nline\n\nTwo & three")).toBe("<p>One<br>line</p><p>Two &amp; three</p>");
    expect(toLegalHtml("")).toBe("");
  });

  it("knows the editor's empty value is empty, and saves it as nothing", () => {
    expect(isEmptyLegalText("<p><br></p>")).toBe(true);
    expect(isEmptyLegalText("<p>Terms</p>")).toBe(false);
    expect(cleanLegalText("<p><br></p>")).toBe("");
    expect(cleanLegalText("<p>A&nbsp;B</p>")).toBe("<p>A B</p>");
    expect(legalPlainText("<p>One</p><p>Two</p>")).toBe("One Two");
  });

  it("treats a plain text and the same text as paragraphs as the same", async () => {
    const { sameLegalText } = await import("./legalRichText");
    expect(sameLegalText("AM's wording", "<p>AM's wording</p>")).toBe(true);
    expect(sameLegalText("AM's wording", "<p><strong>AM's</strong> wording</p>")).toBe(false);
  });
});
