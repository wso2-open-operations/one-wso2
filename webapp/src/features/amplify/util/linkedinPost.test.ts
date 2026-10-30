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

import { describe, expect, it } from "vitest";
import {
  closesAtFromDateInput,
  dateInputValue,
  isAllowedLink,
  isLinkedInShortLink,
  linkedInPostUrl,
  originOf,
  postUrnFromUrl,
} from "./linkedinPost";

describe("postUrnFromUrl", () => {
  it("reads the feed form", () => {
    expect(postUrnFromUrl("https://www.linkedin.com/feed/update/urn:li:share:7123/")).toBe("urn:li:share:7123");
    expect(postUrnFromUrl("https://www.linkedin.com/feed/update/urn:li:activity:7514314521537110016")).toBe(
      "urn:li:activity:7514314521537110016",
    );
  });

  it("reads a URL-encoded feed form", () => {
    expect(postUrnFromUrl("https://www.linkedin.com/feed/update/urn%3Ali%3AugcPost%3A99/")).toBe("urn:li:ugcPost:99");
  });

  it("reads the copy-link form", () => {
    expect(postUrnFromUrl("https://www.linkedin.com/posts/wso2_ai-agents-activity-7380000000000000000-AbCd")).toBe(
      "urn:li:activity:7380000000000000000",
    );
  });

  it("reads the copy-link form for every post kind", () => {
    const base = "https://www.linkedin.com/posts/testing-api-repost";
    expect(postUrnFromUrl(`${base}-share-7518434065226887168-Jsow`)).toBe("urn:li:share:7518434065226887168");
    expect(postUrnFromUrl(`${base}-ugcPost-7518434065226887168-Jsow`)).toBe("urn:li:ugcPost:7518434065226887168");
    expect(postUrnFromUrl(`${base}-share-7518434065226887168-Jsow/`)).toBe("urn:li:share:7518434065226887168");
    expect(postUrnFromUrl(`${base}-share-7518434065226887168-Jsow?utm_source=share&utm_medium=member_desktop`)).toBe(
      "urn:li:share:7518434065226887168",
    );
    expect(postUrnFromUrl(`${base}-share-7518434065226887168`)).toBe("urn:li:share:7518434065226887168");
  });

  it("reads the path, not the tracking query LinkedIn adds when a short link redirects", () => {
    // What https://lnkd.in/p/<id> redirects to: the slug carries the share id, the query a different activity id.
    const resolved =
      "https://www.linkedin.com/posts/testing-api-repost-share-7518434065226887168-Jsow/" +
      "?highlightedUpdateUrn=urn%3Ali%3Aactivity%3A7518434065650315264&highlightedUpdateType=SOCIAL_SHARE" +
      "&origin=SOCIAL_SHARE&utm_source=share&utm_medium=member_desktop";
    expect(postUrnFromUrl(resolved)).toBe("urn:li:share:7518434065226887168");
    // A feed link keeps its path URN even with a query.
    expect(postUrnFromUrl("https://www.linkedin.com/feed/update/urn:li:share:7123/?utm_source=share")).toBe(
      "urn:li:share:7123",
    );
  });

  it("refuses a copy-link slug with an unknown kind or no id", () => {
    expect(postUrnFromUrl("https://www.linkedin.com/posts/x-reshare-7518434065226887168-Jsow")).toBeNull();
    expect(postUrnFromUrl("https://www.linkedin.com/posts/x-share-abc-Jsow")).toBeNull();
  });

  it("refuses anything else", () => {
    expect(postUrnFromUrl("")).toBeNull();
    expect(postUrnFromUrl("https://example.com/posts/x-activity-1-y")).toBeNull();
    expect(postUrnFromUrl("https://www.linkedin.com/in/someone")).toBeNull();
    expect(postUrnFromUrl("%E0%A4%A")).toBeNull();
  });
});

describe("isLinkedInShortLink", () => {
  it("spots the share-sheet short link, which postUrnFromUrl can't read", () => {
    expect(isLinkedInShortLink("https://lnkd.in/p/gMdNVrGJ")).toBe(true);
    expect(postUrnFromUrl("https://lnkd.in/p/gMdNVrGJ")).toBeNull();
    expect(isLinkedInShortLink("https://www.linkedin.com/posts/x-share-1-y")).toBe(false);
    expect(isLinkedInShortLink("https://evil.example/lnkd.in")).toBe(false);
  });
});

describe("linkedInPostUrl", () => {
  it("prefers the stored URL", () => {
    expect(linkedInPostUrl("urn:li:share:1", "https://www.linkedin.com/posts/x")).toBe("https://www.linkedin.com/posts/x");
    expect(linkedInPostUrl("urn:li:share:1")).toBe("https://www.linkedin.com/feed/update/urn:li:share:1/");
  });
});

describe("dateInputValue", () => {
  it("is the local calendar day, wherever the offset puts UTC", () => {
    // Local midnight and a minute before the next one: `toISOString()` would be off by a day in some offsets.
    expect(dateInputValue(new Date(2026, 9, 31, 0, 30))).toBe("2026-10-31");
    expect(dateInputValue(new Date(2026, 9, 31, 23, 30))).toBe("2026-10-31");
    expect(dateInputValue(new Date(2026, 9, 31, 0, 30), 30)).toBe("2026-11-30");
    expect(dateInputValue(new Date(2026, 11, 31, 23, 59), 1)).toBe("2027-01-01");
  });
});

describe("closesAtFromDateInput", () => {
  it("ends the chosen day", () => {
    expect(closesAtFromDateInput("2026-11-17")).toBe("2026-11-17T23:59:59Z");
    expect(closesAtFromDateInput("")).toBeUndefined();
  });
});

describe("post links stay on LinkedIn", () => {
  it("refuses a URN carried on another host", () => {
    expect(postUrnFromUrl("https://evil.example/?x=urn:li:share:1")).toBeNull();
    expect(postUrnFromUrl("https://www.linkedin.com.evil.example/feed/update/urn:li:share:1/")).toBeNull();
    expect(postUrnFromUrl("https://www.linkedin.com@evil.example/feed/update/urn:li:share:1/")).toBeNull();
    expect(postUrnFromUrl("http://www.linkedin.com/feed/update/urn:li:share:1/")).toBeNull();
    expect(postUrnFromUrl("javascript:alert('urn:li:share:1')")).toBeNull();
  });

  it("reads a protocol-relative or scheme-less link only when its host is allowed", () => {
    expect(postUrnFromUrl("//evil.example/feed/update/urn:li:share:1/")).toBeNull();
    expect(postUrnFromUrl("evil.example/feed/update/urn:li:share:1/")).toBeNull();
    expect(postUrnFromUrl("/feed/update/urn:li:share:1/")).toBeNull();
    expect(postUrnFromUrl("see urn:li:share:1 here")).toBeNull();
    expect(postUrnFromUrl("//www.linkedin.com/feed/update/urn:li:share:7123/")).toBe("urn:li:share:7123");
    expect(postUrnFromUrl("www.linkedin.com/feed/update/urn:li:share:7123/")).toBe("urn:li:share:7123");
  });

  it("still takes a bare URN (registered without a link)", () => {
    expect(postUrnFromUrl("urn:li:share:7123")).toBe("urn:li:share:7123");
    expect(isAllowedLink("urn:li:share:7123")).toBe(false);
  });

  it("accepts the mock LinkedIn only where it's listed (dev and demos)", () => {
    const mock = "http://localhost:19091/feed/update/urn:li:share:7123/";
    expect(postUrnFromUrl(mock)).toBeNull();
    expect(postUrnFromUrl(mock, ["https://www.linkedin.com", "http://localhost:19091"])).toBe("urn:li:share:7123");
  });

  it("never renders a stored link from another host", () => {
    expect(linkedInPostUrl("urn:li:share:1", "https://evil.example/p")).toBe(
      "https://www.linkedin.com/feed/update/urn:li:share:1/",
    );
    expect(linkedInPostUrl("urn:li:share:1", "javascript:alert(1)")).toBe(
      "https://www.linkedin.com/feed/update/urn:li:share:1/",
    );
  });

  it("reads the origin of http(s) URLs only", () => {
    expect(originOf("https://WWW.LinkedIn.com/feed")).toBe("https://www.linkedin.com");
    expect(originOf("https://u:p@www.linkedin.com/")).toBeNull();
    expect(originOf("ftp://www.linkedin.com/")).toBeNull();
    expect(originOf("not a url")).toBeNull();
  });
});

