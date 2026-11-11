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

// The footer's legal links (Terms & Conditions, Privacy Policy), set per
// deployment in config.js so a new policy page needs no rebuild.
//
//   unset         — WSO2's public page (the links the footer always had).
//   ""            — the link is hidden.
//   an http(s) URL — that URL.
//
// Anything else (a non-string, a typo, a javascript: URL) is ignored with a
// warning and the default is used: config.js is hand-edited, and a legal link
// that silently disappears or points nowhere is worse than the default one.

export const DEFAULT_TERMS_OF_USE_URL = "https://wso2.com/terms-of-use/";
export const DEFAULT_PRIVACY_POLICY_URL = "https://wso2.com/privacy-policy/";

type LegalLinkKey = "ONE_WSO2_TERMS_OF_USE_URL" | "ONE_WSO2_PRIVACY_POLICY_URL";

function resolveLink(key: LegalLinkKey, fallback: string): string {
  const configured: unknown = window.config?.[key];
  if (configured === undefined) return fallback;
  if (typeof configured === "string") {
    const value = configured.trim();
    if (value === "") return "";
    if (isHttpUrl(value)) return value;
  }
  console.warn(`[footer] ${key} must be an http(s) URL or "". Using ${fallback}.`);
  return fallback;
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

export const legalLinks = {
  /** Terms & Conditions; "" hides the link. */
  termsOfUseUrl: resolveLink("ONE_WSO2_TERMS_OF_USE_URL", DEFAULT_TERMS_OF_USE_URL),
  /** Privacy Policy; "" hides the link. */
  privacyPolicyUrl: resolveLink("ONE_WSO2_PRIVACY_POLICY_URL", DEFAULT_PRIVACY_POLICY_URL),
} as const;
