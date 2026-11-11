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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PRIVACY_POLICY_URL, DEFAULT_TERMS_OF_USE_URL } from "@config/legalLinksConfig";

// legalLinks resolves at module load, so each case needs a fresh import against
// its own window.config.
async function loadWith(config: Record<string, unknown> | undefined) {
  vi.resetModules();
  (window as unknown as { config?: Record<string, unknown> }).config = config;
  return (await import("@config/legalLinksConfig")).legalLinks;
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  delete (window as unknown as { config?: unknown }).config;
});

describe("legalLinks", () => {
  it("keeps WSO2's public pages when the keys are unset", async () => {
    for (const config of [undefined, {}]) {
      expect(await loadWith(config)).toEqual({
        termsOfUseUrl: DEFAULT_TERMS_OF_USE_URL,
        privacyPolicyUrl: DEFAULT_PRIVACY_POLICY_URL,
      });
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it("uses the configured URLs, trimmed", async () => {
    const links = await loadWith({
      ONE_WSO2_TERMS_OF_USE_URL: "https://example.test/terms",
      ONE_WSO2_PRIVACY_POLICY_URL: "  https://example.test/privacy  ",
    });
    expect(links.termsOfUseUrl).toBe("https://example.test/terms");
    expect(links.privacyPolicyUrl).toBe("https://example.test/privacy");
  });

  it("hides a link set to an empty string", async () => {
    const links = await loadWith({ ONE_WSO2_PRIVACY_POLICY_URL: " " });
    expect(links.privacyPolicyUrl).toBe("");
    expect(links.termsOfUseUrl).toBe(DEFAULT_TERMS_OF_USE_URL);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ["a javascript: URL", "javascript:alert(1)"],
    ["a relative path", "/privacy"],
    ["a non-string", 42],
  ])("falls back to the default for %s, and warns", async (_label, value) => {
    const links = await loadWith({ ONE_WSO2_PRIVACY_POLICY_URL: value });
    expect(links.privacyPolicyUrl).toBe(DEFAULT_PRIVACY_POLICY_URL);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("ONE_WSO2_PRIVACY_POLICY_URL"));
  });
});
