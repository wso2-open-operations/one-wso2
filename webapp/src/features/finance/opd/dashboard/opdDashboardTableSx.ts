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

/**
 * The two table styles both dashboard tables share.
 *
 * Their own module rather than exports from a component file: mixing constants
 * in with components turns off React fast refresh for that file, so an edit
 * reloads the page instead of the component.
 */
export const HEAD_SX = {
  "& th": {
    fontSize: 11,
    fontWeight: 700,
    color: "text.secondary",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    border: 0,
  },
} as const;

/** `border: 0` — the source's dashboard tables draw no row rules. */
export const CELL_SX = { fontSize: 13, color: "text.secondary", border: 0 } as const;
