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

import type { QueryClient } from "@tanstack/react-query";

/** UMT's Documentation rail row, which opens the backend-configured docs link. */
export const UMT_DOCUMENTATION_ITEM_ID = "umt-documentation";

/** React Query key for the link useUmtDocumentationUrl fetches. */
export const UMT_DOCUMENTATION_URL_KEY = ["umt-documentation-url"] as const;

// Opens the documentation in a new tab; does nothing until the link is known.
// It reads the link useUmtDocumentationUrl already fetched out of the cache. The
// row is only shown once that fetch has finished, so the tab opens straight
// from the click rather than after an await, which browsers block as an
// unsolicited popup.
export function openUmtDocumentation({ queryClient }: { queryClient: QueryClient }): void {
  const url = queryClient.getQueryData<string>(UMT_DOCUMENTATION_URL_KEY);
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}
