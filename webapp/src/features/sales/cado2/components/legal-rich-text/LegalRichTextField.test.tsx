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

import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import LegalRichTextField from "./LegalRichTextField";

// The legal editor offers bold, italic, underline, link and alignment (2026-10-24).
describe("LegalRichTextField", () => {
  it("has the five tools, named, and opens a plain text from before as paragraphs", () => {
    render(<LegalRichTextField label="Special terms" value={"First\n\nSecond"} onChange={vi.fn()} />);
    const editor = within(screen.getByRole("group", { name: "Special terms" }));
    for (const name of ["Bold", "Italic", "Underline", "Link"]) expect(editor.getByRole("button", { name })).toBeInTheDocument();
    expect(editor.getAllByLabelText("Alignment").length).toBeGreaterThan(0);
    expect(editor.getByText("First")).toBeInTheDocument();
    expect(editor.getByText("Second")).toBeInTheDocument();
  });
});
