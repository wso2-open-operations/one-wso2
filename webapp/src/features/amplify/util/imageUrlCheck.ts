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

import type { UrlChecker } from "./useUrlCheck";

/** How long an image gets to load before it counts as bad. */
export const IMAGE_CHECK_TIMEOUT_MS = 8000;

/**
 * Checks an image URL the way the cards will use it: load it in the browser. That needs no
 * CORS and no backend. It is also subject to the page's Content-Security-Policy img-src,
 * so a host the policy blocks reports bad even when the URL is fine; the reason says so.
 */
export const checkImageUrl: UrlChecker = (value, signal) =>
  new Promise((resolve) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      resolve({ verdict: "bad", message: "That isn't a valid web address." });
      return;
    }
    if (url.protocol !== "https:") {
      resolve({ verdict: "bad", message: "Use an HTTPS link to the image." });
      return;
    }

    const img = new Image();
    let blocked = false;
    let finished = false;
    const onViolation = (e: SecurityPolicyViolationEvent) => {
      if (e.effectiveDirective === "img-src" && e.blockedURI === url.href) blocked = true;
    };
    const finish = (result: Parameters<typeof resolve>[0]) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      document.removeEventListener("securitypolicyviolation", onViolation);
      signal.removeEventListener("abort", onAbort);
      img.onload = null;
      img.onerror = null;
      resolve(result);
    };
    const onAbort = () => finish("unknown");
    const timer = setTimeout(
      () => finish({ verdict: "bad", message: "The image didn't load in time." }),
      IMAGE_CHECK_TIMEOUT_MS,
    );
    document.addEventListener("securitypolicyviolation", onViolation);
    signal.addEventListener("abort", onAbort);
    img.onload = () => finish("ok");
    img.onerror = () =>
      // The violation event is queued before the error event, so `blocked` is set by now.
      finish({
        verdict: "bad",
        message: blocked
          ? "This site doesn't allow images from that host yet. Ask the One WSO2 team to add it."
          : "That link didn't load as an image.",
      });
    img.src = url.href;
  });
