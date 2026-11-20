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
import { visibleColumns } from "./columns";
import type { ResultColumn, WidgetResult } from "./dashboardAgentApi";

const col = (id: string, label: string): ResultColumn => ({ id, role: "column", kind: "text", label });

describe("visibleColumns", () => {
  it("drops the hidden id and keeps each column's position in the row", () => {
    const r: WidgetResult = { columns: [col("risk_code", "C"), col("risk_id", "I"), col("t", "T")], rows: [], truncated: false };
    expect(visibleColumns(r).map((c) => [c.column.id, c.index])).toEqual([["risk_code", 0], ["t", 2]]);
  });
});
