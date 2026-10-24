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
import { Box, Chip, Typography } from "@wso2/oxygen-ui";
import type { LegalNoticeOut } from "@features/sales/cado2/quotes/api/quoteTypes";
import LegalHtml from "./LegalHtml";
import LegalQuote from "./LegalQuote";

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The legal terms and notices as one quoted passage, as they print
 * (2026-10-24): a title only where Legal prints it, small print with its
 * "*". `reasons` marks each clause the deal added (the Legal step only).
 */
export default function LegalNotices({ notices, reasons = false }: { notices: readonly LegalNoticeOut[]; reasons?: boolean }): JSX.Element {
  return (
    <LegalQuote>
      {notices.map((n, i) => (
        <Box key={n.title} sx={{ mt: i === 0 ? 0 : n.showTitle ? 1.75 : 1 }}>
          {reasons && n.reason ? (
            <Chip size="small" color="info" variant="outlined" label={sentence(n.reason)} sx={{ mb: 0.5, height: 20, fontSize: 11 }} />
          ) : null}
          {n.showTitle ? (
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
              {n.title}
            </Typography>
          ) : null}
          <LegalHtml html={n.body} fine={n.finePrint} />
        </Box>
      ))}
    </LegalQuote>
  );
}
