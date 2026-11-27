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

import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  LinearProgress,
  ListItemIcon,
  Menu,
  MenuItem,
  Typography,
  useTheme,
} from "@wso2/oxygen-ui";
import { Archive, ArchiveRestore, MoreVertical, Pencil, ShieldCheck, Trash2 } from "@wso2/oxygen-ui-icons-react";
import { type JSX, useState } from "react";
import { auditDisplayName } from "@features/security/grc/modules/audit/utils/format";
import type { Audit, AuditFramework } from "@features/security/grc/modules/audit/types/audit";

// Number of active audits previewed on the card before "+N more".
const AUDIT_PREVIEW = 3;

// Same accent convention as AuditCard: green = in use, grey = idle/archived.
const ACTIVE_ACCENT = "#2E7D32";
const IDLE_ACCENT = "#757575";

interface FrameworkManageCardProps {
  framework: AuditFramework;
  /** Non-removed audits under this framework. */
  audits: Audit[];
  /** Edit / archive / delete are offered only when the user may manage frameworks. */
  canManage: boolean;
  onEdit: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
  /** Opens the framework's control library. Clicking the card (or Enter / Space on it) does this. */
  onViewControls: () => void;
}

/** A framework on the Frameworks page: click it to see its controls; manage it from its menu. */
export default function FrameworkManageCard({
  framework,
  audits,
  canManage,
  onEdit,
  onArchiveToggle,
  onDelete,
  onViewControls,
}: FrameworkManageCardProps): JSX.Element {
  const theme = useTheme();
  const color = theme.palette.primary.main;
  const archived = framework.status === "ARCHIVED";
  const activeAudits = audits.filter((a) => a.status === "ACTIVE");
  const activeAuditCount = activeAudits.length;
  const preview = activeAudits.slice(0, AUDIT_PREVIEW);
  const moreCount = activeAuditCount - preview.length;
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const run = (action: () => void) => () => {
    setMenuAnchor(null);
    action();
  };

  return (
    <Card
      variant="outlined"
      role="button"
      tabIndex={0}
      aria-label={`View controls of ${framework.name}`}
      onClick={onViewControls}
      onKeyDown={(e) => {
        // Only when the card itself has focus — not the actions button inside it.
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onViewControls();
        }
      }}
      sx={{
        height: "100%",
        position: "relative",
        cursor: "pointer",
        borderLeft: `3px solid ${archived || activeAuditCount === 0 ? IDLE_ACCENT : ACTIVE_ACCENT}`,
        transition: "box-shadow 0.2s",
        "&:hover": { boxShadow: 4 },
      }}
    >
      {canManage && (
        <>
          <Box sx={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}>
            <IconButton
              size="small"
              aria-label={`Actions for ${framework.name}`}
              onClick={(e) => {
                e.stopPropagation(); // don't also open the controls dialog
                setMenuAnchor(e.currentTarget);
              }}
              sx={{ color: "text.secondary" }}
            >
              <MoreVertical size={16} />
            </IconButton>
          </Box>
          {/* The menu is portalled, but React events still bubble to the card. */}
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            onClick={(e) => e.stopPropagation()}
          >
            <MenuItem onClick={run(onEdit)}>
              <ListItemIcon>
                <Pencil size={16} />
              </ListItemIcon>
              Edit framework
            </MenuItem>
            <MenuItem onClick={run(onArchiveToggle)}>
              <ListItemIcon>{archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}</ListItemIcon>
              {archived ? "Restore framework" : "Archive framework"}
            </MenuItem>
            <MenuItem onClick={run(onDelete)} sx={{ color: "error.main" }}>
              <ListItemIcon sx={{ color: "error.main" }}>
                <Trash2 size={16} />
              </ListItemIcon>
              Delete framework
            </MenuItem>
          </Menu>
        </>
      )}

      <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 1.5, p: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: canManage ? 3.5 : 0 }}>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            {activeAuditCount > 0 ? (
              <Chip label={`${activeAuditCount} active`} size="small" color="success" variant="outlined" />
            ) : (
              <Chip label={audits.length > 0 ? "No active audits" : "No audits yet"} size="small" variant="outlined" />
            )}
            {archived && <Chip label="Archived" size="small" variant="outlined" />}
          </Box>
          <Box
            sx={{
              width: 40, height: 40, borderRadius: 1.5, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              color, bgcolor: `${color}18`,
              "[data-color-scheme='dark'] &": { bgcolor: `${color}33` },
            }}
          >
            <ShieldCheck size={20} />
          </Box>
        </Box>

        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.3, mt: -0.5 }}>
          {framework.name}
        </Typography>

        <Divider sx={{ mt: "auto" }} />

        {/* The framework's active audits, each with its approval progress. */}
        {preview.length > 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {preview.map((a) => {
              const pct = a.controlCounts.total > 0
                ? Math.round((a.controlCounts.approved / a.controlCounts.total) * 100)
                : 0;
              return (
                <Box key={a.id}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5, gap: 1 }}>
                    <Typography variant="caption" color="text.secondary" noWrap title={auditDisplayName(a)}>
                      {auditDisplayName(a)}
                    </Typography>
                    <Typography variant="caption" fontWeight={700} sx={{ color, flexShrink: 0 }}>
                      {pct}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    aria-label={`${auditDisplayName(a)} approval progress`}
                    sx={{
                      height: 6, borderRadius: 3, bgcolor: "#E0E0E0",
                      "[data-color-scheme='dark'] &": { bgcolor: "rgba(255,255,255,0.12)" },
                      "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 3 },
                    }}
                  />
                </Box>
              );
            })}
            {moreCount > 0 && (
              <Typography variant="caption" color="text.secondary">
                +{moreCount} more active audit{moreCount === 1 ? "" : "s"}
              </Typography>
            )}
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary">
            {audits.length > 0 ? "No active audits" : "No audits yet"}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
