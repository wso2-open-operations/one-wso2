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

// The dashboards' "Include archived posts" checkbox, remembered per browser. Storage can be off (private
// windows, blocked site data), so every read and write is guarded and the default is unticked.

import { useCallback, useState } from "react";

export const INCLUDE_ARCHIVED_KEY = "amplify-dashboards-include-archived";

/** The saved choice, `false` when nothing is saved or storage can't be read. */
export function readIncludeArchived(): boolean {
  try {
    return window.localStorage.getItem(INCLUDE_ARCHIVED_KEY) === "true";
  } catch {
    return false;
  }
}

/** Saves the choice; a storage failure only means it isn't remembered. */
export function writeIncludeArchived(value: boolean): void {
  try {
    window.localStorage.setItem(INCLUDE_ARCHIVED_KEY, value ? "true" : "false");
  } catch {
    // Not remembered; the board still uses the value for this visit.
  }
}

/** Whether archived posts count in the summary cards, and a setter that remembers the choice. */
export function useIncludeArchived(): [boolean, (value: boolean) => void] {
  const [includeArchived, setState] = useState<boolean>(readIncludeArchived);
  const set = useCallback((value: boolean) => {
    setState(value);
    writeIncludeArchived(value);
  }, []);
  return [includeArchived, set];
}
