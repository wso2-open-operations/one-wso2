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
import type { AmplifyAppConfig, AmplifyMe } from "./amplifyTypes";
import { amplifyConfigFrom } from "./useAmplifyData";

const me = (config: AmplifyAppConfig): AmplifyMe => ({
  employee: { employeeId: "e-1", email: "e@wso2.com", displayName: "E" },
  roles: [],
  grants: [],
  capabilities: [],
  linkedin: { status: "NOT_CONNECTED" },
  config: { ...config, nativeRepostDefault: false },
});

describe("amplifyConfigFrom", () => {
  it("reads /me's campaignLinkOrigins, the wire name, so the consent popup follows the local mock", () => {
    const config = amplifyConfigFrom(
      me({
        linkedinOrgUrn: "urn:li:organization:1",
        privacyNoticeUrl: "https://choreolabs.com/privacy-policy",
        campaignLinkOrigins: ["https://www.linkedin.com", "http://localhost:19091"],
      }),
    );
    expect(config.linkedinOrgUrn).toBe("urn:li:organization:1");
    expect(config.privacyNoticeUrl).toBe("https://choreolabs.com/privacy-policy");
    expect(config.campaignLinkOrigins).toEqual(["https://www.linkedin.com", "http://localhost:19091"]);
  });

  it("falls back to LinkedIn only while /me is missing or lists no origins", () => {
    const linkedinOnly = ["https://www.linkedin.com", "https://linkedin.com"];
    expect(amplifyConfigFrom(undefined).campaignLinkOrigins).toEqual(linkedinOnly);
    expect(
      amplifyConfigFrom(me({ linkedinOrgUrn: "", privacyNoticeUrl: "", campaignLinkOrigins: [] }))
        .campaignLinkOrigins,
    ).toEqual(linkedinOnly);
  });
});
