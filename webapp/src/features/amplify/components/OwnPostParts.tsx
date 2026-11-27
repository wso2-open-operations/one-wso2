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

import { Link } from "@wso2/oxygen-ui";
import { ExternalLinkIcon } from "@wso2/oxygen-ui-icons-react";
import type { ExternalShare, ExternalShareStatus } from "../api/amplifyTypes";
import { originOf } from "../util/linkedinPost";
import { OWN_POST_STATUS_LABELS } from "../util/ownPosts";
import { StateChip } from "./DashboardParts";

const STATUS_TONE: Readonly<Record<ExternalShareStatus, "default" | "primary" | "warning" | "error" | "info">> = {
  PENDING: "warning",
  APPROVED: "info",
  AMPLIFIED: "primary",
  REJECTED: "error",
};

/** An own post's status as a pill: Waiting for review, Approved, Featured or Declined. */
export function OwnPostStatusChip({ status }: { status: ExternalShareStatus }) {
  return <StateChip label={OWN_POST_STATUS_LABELS[status]} tone={STATUS_TONE[status]} />;
}

/**
 * A link that opens the post in a new tab: "Open on LinkedIn" for a LinkedIn post, "Open the post" otherwise.
 * Nothing when the stored link isn't an http(s) URL.
 */
export function OwnPostLink({ share }: { share: Pick<ExternalShare, "evidenceUrl" | "evidenceProvider"> }) {
  if (originOf(share.evidenceUrl) === null) return null;
  return (
    <Link
      href={share.evidenceUrl}
      target="_blank"
      rel="noopener noreferrer"
      underline="hover"
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: 13, fontWeight: 600 }}
    >
      {share.evidenceProvider === "linkedin" ? "Open on LinkedIn" : "Open the post"}
      <ExternalLinkIcon size={13} aria-hidden="true" />
    </Link>
  );
}
