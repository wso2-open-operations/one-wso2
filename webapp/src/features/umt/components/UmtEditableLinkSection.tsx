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

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon, TrashIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import {
  DenseTable,
  EmptySectionText,
  renderLinkValue,
  type DenseColumn,
} from "./umtViewSectionPrimitives";

export default function EditableLinkSection({
  title,
  ariaLabel,
  columnLabel,
  hideColumnHeader = false,
  emptyText,
  items,
  canAdd,
  canDelete,
  requireAtLeastOne = false,
  addDialogTitle,
  addFieldLabel,
  validate,
  isSaving,
  onSave,
}: {
  title?: string;
  ariaLabel: string;
  columnLabel: string;
  hideColumnHeader?: boolean;
  emptyText: string;
  items: string[];
  canAdd: boolean;
  canDelete: boolean;
  requireAtLeastOne?: boolean;
  addDialogTitle: string;
  addFieldLabel: string;
  validate?: (value: string) => string | undefined;
  isSaving: boolean;
  onSave: (nextItems: string[]) => Promise<unknown>;
}) {
  const { showSuccess, showError } = useNotifications();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [value, setValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ index: number; value: string } | null>(null);

  const trimmed = value.trim();
  const validationError = trimmed ? validate?.(trimmed) : undefined;

  async function handleAdd() {
    if (!trimmed || validationError) return;
    try {
      await onSave([...items, trimmed]);
      showSuccess(`${addFieldLabel} added.`);
      setIsAddOpen(false);
      setValue("");
    } catch (error) {
      showError(`Failed to add ${addFieldLabel.toLowerCase()}. ${describeError(error)}`);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    // Both guards below exist because the list can change under an open dialog:
    // `onSave` replaces it wholesale and a background `["umt-update"]` refetch
    // can reorder or shrink it between opening the dialog and confirming.

    // Re-check the invariant rather than relying on `deleteDisabled`, which is
    // computed at render to gate the button: a refetch can shrink the list to
    // its last entry while this dialog is already open, and the identity check
    // below would still pass if that entry happens to be the target.
    if (requireAtLeastOne && items.length <= 1) {
      showError(`At least one ${addFieldLabel.toLowerCase()} is required.`);
      setDeleteTarget(null);
      return;
    }
    // Delete by position, not by value: nothing stops these lists holding two
    // identical entries (add has no duplicate check, and two of the three
    // sections pass no `validate` at all), and a value filter would remove
    // every copy. The value is re-checked here so a reorder can't redirect the
    // delete onto a different row.
    if (items[deleteTarget.index] !== deleteTarget.value) {
      showError(
        `This ${addFieldLabel.toLowerCase()} changed while the dialog was open. Reopen and try again.`,
      );
      setDeleteTarget(null);
      return;
    }
    try {
      await onSave(items.filter((_item, index) => index !== deleteTarget.index));
      showSuccess(`${addFieldLabel} deleted.`);
    } catch (error) {
      showError(`Failed to delete ${addFieldLabel.toLowerCase()}. ${describeError(error)}`);
    } finally {
      setDeleteTarget(null);
    }
  }

  const deleteDisabled = requireAtLeastOne && items.length <= 1;

  const columns: DenseColumn<string>[] = [
    { key: "value", label: columnLabel, render: renderLinkValue },
    ...(canDelete
      ? [
          {
            key: "delete",
            label: "",
            width: 52,
            render: (row: string, index: number) =>
              deleteDisabled ? (
                <Tooltip title={`At least one ${addFieldLabel} is required`}>
                  <span>
                    <IconButton size="small" disabled aria-label={`Delete ${addFieldLabel.toLowerCase()}`}>
                      <TrashIcon size={16} />
                    </IconButton>
                  </span>
                </Tooltip>
              ) : (
                <IconButton
                  size="small"
                  aria-label={`Delete ${addFieldLabel.toLowerCase()}`}
                  onClick={() => setDeleteTarget({ index, value: row })}
                >
                  <TrashIcon size={16} />
                </IconButton>
              ),
          },
        ]
      : []),
  ];

  const content = (
    <>
      {items.length > 0 ? (
        <DenseTable ariaLabel={ariaLabel} columns={columns} rows={items} rowKey={(row, index) => `${row}-${index}`} hideHeader={hideColumnHeader} />
      ) : (
        <EmptySectionText>{emptyText}</EmptySectionText>
      )}

      <Dialog open={isAddOpen} onClose={() => setIsAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{addDialogTitle}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label={addFieldLabel}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            error={Boolean(validationError)}
            helperText={validationError}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAddOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!trimmed || Boolean(validationError)} loading={isSaving} onClick={() => void handleAdd()}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete this {addFieldLabel.toLowerCase()}?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" loading={isSaving} onClick={() => void handleConfirmDelete()}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );

  if (!title) return content;

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Typography component="h5" variant="h5" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {canAdd && (
          <IconButton aria-label={`Add ${addFieldLabel.toLowerCase()}`} size="small" onClick={() => setIsAddOpen(true)}>
            <PlusIcon size={18} />
          </IconButton>
        )}
      </Stack>
      {content}
    </Stack>
  );
}
