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
import { productsApi, frameworksApi, controlsApi, evidenceApi, submissionsApi, agentApi } from "../api/client";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import ProductFormDialog, { type Product } from "./ProductFormDialog";
import { computeDeleteImpact } from "../utils/computeDeleteImpact";
import { resolveHoverText } from "../utils/resolveHoverText";
import { useCurrentUser } from "../hooks/useCurrentUser";

type Framework = { id: number; product_id: number };
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
  value: number | "";
  onChange: (id: number | "") => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  includeAll?: boolean;
  allLabel?: string;
  helperText?: string;
  size?: "small" | "medium";
  fullWidth?: boolean;
};

const SENTINEL_CREATE = -2;

export default function ProductPicker({
  value,
  onChange,
  label = "Product",
  required = false,
  disabled = false,
  includeAll = false,
  allLabel = "All Products",
  helperText,
  size = "medium",
  fullWidth = true,
}: Props) {
  const queryClient = useQueryClient();
  const { isAdmin } = useCurrentUser();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: productsApi.list,
  });

  // Load dependent data only when delete is being considered, so we can show
  // accurate cascade impact in the confirm dialog.
  const { data: allFrameworks = [], isLoading: isFrameworksLoading } = useQuery<Framework[]>({
    queryKey: ["frameworks"],
    queryFn: () => frameworksApi.list(),
    enabled: !!deleteTarget,
  });
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
  // under this product.
  const { data: allTasks = [], isLoading: isTasksLoading } = useQuery<AgentTask[]>({
    queryKey: ["agent-tasks"],
    queryFn: () => agentApi.listTasks(500),
    enabled: !!deleteTarget,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
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
      setDeleteError(detail || "Failed to delete product.");
    },
  });

  // Computed once per render and reused for both the impact list and the
  // warnings passed to the confirm dialog below.
  const deleteImpact = deleteTarget
    ? computeDeleteImpact({
        level: "product",
        targetId: deleteTarget.id,
        frameworks: allFrameworks,
        controls: allControls,
        evidence: allEvidence,
        submissions: allSubmissions,
        tasks: allTasks,
      })
    : { impact: [], warnings: [] };

  return (
    <>
      <FormControl fullWidth={fullWidth} required={required} disabled={disabled} size={size}>
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
          {includeAll && (
            <MenuItem value="">
              <em>{allLabel}</em>
            </MenuItem>
          )}
          {products.map((p) => (
            <MenuItem key={p.id} value={p.id} sx={{ pr: 1 }}>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ width: "100%" }}
              >
                {/* Tooltip wraps this text block only, never the MenuItem
                    itself — Select reads the properties of its own menu
                    children directly, so wrapping a row can break selection. */}
                <Tooltip title={resolveHoverText(p)} placement="bottom-start">
                  <Box sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.name}
                  </Box>
                </Tooltip>
                {isAdmin && (
                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      aria-label="Edit product"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditTarget(p);
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
                      aria-label="Delete product"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteError(null);
                        setDeleteTarget(p);
                      }}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            </MenuItem>
          ))}
          {isAdmin && [
            <Divider key="div" />,
            <MenuItem key="create" value={SENTINEL_CREATE} sx={{ color: "primary.main" }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Plus size={16} />
                <Typography variant="body2" fontWeight={600}>
                  Add new product...
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

      <ProductFormDialog
        open={createOpen}
        mode="create"
        onClose={() => setCreateOpen(false)}
        onSaved={(p) => {
          setCreateOpen(false);
          onChange(p.id);
        }}
      />

      <ProductFormDialog
        open={!!editTarget}
        mode="edit"
        product={editTarget ?? undefined}
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
          isFrameworksLoading ||
          isControlsLoading ||
          isEvidenceLoading ||
          isSubmissionsLoading ||
          isTasksLoading
        }
        entityType="product"
        entityName={deleteTarget?.name ?? ""}
        impact={deleteImpact.impact}
        warnings={deleteImpact.warnings}
        error={deleteError}
      />
    </>
  );
}
