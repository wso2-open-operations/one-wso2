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

import { useState } from "react";

/** Which years are folded; new years start open. */
export function useCollapsedYears() {
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(new Set());
  return {
    collapsed,
    toggle: (n: number) =>
      setCollapsed((c) => {
        const next = new Set(c);
        if (!next.delete(n)) next.add(n);
        return next;
      }),
    /** Folds every year, or opens them all when any is folded. */
    toggleAll: (years: readonly number[]) => setCollapsed((c) => (c.size > 0 ? new Set() : new Set(years))),
    reset: () => setCollapsed(new Set()),
  };
}
