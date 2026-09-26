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

import { useEffect } from "react";

/**
 * What index.html ships, and what the tab reads on any screen that doesn't
 * name itself.
 */
export const BASE_DOCUMENT_TITLE = "One WSO2";

/**
 * Name the browser tab after the screen the reader is on.
 *
 * Nothing in this app wrote `document.title` before Finance MIS: every tab read
 * "One WSO2", so someone with six open had six identical tabs and no way to
 * tell a leave request from a revenue report. The source MIS app drove its rail
 * label, app bar and browser title from one table, and rather than porting a
 * MIS-local version of that, this is the shared piece — any screen can call it.
 *
 * The screen's own name goes FIRST. A tab is truncated from the right, and the
 * half that identifies it is the half that has to survive.
 *
 * Passing nothing (or an empty string) leaves the title alone, so a screen that
 * has not decided on a name yet does not write a bare separator into the tab.
 * On unmount the base title comes back: leaving the previous screen's name up
 * is worse than the generic one, because it is confidently wrong.
 */
export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    if (!title) return;
    document.title = `${title} · ${BASE_DOCUMENT_TITLE}`;
    return () => {
      document.title = BASE_DOCUMENT_TITLE;
    };
  }, [title]);
}
