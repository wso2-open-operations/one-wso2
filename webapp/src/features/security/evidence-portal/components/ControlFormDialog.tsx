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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Box, Stack, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Alert } from "@wso2/oxygen-ui";
import { Plus, SquarePen } from "@wso2/oxygen-ui-icons-react";
import { controlsApi } from "../api/client";

export type Control = {
  id: number;
  framework_id: number;
  control_ref: string;
  title: string;
  description?: string | null;
};

/**
 * The single create/edit form for a Control. Used to live as its own
 * private component inside ControlPicker; pulled out here so the coming
 * Admin page can render the same form instead of growing a second one that
 * drifts from this one — see ticket #116.
 */
export default function ControlFormDialog({
  open,
  mode,
  frameworkId,
  control,
  initialText = "",
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  frameworkId: number;
  control?: Control;
  initialText?: string;
  onClose: () => void;
  onSaved: (c: Control) => void;
}) {
  const queryClient = useQueryClient();
  const [controlRef, setControlRef] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset the form the moment this dialog opens, adjusted during render
  // rather than in an effect — same idiom ImportControlsDialog's own
  // `wasOpen` reset uses, and it keeps a setState call reacting to a prop
  // change out of an effect body.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setError(null);
      if (mode === "edit" && control) {
        setControlRef(control.control_ref);
        setTitle(control.title);
        setDescription(control.description ?? "");
      } else {
        setDescription("");
        const match = initialText.match(/^([^—\-:]+?)\s*[—\-:]\s*(.+)$/);
        if (match) {
          setControlRef(match[1].trim());
          setTitle(match[2].trim());
        } else {
          setControlRef("");
          setTitle(initialText);
        }
      }
    }
  }

  const mutation = useMutation({
    mutationFn: (data: { control_ref: string; title: string; description?: string }) =>
      mode === "edit" && control
        ? controlsApi.update(control.id, data)
        : controlsApi.create({ framework_id: frameworkId, ...data }),
    onSuccess: (newControl: Control) => {
      queryClient.invalidateQueries({ queryKey: ["controls"] });
      onSaved(newControl);
    },
    onError: (err: unknown) => {
      const detail = isAxiosError(err) ? (err.response?.data as { detail?: string } | undefined)?.detail : undefined;
      setError(detail || `Failed to ${mode} control. Try again.`);
    },
  });

  const handleSubmit = () => {
    setError(null);
    if (mode === "create" && !frameworkId) {
      setError("Please pick a framework first.");
      return;
    }
    if (!controlRef.trim()) {
      setError("Control reference is required (e.g. CC8.1, Req 9.3).");
      return;
    }
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    mutation.mutate({
      control_ref: controlRef.trim(),
      title: title.trim(),
      description: description.trim() || undefined,
    });
  };

  const isEdit = mode === "edit";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ color: "primary.main", display: "flex" }}>
            {isEdit ? <SquarePen size={22} /> : <Plus size={22} />}
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
              {isEdit ? "Edit Control" : "Add a New Control"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {isEdit ? "Update the reference, title, or description." : "Belongs to the currently selected framework."}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.25} sx={{ pt: 1 }}>
          <TextField
            label="Control Reference"
            value={controlRef}
            onChange={(e) => setControlRef(e.target.value)}
            placeholder='e.g. "CC8.1", "Req 9.3", "§164.312(a)(1)"'
            required
            fullWidth
            helperText="The official identifier from the standard."
          />

          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short human-readable name"
            required
            fullWidth
            helperText="What this control checks for."
          />

          <TextField
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional longer explanation"
            multiline
            rows={2}
            fullWidth
          />

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.75 }}>
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={mutation.isPending}>
          {mutation.isPending ? (isEdit ? "Saving..." : "Creating...") : isEdit ? "Save Changes" : "Create Control"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
