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

// A purchase request's reference, as the one thing you click on every Phase 1
// screen.
//
// The detail view is not ported yet, so there is no in-app route to send this
// to: `/procurement/requests/:id` is not registered, and App.tsx's catch-all
// would redirect the click to the user's landing perspective — a bounce out of
// Procurement with no explanation. So the reference leaves the app instead,
// to the request's page in the standalone purchasing app, and falls back to
// plain text where that app's URL isn't configured.
//
// One component rather than the same conditional at three call sites (the two
// tables and the overview's activity feed), so all three agree on the fallback
// and Phase 2 changes the destination in one place.

import { Link as MuiLink, Typography } from "@wso2/oxygen-ui";
import { ExternalLinkIcon } from "@wso2/oxygen-ui-icons-react";
import { purchasingWebAppRequestUrl } from "@config/apiConfig";
import { prReference } from "@features/procurement/util/prDisplay";

export default function PrReferenceLink({
  pr,
  fontWeight = 600,
  variant = "body2",
}: {
  /** Enough of a PurchaseRequest to name it. */
  pr: { id: number; reference?: string | null };
  fontWeight?: number;
  /** `caption` for the overview's activity feed, which sets its rows smaller. */
  variant?: "body2" | "caption";
}) {
  const label = prReference(pr);
  const href = purchasingWebAppRequestUrl(pr.id);

  // Not configured: the reference still identifies the request, so it stays
  // visible — it just isn't a promise that clicking it does something.
  if (!href) {
    return (
      <Typography component="span" variant={variant} sx={{ fontWeight }}>
        {label}
      </Typography>
    );
  }

  return (
    <MuiLink
      href={href}
      variant={variant}
      target="_blank"
      rel="noopener noreferrer"
      // The accessible name says where it goes. The glyph alone tells a sighted
      // user that this leaves One WSO2 and tells a screen-reader user nothing,
      // which is the case this label covers.
      aria-label={`${label} — opens in the purchasing app`}
      title="Opens this request in the purchasing app"
      sx={{ fontWeight, display: "inline-flex", alignItems: "center", gap: 0.5 }}
    >
      {label}
      <ExternalLinkIcon size={11} aria-hidden />
    </MuiLink>
  );
}
