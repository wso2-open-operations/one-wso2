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

// GET /update/user-info. This is the UMT service's identity record, not the
// app-wide People user-info response; in particular, `roles` uses UMT ids.
export interface UmtUserInfo {
  employeeId: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  jobRole: string;
  employeeThumbnail: string;
  roles: number[];
}

// Product rows returned by GET /meta. The latest-version fields are kept on
// the metadata subtype because the Create dialog switches between the source
// product version and its latest supported version.
export interface UmtProduct {
  id: number;
  name: string;
  version: string;
  leadMail: string;
  edMail: string;
  platform?: string;
}

export interface UmtMetadataProduct extends UmtProduct {
  latestVersion: string;
  isLatest: boolean;
  supportRepoUrl: string;
  publicRepoUrl: string;
}

export interface UmtMeta {
  products: Record<string, UmtMetadataProduct[]>;
  issueTypes: string[];
  updateLifeCycles: string[];
  userEmails: string[];
}

// Service-owned privileges from /update/user-info. Keep this mapping local to
// UMT: the same numbers have no meaning in the People capability vocabulary.
export const UMT_ROLE_ID = {
  UMT_USER: 444,
  UMT_ADMIN: 555,
  PRODUCT_LEAD: 666,
} as const;

export type UmtRole = keyof typeof UMT_ROLE_ID;
