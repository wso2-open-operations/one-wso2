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

import type { Campaign } from "../api/amplifyTypes";

/**
 * Origins a post link (and the LinkedIn sign-in redirect) may use until amplify-api's list arrives in `GET /me`
 * (`campaignLinkOrigins`): LinkedIn only. amplify-api applies the same rule; this keeps the UI from sending or
 * showing anything else.
 */
export const DEFAULT_POST_LINK_ORIGINS: readonly string[] = ["https://www.linkedin.com", "https://linkedin.com"];

// The post kinds amplify-api accepts (parsePostUrn in amplify-common).
const URN = /urn:li:(share|ugcPost|article|video|document|event|activity):([A-Za-z0-9_-]{1,100})/;
// A bare URN is the whole input, nothing around it.
const BARE_URN = /^urn:li:(share|ugcPost|article|video|document|event|activity):([A-Za-z0-9_-]{1,100})$/;
// The public "copy link" form: /posts/<slug>-<kind>-<id>-<suffix>. LinkedIn writes the post kind into the slug:
// /posts/wso2_some-slug-activity-7123-AbCd, /posts/some-slug-share-7123-AbCd, /posts/some-slug-ugcPost-7123-AbCd.
// The leading greedy `^.*` makes the match start at the LAST kind-id pair, so a title like "ten-share-100-ways" can't win.
const POST_SLUG = /^.*-(activity|share|ugcPost)-(\d{1,100})(?:[-/?#]|$)/;

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
export function isAllowedLink(raw: string | null | undefined, origins: readonly string[] = DEFAULT_POST_LINK_ORIGINS): boolean {
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
export function postUrnFromUrl(raw: string, origins: readonly string[] = DEFAULT_POST_LINK_ORIGINS): string | null {
  const value = raw.trim();
  if (!value) return null;
  const bare = BARE_URN.exec(decodeOrSame(value));
  if (bare) return `urn:li:${bare[1]}:${bare[2]}`;
  // Anything else is a link (https:, http:, javascript:, a protocol-relative `//host/...`, a bare `host/...`) and
  // must pass the origin check before a URN is read from it.
  const candidate = withScheme(value);
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

// The value as a link: as typed when it has a scheme, otherwise with `https:` (or `https://`) in front.
function withScheme(value: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  return value.startsWith("//") ? `https:${value}` : `https://${value}`;
}

/**
 * The link to send as an own post's `evidenceUrl`, or null when `raw` isn't a LinkedIn post link.
 *
 * Accepts what `postUrnFromUrl` accepts on LinkedIn's own origins. A link is sent as typed (trimmed), with `https://`
 * added when it has no scheme; a bare URN becomes its feed link, because amplify-api takes only HTTPS URLs.
 */
export function ownPostEvidenceUrl(raw: string): string | null {
  const value = raw.trim();
  const urn = postUrnFromUrl(value);
  if (!urn) return null;
  return BARE_URN.test(decodeOrSame(value)) ? postPermalink(urn) : withScheme(value);
}

// A stray % (not a valid escape) is read as typed.
function decodeOrSame(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** The id part of `urn:li:<kind>:<id>`, or null when the value is not a post URN. */
function urnIdOf(value: string | null | undefined): string | null {
  const parts = value?.split(":") ?? [];
  return parts.length >= 4 && parts[0] === "urn" && parts[1] === "li" && parts[3] ? parts[3] : null;
}

/**
 * The campaign a `/amplify/celebrate?share=` value names.
 *
 * Novera's card button sends the campaign id. A hand-made or older link may carry the LinkedIn post instead — its
 * bare id (`7411000001`), its `urn:li:<kind>:<id>` or a post URL — so those resolve too. Only the campaigns given
 * (the open list) are searched; anything else returns null rather than guessing at a campaign.
 */
export function campaignForShareParam(
  param: string | null | undefined,
  campaigns: readonly Campaign[],
  origins: readonly string[] = DEFAULT_POST_LINK_ORIGINS,
): Campaign | null {
  const value = param?.trim();
  if (!value) return null;
  const byId = campaigns.find((c) => c.id === value);
  if (byId) return byId;
  const urn = postUrnFromUrl(value, origins);
  if (urn) return campaigns.find((c) => c.resourceUrn === urn) ?? null;
  return POST_ID.test(value) ? (campaigns.find((c) => urnIdOf(c.resourceUrn) === value) ?? null) : null;
}

/** The post kinds the New Post form offers. amplify-api also reads article, video, document, event and activity. */
export const POST_KINDS = ["share", "ugcPost"] as const;
export type PostKind = (typeof POST_KINDS)[number];
export const DEFAULT_POST_KIND: PostKind = "share";

export function isPostKind(value: string): value is PostKind {
  return (POST_KINDS as readonly string[]).includes(value);
}

/** Where a post lives: the form shows this as fixed text, then the kind list, then the id. */
export const POST_PERMALINK_PREFIX = "https://www.linkedin.com/feed/update/";

// Same id shape amplify-api accepts (parsePostUrn in amplify-common).
const POST_ID = /^[A-Za-z0-9_-]{1,100}$/;

/** `urn:li:<kind>:<id>` for the New Post form's kind list and id box, or null when the id isn't a valid one. */
export function postUrnFor(kind: PostKind, id: string): string | null {
  const trimmed = id.trim();
  return POST_ID.test(trimmed) ? `urn:li:${kind}:${trimmed}` : null;
}

/** The permalink stored with a registered post: the fixed prefix plus the URN. */
export function postPermalink(urn: string): string {
  return `${POST_PERMALINK_PREFIX}${urn}/`;
}

/**
 * Kind and id when someone pastes a whole link or URN into the id box, only for share and ugcPost. Anything else
 * (activity, article, a link off LinkedIn) is null, so it is refused rather than turned into an id that may not exist.
 */
export function postRefFromPaste(
  raw: string,
  origins: readonly string[] = DEFAULT_POST_LINK_ORIGINS,
): { kind: PostKind; id: string } | null {
  const m = /^urn:li:([A-Za-z]+):(.+)$/.exec(postUrnFromUrl(raw, origins) ?? "");
  return m && isPostKind(m[1]) ? { kind: m[1], id: m[2] } : null;
}

/** LinkedIn's share-sheet short link (`https://lnkd.in/...`). The post id is behind a redirect, so it can't be read. */
export function isLinkedInShortLink(raw: string): boolean {
  const origin = originOf(raw);
  return origin !== null && /^https?:\/\/lnkd\.in$/.test(origin);
}

/** The public URL for a post. The stored link only if its origin is allowed; otherwise built from the URN. */
export function linkedInPostUrl(
  resourceUrn: string,
  resourceUrl?: string | null,
  origins: readonly string[] = DEFAULT_POST_LINK_ORIGINS,
): string {
  if (resourceUrl && isAllowedLink(resourceUrl, origins)) return resourceUrl;
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
