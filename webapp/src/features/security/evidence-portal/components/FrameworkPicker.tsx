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

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { FormControl, InputLabel, Select, MenuItem, Box, Stack, Typography, Divider, IconButton, Tooltip } from "@wso2/oxygen-ui";
import { Plus, SquarePen, Trash2 } from "@wso2/oxygen-ui-icons-react";
import { frameworksApi, controlsApi, evidenceApi, submissionsApi, agentApi } from "../api/client";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import FrameworkFormDialog, { type Framework } from "./FrameworkFormDialog";
import { computeDeleteImpact } from "../utils/computeDeleteImpact";
import { resolveHoverText } from "../utils/resolveHoverText";
import { useCurrentUser } from "../hooks/useCurrentUser";

type Control = { id: number; framework_id: number };
type Evidence = { id: number; control_id: number };
type Submission = { id: number; evidence_id: number; status: string };
type AgentTask = {
  status: string;
  control_id: number | null;
  started_at: string | null;
  user_email: string;
};

type Props = {
  productId: number | "";
  value: number | "";
  onChange: (id: number | "") => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholderOption?: string;
  helperText?: string;
};

const SENTINEL_CREATE = -2;

export default function FrameworkPicker({
  productId,
  value,
  onChange,
  label = "Framework",
  required = false,
  disabled = false,
  placeholderOption,
  helperText,
}: Props) {
  const queryClient = useQueryClient();
  const { isAdmin } = useCurrentUser();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Framework | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Framework | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: frameworks = [] } = useQuery<Framework[]>({
    queryKey: ["frameworks", productId || undefined],
    queryFn: () => frameworksApi.list(productId ? Number(productId) : undefined),
    enabled: !!productId,
  });

  // Lazy-loaded for cascade-impact display
  const { data: allControls = [], isLoading: isControlsLoading } = useQuery<Control[]>({
    queryKey: ["controls"],
    queryFn: () => controlsApi.list(),
    enabled: !!deleteTarget,
  });
  const { data: allEvidence = [], isLoading: isEvidenceLoading } = useQuery<Evidence[]>({
    queryKey: ["evidence"],
    queryFn: evidenceApi.list,
    enabled: !!deleteTarget,
  });
  const { data: allSubmissions = [], isLoading: isSubmissionsLoading } = useQuery<Submission[]>({
    queryKey: ["submissions"],
    queryFn: submissionsApi.list,
    enabled: !!deleteTarget,
  });
  // Only fetched while the delete dialog is open, so we can warn about an
  // agent run that's still (or claims to be) in progress against a control
  // under this framework.
  const { data: allTasks = [], isLoading: isTasksLoading } = useQuery<AgentTask[]>({
    queryKey: ["agent-tasks"],
    queryFn: () => agentApi.listTasks(500),
    enabled: !!deleteTarget,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => frameworksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["frameworks"] });
      queryClient.invalidateQueries({ queryKey: ["controls"] });
      queryClient.invalidateQueries({ queryKey: ["evidence"] });
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      if (deleteTarget && value === deleteTarget.id) onChange("");
      setDeleteTarget(null);
      setDeleteError(null);
    },
    onError: (err: unknown) => {
      const detail = isAxiosError(err) ? (err.response?.data as { detail?: string } | undefined)?.detail : undefined;
      setDeleteError(detail || "Failed to delete framework.");
    },
  });

  const effectivelyDisabled = disabled || !productId;

  // Computed once per render and reused for both the impact list and the
  // warnings passed to the confirm dialog below.
  const deleteImpact = deleteTarget
    ? computeDeleteImpact({
        level: "framework",
        targetId: deleteTarget.id,
        frameworks: [],
        controls: allControls,
        evidence: allEvidence,
        submissions: allSubmissions,
        tasks: allTasks,
      })
    : { impact: [], warnings: [] };

  return (
    <>
      <FormControl fullWidth required={required} disabled={effectivelyDisabled}>
        <InputLabel>{label}</InputLabel>
        <Select
          label={label}
          value={value}
          onChange={(e) => {
            // Oxygen UI's Select (MUI 7) infers this generic's value type as
            // plain `number`, dropping the `""` branch of the `value` prop's
            // own `number | ""` type — so the empty-string comparison below
            // needs an explicit cast to keep compiling. No behaviour change:
            // the runtime value is exactly what MenuItem sent either way.
            const v = e.target.value as number | "";
            if (v === SENTINEL_CREATE) {
              setCreateOpen(true);
              return;
            }
            onChange((v === "" ? "" : Number(v)) as number | "");
          }}
        >
          {placeholderOption !== undefined && (
            <MenuItem value="">
              <em>{placeholderOption}</em>
            </MenuItem>
          )}
          {frameworks.map((f) => (
            <MenuItem key={f.id} value={f.id} sx={{ pr: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ width: "100%" }}>
                {/* Tooltip wraps this text block only, never the MenuItem
                    itself — Select reads the properties of its own menu
                    children directly, so wrapping a row can break selection. */}
                <Tooltip title={resolveHoverText(f)} placement="bottom-start">
                  <Box sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {f.name}
                  </Box>
                </Tooltip>
                {isAdmin && (
                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      aria-label="Edit framework"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditTarget(f);
                      }}
                    >
                      <SquarePen size={14} />
                    </IconButton>
                  </Tooltip>
                )}
                {isAdmin && (
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      color="error"
                      aria-label="Delete framework"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteError(null);
                        setDeleteTarget(f);
                      }}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            </MenuItem>
          ))}
          {isAdmin && productId !== "" && [
            <Divider key="div" />,
            <MenuItem key="create" value={SENTINEL_CREATE} sx={{ color: "primary.main" }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Plus size={16} />
                <Typography variant="body2" fontWeight={600}>
                  Add new framework...
                </Typography>
              </Stack>
            </MenuItem>,
          ]}
        </Select>
        {helperText && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.5 }}>
            {helperText}
          </Typography>
        )}
      </FormControl>

      <FrameworkFormDialog
        open={createOpen}
        mode="create"
        productId={productId === "" ? 0 : Number(productId)}
        onClose={() => setCreateOpen(false)}
        onSaved={(fw) => {
          setCreateOpen(false);
          onChange(fw.id);
        }}
      />

      <FrameworkFormDialog
        open={!!editTarget}
        mode="edit"
        productId={editTarget?.product_id ?? 0}
        framework={editTarget ?? undefined}
        onClose={() => setEditTarget(null)}
        onSaved={() => setEditTarget(null)}
      />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isPending={deleteMutation.isPending}
        impactLoading={
          isControlsLoading || isEvidenceLoading || isSubmissionsLoading || isTasksLoading
        }
        entityType="framework"
        entityName={deleteTarget?.name ?? ""}
        impact={deleteImpact.impact}
        warnings={deleteImpact.warnings}
        error={deleteError}
      />
    </>
  );
}
