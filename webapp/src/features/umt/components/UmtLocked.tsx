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

import { Box, Button, Card, Divider, Typography } from "@wso2/oxygen-ui";
import {
  ArrowLeftIcon,
  BarChart3,
  Box as BoxIcon,
  LockIcon,
  LucideLayoutGrid,
  RefreshCcw,
} from "@wso2/oxygen-ui-icons-react";
import { Link as RouterLink } from "react-router";

const UMT_FEATURES = [
  { label: "Update Management", icon: RefreshCcw },
  { label: "Product Management", icon: BoxIcon },
  { label: "Release Chunks", icon: LucideLayoutGrid },
  { label: "Update Statistics", icon: BarChart3 },
] as const;

// Rendered only after /update/user-info succeeds with no recognised UMT role.
// A neutral card distinguishes a permissions decision from UmtShell's request
// error, while the feature list gives the user concrete language for the access
// they need to request. The list stays local until those features have routes
// and a shared UMT navigation registry of their own.
export default function UmtLocked() {
  return (
    <Card variant="outlined" sx={{ mt: 1.5, p: 3, maxWidth: 620 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.75 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: 1.5,
            display: "grid",
            placeItems: "center",
            bgcolor: "background.default",
            border: 1,
            borderColor: "divider",
            color: "text.secondary",
          }}
          aria-hidden="true"
        >
          <LockIcon size={19} />
        </Box>
        <Box>
          <Typography
            component="h2"
            sx={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", mb: 0.6 }}
          >
            You don&apos;t have access yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "52ch" }}>
            Access comes from your Asgardeo groups. Ask a UMT administrator to add you to
            Updates Manager.
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ my: 2.25 }} />

      <Typography
        component="h3"
        variant="overline"
        sx={{ color: "text.secondary", display: "block", mb: 1.25 }}
      >
        What&apos;s inside
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: "0.55rem 1.5rem",
        }}
      >
        {UMT_FEATURES.map((feature) => (
          <Box
            key={feature.label}
            sx={{ display: "flex", alignItems: "center", gap: 1.15, minWidth: 0 }}
          >
            {/* Decorative: the panel has already stated that every item is locked. */}
            <Box
              sx={{
                width: 22,
                height: 22,
                flexShrink: 0,
                borderRadius: 0.75,
                display: "grid",
                placeItems: "center",
                bgcolor: "background.default",
                border: 1,
                borderColor: "divider",
                color: "text.secondary",
              }}
              aria-hidden="true"
            >
              <feature.icon size={13} />
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {feature.label}
            </Typography>
            <Box
              sx={{ ml: "auto", display: "flex", color: "text.disabled", flexShrink: 0 }}
              aria-hidden="true"
            >
              <LockIcon size={12} />
            </Box>
          </Box>
        ))}
      </Box>

      <Divider sx={{ my: 2.25 }} />

      {/* /me is available to every authenticated employee, so it is a safe exit. */}
      <Button
        component={RouterLink}
        to="/me"
        variant="outlined"
        startIcon={<ArrowLeftIcon size={15} />}
        sx={{ textTransform: "none", fontSize: 13, fontWeight: 600 }}
      >
        Back to Home
      </Button>
    </Card>
  );
}
