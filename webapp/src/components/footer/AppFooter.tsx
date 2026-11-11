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

import { Box, Stack } from "@wso2/oxygen-ui";
import { legalLinks } from "@config/legalLinksConfig";

// App-wide footer. Same shape as cs-tools/apps/customer-portal — copyright
// on the left, legal links on the right. Rendered inside the content
// column below <Outlet /> so it sits under the page content, aligned
// with the sidebar's bottom. The legal links come from config.js
// (ONE_WSO2_TERMS_OF_USE_URL, ONE_WSO2_PRIVACY_POLICY_URL); see
// @config/legalLinksConfig.
export default function AppFooter() {
  return (
    <Box
      component="footer"
      sx={{
        px: 3,
        py: 1.5,
        borderTop: 1,
        borderColor: "divider",
        backgroundColor: "background.paper",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
        fontSize: 12,
        color: "text.secondary",
      }}
    >
      <span>© 2026 WSO2 LLC. All rights reserved.</span>
      <Stack direction="row" spacing={3}>
        {legalLinks.termsOfUseUrl && (
          <FooterLink href={legalLinks.termsOfUseUrl}>Terms &amp; Conditions</FooterLink>
        )}
        {legalLinks.privacyPolicyUrl && (
          <FooterLink href={legalLinks.privacyPolicyUrl}>Privacy Policy</FooterLink>
        )}
      </Stack>
    </Box>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Box
      component="a"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        color: "text.secondary",
        textDecoration: "none",
        "&:hover": { color: "primary.main", textDecoration: "underline" },
      }}
    >
      {children}
    </Box>
  );
}
