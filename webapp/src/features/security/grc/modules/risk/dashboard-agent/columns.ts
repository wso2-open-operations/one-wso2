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

import type { ResultColumn, WidgetResult } from "./dashboardAgentApi";

// HIDDEN_COLUMNS are columns the web app uses but never shows. The risk id is
// carried on each row of a list only so the risk code (or control number) can
// link to its risk (or control).
export const HIDDEN_COLUMNS = new Set(["risk_id", "audit_id", "control_id"]);

// visibleColumns are the columns a table shows, each with its position in a row.
export const visibleColumns = (result: WidgetResult): { column: ResultColumn; index: number }[] =>
  result.columns.flatMap((column, index) => (HIDDEN_COLUMNS.has(column.id) ? [] : [{ column, index }]));
