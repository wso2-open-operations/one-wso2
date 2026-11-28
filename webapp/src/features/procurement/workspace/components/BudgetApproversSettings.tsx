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
  Autocomplete,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  InputAdornment,
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
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { SearchIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import {
  useAddBudgetApprover,
  useBudgetApproverSettings,
  useChangeBudgetApprover,
  useDirectorySearch,
  useProcurementLookups,
} from "../../api/useProcurement";
import { MIN_DIRECTORY_QUERY } from "../../request-form/requestFormModel";
import type { BudgetApproverScopes, BudgetApproverSetting, Choice, Person, ProcurementLookups } from "../../types";

const personLabel = (person: Person): string => `${person.name} (${person.email})`;

/** The list's options, plus any saved code the list no longer offers, which stays chosen and shows as its code. */
const withSaved = (list: Choice[], codes: string[]): Choice[] => [
  ...list,
  ...codes.filter((code) => !list.some((c) => c.value === code)).map((code) => ({ value: code, label: code })),
];

const labelOf = (list: Choice[], code: string): string => list.find((c) => c.value === code)?.label ?? code;

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

const joinWithOr = (labels: string[]): string => (labels.length < 2 ? labels.join("") : `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`);

const SHOWN_CHIPS = 2;

/** The first few labels as chips, and the rest as a "+N" chip that names them on hover. */
function ScopeChips({ labels }: { labels: string[] }) {
  if (labels.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        None
      </Typography>
    );
  }
  const rest = labels.slice(SHOWN_CHIPS);
  return (
    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
      {labels.slice(0, SHOWN_CHIPS).map((label) => (
        <Chip key={label} size="small" label={label} />
      ))}
      {rest.length > 0 && (
        <Tooltip title={rest.join(", ")}>
          <Chip size="small" variant="outlined" label={`+${rest.length}`} aria-label={`${rest.length} more: ${rest.join(", ")}`} />
        </Tooltip>
      )}
    </Stack>
  );
}

/** A box of checkboxes for one list, with a count and a Select all that becomes Clear once everything is chosen. */
function ScopeChecklist({
  label,
  list,
  codes,
  disabled,
  onChange,
}: {
  label: string;
  list: Choice[];
  codes: string[];
  disabled: boolean;
  onChange: (codes: string[]) => void;
}) {
  const options = withSaved(list, codes);
  const all = options.length > 0 && codes.length === options.length;
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline">
        <Typography variant="subtitle2" component="span">
          {label}{" "}
          <Typography variant="caption" color="text.secondary" component="span">
            · {codes.length} of {options.length}
          </Typography>
        </Typography>
        <Button size="small" disabled={disabled || options.length === 0} onClick={() => onChange(all ? [] : options.map((o) => o.value))}>
          {all ? "Clear" : "Select all"}
        </Button>
      </Stack>
      <Box role="group" aria-label={label} sx={{ border: 1, borderColor: "divider", borderRadius: 1, height: 196, overflowY: "auto", px: 1.5, mt: 0.5 }}>
        <Stack>
          {options.map((o) => (
            <FormControlLabel
              key={o.value}
              label={o.label}
              disabled={disabled}
              control={
                <Checkbox
                  size="small"
                  checked={codes.includes(o.value)}
                  onChange={(_, checked) => onChange(checked ? [...codes, o.value] : codes.filter((code) => code !== o.value))}
                />
              }
            />
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

/** The pop-up for adding a budget approver, or changing one, which cannot be dismissed while a save runs. */
function ApproverForm({ approver, lookups, onClose }: { approver: BudgetApproverSetting | null; lookups: ProcurementLookups; onClose: () => void }) {
  const add = useAddBudgetApprover();
  const change = useChangeBudgetApprover();
  const { showSuccess } = useNotifications();
  const [chosen, setChosen] = useState<Person | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [isActive, setIsActive] = useState(approver?.isActive ?? true);
  const [scopes, setScopes] = useState<BudgetApproverScopes>({ businessUnits: approver?.businessUnits ?? [], regions: approver?.regions ?? [] });
  const search = useDirectorySearch(query, false);
  const saving = add.isPending || change.isPending;
  const failure = add.error ?? change.error;
  const options = [...(search.data ?? []), ...(chosen ? [chosen] : [])].filter(
    (person, index, all) => all.findIndex((other) => other.email.toLowerCase() === person.email.toLowerCase()) === index,
  );
  const person: { name: string; email: string } | null = approver ?? chosen;
  const hasScope = scopes.businessUnits.length + scopes.regions.length > 0;
  const covered = [
    ...scopes.businessUnits.map((code) => labelOf(lookups.businessUnits, code)),
    ...scopes.regions.map((code) => labelOf(lookups.regions, code)),
  ];
  const done = (message: string) => ({
    onSuccess: () => {
      showSuccess(message);
      onClose();
    },
  });
  const save = () => {
    if (approver) change.mutate({ id: approver.id, change: { isActive, ...scopes } }, done(`${approver.name} was updated.`));
    else if (chosen) add.mutate({ email: chosen.email, scopes }, done(`${chosen.name} is now a budget approver.`));
  };

  return (
    <Dialog open fullWidth maxWidth="md" onClose={() => !saving && onClose()}>
      <DialogTitle>{approver ? `Change ${approver.name}` : "Add a budget approver"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {person ? (
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ border: 1, borderColor: "divider", borderRadius: 1, px: 1.5, py: 1 }}>
              <Avatar sx={{ width: 36, height: 36, fontSize: 13 }}>{initials(person.name)}</Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={500}>
                  {person.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {person.email}
                </Typography>
              </Box>
              {!approver && (
                <Button size="small" disabled={saving} onClick={() => setChosen(null)}>
                  Change
                </Button>
              )}
            </Stack>
          ) : (
            <Autocomplete
              size="small"
              open={open && query.trim().length >= MIN_DIRECTORY_QUERY}
              onOpen={() => setOpen(true)}
              onClose={() => setOpen(false)}
              options={options}
              value={chosen}
              disabled={saving}
              loading={search.isFetching}
              getOptionLabel={personLabel}
              isOptionEqualToValue={(a, b) => a.email.toLowerCase() === b.email.toLowerCase()}
              filterOptions={(all) => all}
              noOptionsText="No matching employee"
              onChange={(_, next) => setChosen(next)}
              onInputChange={(_, next, reason) => setQuery(reason === "input" ? next : "")}
              renderInput={(params) => <TextField {...params} label="Employee" placeholder="Search by email" />}
            />
          )}
          {search.isError && <Alert severity="error">{describeError(search.error)}</Alert>}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5}>
            <ScopeChecklist
              label="Business units"
              list={lookups.businessUnits}
              codes={scopes.businessUnits}
              disabled={saving}
              onChange={(businessUnits) => setScopes((s) => ({ ...s, businessUnits }))}
            />
            <ScopeChecklist label="Regions" list={lookups.regions} codes={scopes.regions} disabled={saving} onChange={(regions) => setScopes((s) => ({ ...s, regions }))} />
          </Stack>
          <Alert severity="info" icon={false} sx={{ bgcolor: "action.hover" }}>
            {hasScope
              ? `Requesters in ${joinWithOr(covered)} will be offered ${person?.name ?? "this person"} as a budget approver.`
              : "Choose at least one business unit or region, so there is someone for requesters to be offered this approver."}
          </Alert>
          {approver && (
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
        <Button variant="contained" disabled={saving || !hasScope || (!approver && !chosen)} onClick={save}>
          {saving ? "Saving…" : approver ? "Save changes" : "Add approver"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

type Show = "all" | "offered" | "off";

/** Who can be chosen as a budget approver on a request, and for which business units and regions. */
export default function BudgetApproversSettings() {
  const approvers = useBudgetApproverSettings();
  const lookups = useProcurementLookups();
  const toggle = useChangeBudgetApprover();
  const { showSuccess } = useNotifications();
  const [editing, setEditing] = useState<BudgetApproverSetting | "new" | null>(null);
  const [search, setSearch] = useState("");
  const [show, setShow] = useState<Show>("all");

  if (approvers.isError) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => void approvers.refetch()}>
            Retry
          </Button>
        }
      >
        {describeError(approvers.error)}
      </Alert>
    );
  }
  if (!approvers.data) return <Skeleton variant="rounded" height={240} />;

  const names = lookups.data ?? { budgetCategories: [], businessUnits: [], products: [], regions: [] };
  const offeredCount = approvers.data.filter((a) => a.isActive).length;
  const term = search.trim().toLowerCase();
  const rows = approvers.data.filter(
    (a) => (show === "all" || a.isActive === (show === "offered")) && (term === "" || a.name.toLowerCase().includes(term) || a.email.toLowerCase().includes(term)),
  );
  const switchOffered = (approver: BudgetApproverSetting, isActive: boolean) =>
    toggle.mutate(
      { id: approver.id, change: { isActive, businessUnits: approver.businessUnits, regions: approver.regions } },
      { onSuccess: () => showSuccess(`${approver.name} is ${isActive ? "now" : "no longer"} offered to requesters.`) },
    );

  return (
    <>
      {lookups.isError && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => void lookups.refetch()}>
              Retry
            </Button>
          }
        >
          The business units and regions could not be loaded, so they show as codes. {describeError(lookups.error)}
        </Alert>
      )}
      {toggle.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {describeError(toggle.error)}
        </Alert>
      )}
      <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 300 }}
          slotProps={{
            htmlInput: { "aria-label": "Search approvers" },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon size={16} />
                </InputAdornment>
              ),
            },
          }}
        />
        <ToggleButtonGroup size="small" exclusive value={show} onChange={(_, next: Show | null) => next && setShow(next)} aria-label="Show">
          <ToggleButton value="all">All {approvers.data.length}</ToggleButton>
          <ToggleButton value="offered">Offered {offeredCount}</ToggleButton>
          <ToggleButton value="off">Not offered {approvers.data.length - offeredCount}</ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" disabled={!lookups.data} onClick={() => setEditing("new")}>
          Add budget approver
        </Button>
      </Stack>
      {approvers.data.length === 0 ? (
        <Alert severity="info">There are no budget approvers yet.</Alert>
      ) : rows.length === 0 ? (
        <Alert severity="info">No budget approver matches.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small" aria-label="Budget approvers">
            <TableHead>
              <TableRow>
                <TableCell>Approver</TableCell>
                <TableCell>Business units</TableCell>
                <TableCell>Regions</TableCell>
                <TableCell>Offered</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((approver) => (
                <TableRow key={approver.id} sx={approver.isActive ? undefined : { opacity: 0.65 }}>
                  <TableCell>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar sx={{ width: 36, height: 36, fontSize: 13 }}>{initials(approver.name)}</Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {approver.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {approver.email}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <ScopeChips labels={approver.businessUnits.map((code) => labelOf(names.businessUnits, code))} />
                  </TableCell>
                  <TableCell>
                    <ScopeChips labels={approver.regions.map((code) => labelOf(names.regions, code))} />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={approver.isActive}
                      disabled={toggle.isPending}
                      slotProps={{ input: { role: "switch", "aria-label": `Offered to requesters, ${approver.name}` } }}
                      onChange={(_, checked) => switchOffered(approver, checked)}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="outlined" aria-label={`Change ${approver.name}`} onClick={() => setEditing(approver)}>
                      Change
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {editing && lookups.data && (
        <ApproverForm approver={editing === "new" ? null : editing} lookups={lookups.data} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
