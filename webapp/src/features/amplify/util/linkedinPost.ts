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

import { amplifyPostLinkOrigins } from "@config/apiConfig";

// The post kinds amplify-api accepts (parsePostUrn in amplify-common).
const URN = /urn:li:(share|ugcPost|article|video|document|event|activity):([A-Za-z0-9_-]{1,100})/;
// A bare URN is the whole input, nothing around it.
const BARE_URN = /^urn:li:(share|ugcPost|article|video|document|event|activity):([A-Za-z0-9_-]{1,100})$/;
// The public "copy link" form: /posts/<slug>-<kind>-<id>-<suffix>. LinkedIn writes the post kind into the slug:
// /posts/wso2_some-slug-activity-7123-AbCd, /posts/some-slug-share-7123-AbCd, /posts/some-slug-ugcPost-7123-AbCd.
const POST_SLUG = /-(activity|share|ugcPost)-(\d{1,100})(?:[-/?#]|$)/;

/**
 * `scheme://host[:port]` of an http(s) URL, lowercase, or null for anything
 * else (other schemes, credentials in the URL, not a URL at all).
 */
export function originOf(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return null;
  return url.origin.toLowerCase();
}

/** Whether a link may be sent, shown or followed: its origin is on the allowed list (LinkedIn by default). */
export function isAllowedLink(raw: string | null | undefined, origins: readonly string[] = amplifyPostLinkOrigins): boolean {
  if (!raw) return false;
  const origin = originOf(raw);
  return origin !== null && origins.includes(origin);
}

/**
 * The post URN inside a LinkedIn post URL, or null when there is none.
 *
 * Accepts the two forms people paste: the feed form
 * (`/feed/update/urn:li:share:7123/`, also URL-encoded) and the "copy link"
 * form (`/posts/<slug>-activity|share|ugcPost-7123-xyz`). A bare URN works too,
 * but only as the whole input. Everything else is parsed as a link, with `https://`
 * added when it has no scheme (`www.linkedin.com/...`, `//www.linkedin.com/...`), and
 * its origin is checked before any URN is read from it. A link on any other host is
 * refused, even if it carries a URN: every employee's card would link to it. Short links (`lnkd.in/...`) hide the id behind a redirect
 * and can't be read here; see `isLinkedInShortLink`.
 */
export function postUrnFromUrl(raw: string, origins: readonly string[] = amplifyPostLinkOrigins): string | null {
  const value = raw.trim();
  if (!value) return null;
  const bare = BARE_URN.exec(decodeOrSame(value));
  if (bare) return `urn:li:${bare[1]}:${bare[2]}`;
  // Anything else is a link (https:, http:, javascript:, a protocol-relative `//host/...`, a bare `host/...`) and
  // must pass the origin check before a URN is read from it.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : value.startsWith("//") ? `https:${value}` : `https://${value}`;
  if (!isAllowedLink(candidate, origins)) return null;
  // Read only its path: LinkedIn's own redirects append `?highlightedUpdateUrn=urn:li:activity:…`, a different id
  // from the one in the path, and the path is the post that was linked.
  let subject: string;
  try {
    subject = new URL(candidate).pathname;
  } catch {
    return null;
  }
  const decoded = decodeOrSame(subject);
  const urn = URN.exec(decoded);
  if (urn) return `urn:li:${urn[1]}:${urn[2]}`;
  const slug = POST_SLUG.exec(decoded);
  if (slug && /\/posts\//i.test(decoded)) return `urn:li:${slug[1]}:${slug[2]}`;
  return null;
}

// A stray % (not a valid escape) is read as typed.
function decodeOrSame(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** LinkedIn's share-sheet short link (`https://lnkd.in/...`). The post id is behind a redirect, so it can't be read. */
export function isLinkedInShortLink(raw: string): boolean {
  const origin = originOf(raw);
  return origin !== null && /^https?:\/\/lnkd\.in$/.test(origin);
}

/** The public URL for a post. The stored link only if its origin is allowed; otherwise built from the URN. */
export function linkedInPostUrl(resourceUrn: string, resourceUrl?: string | null): string {
  if (resourceUrl && isAllowedLink(resourceUrl)) return resourceUrl;
  return `https://www.linkedin.com/feed/update/${resourceUrn}/`;
}

/**
 * `yyyy-mm-dd` for a date input: the local calendar day `days` after `from`. Built from local fields, not
 * `toISOString()`, which is UTC and shows the previous day east of Greenwich around midnight.
 */
export function dateInputValue(from: Date, days = 0): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** End of that day in UTC, as the ISO timestamp amplify-api expects for `closesAt`. */
export function closesAtFromDateInput(value: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return `${value}T23:59:59Z`;
}
