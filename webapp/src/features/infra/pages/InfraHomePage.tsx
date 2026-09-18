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

import { Box, Button, Card, Typography } from "@wso2/oxygen-ui";
import { Link as RouterLink } from "react-router";
import { INFRA_APPS } from "@constants/infraApps";
import InfraShell from "../components/InfraShell";
import { useInfraGate } from "../api/useInfraGate";
import { primaryBtnSx } from "../components/infraUi";

export default function InfraHomePage() {
  const gate = useInfraGate();

  const visible = INFRA_APPS.map((app) => ({
    app,
    items: app.items.filter((it) => gate.canSee(it.id)),
  })).filter(({ items }) => items.length > 0);

  return (
    <InfraShell
        title="Infra Portal"
        subtitle="GitHub requests, repository access and the Security Dashboard."
    >
        {visible.map(({ app, items }) => (
            <Box key={app.key}>
            <SectionHeader>
            <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                <app.icon key="icon" size={14} />
                <Box key="label" component="span">{app.name}</Box>
            </Box>
            </SectionHeader>
            <Card variant="outlined" sx={{ p: 3, maxWidth: 480 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {app.purpose}
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {items.map((it) => (
                    <Box key={it.id} id={it.id} sx={{ scrollMarginTop: 14 }}>
                    <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{it.label}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {it.desc}
                    </Typography>
                    {it.path ? (
                        <Button
                        component={RouterLink}
                        to={it.path}
                        variant="outlined"
                        size="small"
                        sx={primaryBtnSx}
                        >
                        Open {it.label.toLowerCase()}
                        </Button>
                    ) : (
                        <Typography variant="body2" color="text.disabled">
                        Not here yet
                        </Typography>
                    )}
                    </Box>
                ))}
                </Box>
            </Card>
            </Box>
        ))}
    </InfraShell>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      component="h2"
      sx={{
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "text.disabled",
        fontWeight: 700,
        mt: 3,
        mb: 1.25,
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        "&::before": { content: '""', width: 14, height: "1px", bgcolor: "divider" },
        "&::after": { content: '""', flex: 1, height: "1px", bgcolor: "divider" },
      }}
    >
      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
        {children}
      </Box>
    </Typography>
  );
}