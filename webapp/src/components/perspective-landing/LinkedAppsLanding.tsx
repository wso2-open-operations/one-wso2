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

import type { JSX } from "react";
import { Box, Card, CardActionArea, Typography } from "@wso2/oxygen-ui";
import { ExternalLinkIcon } from "@wso2/oxygen-ui-icons-react";
import { otherAppUrls } from "@config/apiConfig";
import { OTHER_APPS, VPN_ONLY_SUFFIX, type OtherAppPerspective } from "@constants/otherApps";
import { PERSPECTIVES } from "@constants/perspectives";
import { NothingHere, PageTitle } from "./PerspectiveLanding";

/**
 * The landing of a perspective made only of links to apps outside One WSO2
 * (Customer Success). PerspectiveLanding forwards to the
 * first in-app screen, and these have none, so this lists the apps instead: one
 * card each, opening the app in a new tab, the same apps as the rail.
 */
export default function LinkedAppsLanding({
  perspective,
  urls = otherAppUrls,
}: {
  perspective: OtherAppPerspective;
  /** App id → address; defaults to `ONE_WSO2_OTHER_APP_URLS`. */
  urls?: Readonly<Record<string, string>>;
}): JSX.Element {
  const def = PERSPECTIVES.find((p) => p.key === perspective);
  const label = def?.label ?? perspective;
  const apps = OTHER_APPS.filter((app) => app.perspective === perspective && urls[app.id]);

  if (apps.length === 0) {
    return (
      <Box>
        <PageTitle label={label} />
        {def ? <NothingHere label={label} icon={def.icon} /> : null}
      </Box>
    );
  }

  return (
    <Box>
      <PageTitle label={label} />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        These apps are outside One WSO2 and open in a new tab.
      </Typography>
      <Box
        component="ul"
        sx={{
          m: 0,
          p: 0,
          listStyle: "none",
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        }}
      >
        {apps.map((app) => {
          const Icon = app.icon;
          return (
            <Box component="li" key={app.id}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardActionArea
                  component="a"
                  href={urls[app.id]}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ p: 2, height: "100%", display: "flex", alignItems: "flex-start", gap: 1.5 }}
                >
                  <Box sx={{ display: "flex", color: "text.secondary", mt: 0.25 }}>
                    <Icon size={20} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" component="span" sx={{ display: "block" }}>
                      {app.vpnOnly ? `${app.label}${VPN_ONLY_SUFFIX}` : app.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {app.hint}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", color: "text.secondary" }}>
                    <ExternalLinkIcon size={14} aria-hidden />
                    <Box component="span" sx={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                      (opens in a new tab)
                    </Box>
                  </Box>
                </CardActionArea>
              </Card>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
