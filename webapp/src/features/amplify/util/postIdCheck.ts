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

import { DEFAULT_POST_LINK_ORIGINS, isAllowedLink, isPostKind, postUrnFor, type PostKind } from "./linkedinPost";
import type { UrlChecker } from "./useUrlCheck";

/** Shown for an unreadable post id, on the New Post form at submit time and after a failed check. */
export const POST_ID_HELP = "Enter the post's numeric ID (the digits after the last colon).";

/**
 * What the Post ID box hands to the checker: the kind and id joined, or "" while the id is empty
 * (empty means nothing to check). Changing either part changes the key, so a check never outlives its inputs.
 */
export function postIdCheckKey(kind: PostKind, id: string): string {
  const trimmed = id.trim();
  return trimmed ? `${kind}:${trimmed}` : "";
}

/**
 * Format only, no network. LinkedIn can't be asked whether a post exists (an anonymous request gets a sign-up
 * page), so "ok" means the kind and id make a valid post reference, not that the post was found.
 */
export const checkPostIdFormat: UrlChecker = (key) => {
  const at = key.indexOf(":");
  const kind = key.slice(0, at);
  const urn = isPostKind(kind) ? postUrnFor(kind, key.slice(at + 1)) : null;
  return Promise.resolve(urn ? "ok" : { verdict: "bad", message: POST_ID_HELP });
};

/** Format only: a post link must be on an allowed origin (LinkedIn by default). Same rule amplify-api applies. */
export function makePostLinkChecker(origins: readonly string[] = DEFAULT_POST_LINK_ORIGINS): UrlChecker {
  return (value) =>
    Promise.resolve(
      isAllowedLink(value, origins)
        ? "ok"
        : { verdict: "bad", message: "Use a link on linkedin.com (for example the post's Copy link address)." },
    );
}
