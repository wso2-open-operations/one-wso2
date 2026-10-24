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

/** Admin › Legal Texts (2026-10-24). */
export interface LegalAdmin {
  readonly texts: readonly { key: string; body: string; updatedByEmail: string; updatedAt: string }[];
  readonly notices: readonly LegalNoticeRow[];
  /** e.g. "{PARTNER_NAME}". */
  readonly placeholders: readonly string[];
}

/** A section 05 notice and when it applies; an empty list is any. */
export interface LegalNoticeRow {
  readonly id: number;
  readonly title: string;
  readonly body: string;
  readonly showTitle: boolean;
  readonly finePrint: boolean;
  readonly channels: readonly string[];
  readonly regions: readonly string[];
  readonly dealKinds: readonly string[];
  readonly updatedByEmail: string;
  readonly updatedAt: string;
}

export type LegalNoticeInput = Omit<LegalNoticeRow, "id" | "updatedByEmail" | "updatedAt">;
