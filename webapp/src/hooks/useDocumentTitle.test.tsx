/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { BASE_DOCUMENT_TITLE, useDocumentTitle } from "./useDocumentTitle";

// Nothing in this app wrote document.title before MIS. Every tab read
// "One WSO2", so a person with six of them open had six identical tabs and no
// way to tell a leave request from a revenue report. The source MIS app drove
// its rail label, app bar and browser title from one table; this is the shared
// piece of that.

beforeEach(() => {
  document.title = BASE_DOCUMENT_TITLE;
});

describe("a screen that names itself", () => {
  it("puts its name in front of the app's", () => {
    renderHook(() => useDocumentTitle("ARR Build"));
    expect(document.title).toBe("ARR Build · One WSO2");
  });

  it("follows the name changing without remounting", () => {
    const { rerender } = renderHook(({ t }) => useDocumentTitle(t), {
      initialProps: { t: "ARR Build" },
    });
    rerender({ t: "ARR Analysis" });
    expect(document.title).toBe("ARR Analysis · One WSO2");
  });

  // Leaving the old name behind would put a stale screen's title above whatever
  // the reader navigated to — worse than the generic title, because it is
  // confidently wrong.
  it("gives the title back when the screen goes away", () => {
    const { unmount } = renderHook(() => useDocumentTitle("ARR Build"));
    unmount();
    expect(document.title).toBe(BASE_DOCUMENT_TITLE);
  });
});

describe("a screen with nothing to add", () => {
  it("leaves the title alone rather than writing a bare separator", () => {
    renderHook(() => useDocumentTitle(undefined));
    expect(document.title).toBe(BASE_DOCUMENT_TITLE);
  });

  it("treats an empty string the same as nothing", () => {
    renderHook(() => useDocumentTitle(""));
    expect(document.title).toBe(BASE_DOCUMENT_TITLE);
  });
});
