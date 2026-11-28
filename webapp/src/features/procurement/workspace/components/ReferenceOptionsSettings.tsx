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
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Skeleton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { SearchIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useAddReferenceOption, useChangeReferenceOption, useReferenceSettings } from "../../api/useProcurement";
import type { ReferenceKind, ReferenceSetting } from "../../types";

const LISTS: { value: ReferenceKind; label: string }[] = [
  { value: "BUDGET_CATEGORY", label: "Budget categories" },
  { value: "BUSINESS_UNIT", label: "Business units" },
  { value: "PRODUCT", label: "Products" },
  { value: "REGION", label: "Regions" },
];

const MAX_CODE_LENGTH = 50;
const MAX_LABEL_LENGTH = 150;

/** The pop-up for adding an option or changing one, which cannot be dismissed while a save runs. The code is set when the option is added. */
function OptionForm({ kind, option, onClose }: { kind: ReferenceKind; option: ReferenceSetting | null; onClose: () => void }) {
  const add = useAddReferenceOption();
  const change = useChangeReferenceOption();
  const { showSuccess } = useNotifications();
  const [code, setCode] = useState("");
  const [label, setLabel] = useState(option?.label ?? "");
  const [isActive, setIsActive] = useState(option?.isActive ?? true);
  const saving = add.isPending || change.isPending;
  const failure = add.error ?? change.error;
  const valid = label.trim() !== "" && (option !== null || code.trim() !== "");
  const done = (message: string) => ({
    onSuccess: () => {
      showSuccess(message);
      onClose();
    },
  });
  const save = () => {
    if (option) change.mutate({ id: option.id, change: { label: label.trim(), isActive } }, done(`${label.trim()} was updated.`));
    else add.mutate({ kind, code: code.trim(), label: label.trim() }, done(`${label.trim()} was added.`));
  };

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={() => !saving && onClose()}>
      <DialogTitle>{option ? `Change ${option.label}` : "Add an option"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {option ? (
            <TextField size="small" label="Code" value={option.code} disabled helperText="The code cannot be changed." />
          ) : (
            <TextField
              size="small"
              label="Code"
              value={code}
              disabled={saving}
              onChange={(e) => setCode(e.target.value)}
              slotProps={{ htmlInput: { maxLength: MAX_CODE_LENGTH } }}
              helperText="What the option is stored as. It cannot be changed later."
            />
          )}
          <TextField
            size="small"
            label="Label"
            value={label}
            disabled={saving}
            onChange={(e) => setLabel(e.target.value)}
            slotProps={{ htmlInput: { maxLength: MAX_LABEL_LENGTH } }}
            helperText="What requesters see."
          />
          {option && (
            <FormControlLabel
              control={<Switch checked={isActive} disabled={saving} onChange={(_, checked) => setIsActive(checked)} />}
              label="Offered to requesters"
            />
          )}
          {failure && <Alert severity="error">{describeError(failure)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" disabled={saving || !valid} onClick={save}>
          {saving ? "Saving…" : option ? "Save changes" : "Add option"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** The options of the request form's lists, which can be added to and taken off the form without losing the requests that use them. */
export default function ReferenceOptionsSettings() {
  const settings = useReferenceSettings();
  const toggle = useChangeReferenceOption();
  const { showSuccess } = useNotifications();
  const [kind, setKind] = useState<ReferenceKind>("BUDGET_CATEGORY");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ReferenceSetting | "new" | null>(null);

  if (settings.isError) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => void settings.refetch()}>
            Retry
          </Button>
        }
      >
        {describeError(settings.error)}
      </Alert>
    );
  }
  if (!settings.data) return <Skeleton variant="rounded" height={240} />;

  const listLabel = LISTS.find((l) => l.value === kind)?.label ?? "";
  const inList = settings.data.filter((o) => o.kind === kind);
  const term = search.trim().toLowerCase();
  const rows = inList.filter((o) => term === "" || o.label.toLowerCase().includes(term) || o.code.toLowerCase().includes(term));
  const switchOffered = (option: ReferenceSetting, isActive: boolean) =>
    toggle.mutate(
      { id: option.id, change: { label: option.label, isActive } },
      { onSuccess: () => showSuccess(`${option.label} is ${isActive ? "now" : "no longer"} offered on the form.`) },
    );

  return (
    <>
      {toggle.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {describeError(toggle.error)}
        </Alert>
      )}
      <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="flex-start">
        <Paper variant="outlined" sx={{ width: { xs: "100%", md: 240 }, flexShrink: 0, borderRadius: 2, p: 1 }}>
          <List component="nav" aria-label="Lists" disablePadding>
            {LISTS.map((list) => (
              <ListItemButton
                key={list.value}
                selected={list.value === kind}
                sx={{ borderRadius: 1 }}
                onClick={() => {
                  setKind(list.value);
                  setSearch("");
                }}
              >
                <ListItemText primary={list.label} slotProps={{ primary: { variant: "body2", fontWeight: list.value === kind ? 600 : 400 } }} />
                <Chip size="small" label={settings.data.filter((o) => o.kind === list.value).length} />
              </ListItemButton>
            ))}
          </List>
        </Paper>
        <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
          <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
            <TextField
              size="small"
              placeholder={`Search ${listLabel.toLowerCase()}`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ width: 300 }}
              slotProps={{
                htmlInput: { "aria-label": "Search options" },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon size={16} />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" onClick={() => setEditing("new")}>
              Add option
            </Button>
          </Stack>
          {inList.length === 0 ? (
            <Alert severity="info">This list has no options yet.</Alert>
          ) : rows.length === 0 ? (
            <Alert severity="info">No option matches.</Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small" aria-label="Options">
                <TableHead>
                  <TableRow>
                    <TableCell>Label</TableCell>
                    <TableCell>Code</TableCell>
                    <TableCell>Offered</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((option) => (
                    <TableRow key={option.id} sx={option.isActive ? undefined : { opacity: 0.65 }}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {option.label}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" variant="outlined" label={option.code} sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }} />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={option.isActive}
                          disabled={toggle.isPending}
                          slotProps={{ input: { role: "switch", "aria-label": `Offered on the form, ${option.label}` } }}
                          onChange={(_, checked) => switchOffered(option, checked)}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" variant="outlined" aria-label={`Change ${option.label}`} onClick={() => setEditing(option)}>
                          Change
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Stack>
      {editing && <OptionForm kind={kind} option={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
