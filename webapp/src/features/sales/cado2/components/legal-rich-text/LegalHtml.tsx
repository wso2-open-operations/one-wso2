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

import type { JSX } from "react";
import { Box } from "@wso2/oxygen-ui";
import { toLegalHtml } from "@features/sales/cado2/utils/legalRichText";

/**
 * A legal text as it prints, formatting and all (2026-10-24), cleaned to the
 * legal allow-list before it reaches the page. Small print reads smaller,
 * with the order form's "*"; `marks` tints the deal's values on a preview.
 */
export default function LegalHtml({ html, fine = false, marks = false }: { html: string; fine?: boolean; marks?: boolean }): JSX.Element {
  return (
    <Box
      // Cleaned by toLegalHtml (DOMPurify, the legal allow-list).
      dangerouslySetInnerHTML={{ __html: toLegalHtml(html, marks) }}
      sx={{
        typography: fine ? "caption" : "body2",
        color: fine ? "text.secondary" : "text.primary",
        lineHeight: 1.65,
        overflowWrap: "anywhere",
        "& p": { m: 0 },
        "& p + p": { mt: 1 },
        "& a": { color: "primary.main" },
        "& mark": { bgcolor: "action.selected", color: "inherit", borderRadius: 0.5, px: 0.375 },
        ...(fine ? { "& p:first-of-type::before": { content: '"* "' } } : {}),
      }}
    />
  );
}
