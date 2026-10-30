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

import { useState, type JSX } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { ArrowDownIcon, HistoryIcon, LayersIcon, PlusIcon, Trash2Icon } from "@wso2/oxygen-ui-icons-react";
import EmptyState from "@features/sales/cado2/components/empty-state/EmptyState";
import { useCado2Toast } from "@features/sales/cado2/components/toast/toastContext";
import PageHeader from "@features/sales/cado2/components/page-header/PageHeader";
import SectionCard from "@features/sales/cado2/components/section-card/SectionCard";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { problemOf } from "@features/sales/cado2/quotes/api/errors";
import type { Issue } from "@features/sales/cado2/quotes/api/quoteTypes";
import { useApprovalMatrix, useMatrixChanges, useSaveApprovalMatrix } from "@features/sales/cado2/approvals/api/useApprovalApi";
import type {
  ApprovalGroup,
  ApprovalMatrix,
  ApprovalRoleInfo,
  ApprovalSettings,
} from "@features/sales/cado2/approvals/api/approvalTypes";
import ProductMappingTab from "@features/sales/cado2/admin/approval-matrix/components/ProductMappingTab";
import { mappingLabel } from "@features/sales/cado2/admin/approval-matrix/model/productMapping";
import { roleLabel } from "@features/sales/cado2/approvals/model/approvalText";
import { BILLING_LABEL, BILLING_OPTIONS, formatDate } from "@features/sales/cado2/quotes/form/draftForm";

const TABS = ["Discount groups", "Product mapping", "Commercial rules", "Change log"] as const;

/**
 * The approval matrix, as admin data:
 * each discount group's ladder and required reviewers, which products belong
 * to which group, and the numbers of the commercial rules. The rule types,
 * roles and their order are fixed in code. Saving asks for confirmation and
 * says how many quotes are in approval: they keep their approvals, and the
 * new matrix applies to new submissions and resubmissions (D118).
 */
export default function ApprovalMatrixPage(): JSX.Element {
  const loaded = useApprovalMatrix();
  const save = useSaveApprovalMatrix();
  const [tab, setTab] = useState(0);
  const [draft, setDraft] = useState<ApprovalMatrix | null>(null);
  const [base, setBase] = useState<ApprovalMatrix | undefined>(undefined);
  // Quotes in approval, while the confirmation is open.
  const [inFlight, setInFlight] = useState<number | null>(null);
  const notify = useCado2Toast();

  // Start editing from the loaded matrix, and again after a save reloads it.
  if (loaded.data && loaded.data !== base) {
    setBase(loaded.data);
    setDraft(loaded.data);
  }

  if (loaded.isPending || !draft) {
    return loaded.error ? (
      <ErrorNotice error={loaded.error} onRetry={() => void loaded.refetch()} retrying={loaded.isFetching}>
        Couldn&apos;t load the approval matrix.
      </ErrorNotice>
    ) : (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress aria-label="Loading the approval matrix" />
      </Box>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(loaded.data);
  const problems = problemOf(save.error)?.issues ?? [];
  const update = (m: Partial<ApprovalMatrix>) => setDraft({ ...draft, ...m });

  const check = () => save.mutate({ matrix: draft, confirm: false }, { onSuccess: (res) => setInFlight(res.inFlight) });
  const confirm = () =>
    save.mutate(
      { matrix: draft, confirm: true },
      {
        onSuccess: () => {
          setInFlight(null);
          notify("Saved. New submissions use the new matrix.");
        },
      },
    );

  return (
    <Stack spacing={3} sx={{ maxWidth: 1200 }}>
      <PageHeader
        title="Approval Matrix"
        actions={
          <>
            <Button disabled={!dirty || save.isPending} onClick={() => setDraft(loaded.data ?? null)}>
              Discard changes
            </Button>
            <Button variant="contained" size="large" disabled={!dirty || save.isPending} onClick={check}>
              {save.isPending && inFlight === null ? "Checking…" : "Save changes"}
            </Button>
          </>
        }
      />
      {problems.length ? <ProblemList issues={problems} matrix={draft} /> : null}
      {save.error && !problems.length ? <ErrorNotice error={save.error}>Couldn&apos;t save the matrix.</ErrorNotice> : null}

      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={tab} onChange={(_, t: number) => setTab(t)} aria-label="Approval matrix sections">
          {TABS.map((t) => (
            <Tab key={t} label={t} />
          ))}
        </Tabs>
      </Box>
      <Box role="tabpanel" aria-label={TABS[tab]}>
        {tab === 0 ? <GroupsEditor matrix={draft} onChange={(groups) => update({ groups })} /> : null}
        {tab === 1 ? <ProductMappingTab matrix={draft} onChange={(mappings) => update({ mappings })} /> : null}
        {tab === 2 ? (
          <SettingsEditor settings={draft.settings} roles={draft.roles} onChange={(settings) => update({ settings })} />
        ) : null}
        {tab === 3 ? <ChangeLog /> : null}
      </Box>

      <Dialog open={inFlight !== null} onClose={() => !save.isPending && setInFlight(null)} fullWidth maxWidth="sm">
        <DialogTitle>Save the approval matrix?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {inFlight
              ? `${inFlight} quote${inFlight === 1 ? " is" : "s are"} in approval. ${inFlight === 1 ? "It keeps its" : "They keep their"} current approvers.`
              : "No quote is in approval."}{" "}
            The new matrix applies to new submissions and resubmissions.
          </Typography>
          {save.error ? <ErrorNotice error={save.error}>That didn&apos;t work.</ErrorNotice> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInFlight(null)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button variant="contained" onClick={confirm} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

/** Refusals, with the group or row they concern. */
function ProblemList({ issues, matrix }: { issues: readonly Issue[]; matrix: ApprovalMatrix }): JSX.Element {
  const where = (field: string) => {
    const g = /^groups\[(\d+)\]/.exec(field);
    if (g) return matrix.groups[Number(g[1])]?.name || `Group ${Number(g[1]) + 1}`;
    const m = /^mappings\[(\d+)\]/.exec(field);
    if (m) {
      const mp = matrix.mappings[Number(m[1])];
      return mp ? `Product mapping, ${mappingLabel(mp)}` : "Product mapping";
    }
    if (field.startsWith("settings.")) return "Commercial rules";
    return "";
  };
  return (
    <Alert severity="error">
      The matrix wasn&apos;t saved:
      <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
        {issues.map((i) => (
          <li key={i.field}>
            {where(i.field) ? <strong>{where(i.field)}: </strong> : null}
            {i.message}
          </li>
        ))}
      </Box>
    </Alert>
  );
}

// --- Discount groups ---------------------------------------------------------

function GroupsEditor({ matrix, onChange }: { matrix: ApprovalMatrix; onChange: (g: ApprovalGroup[]) => void }): JSX.Element {
  const ladderRoles = matrix.roles.filter((r) => r.ladder);
  const reviewerRoles = matrix.roles.filter((r) => r.reviewer);
  const set = (i: number, g: ApprovalGroup) => onChange(matrix.groups.map((x, j) => (j === i ? g : x)));
  const mapped = (code: string) => matrix.mappings.filter((m) => m.groupCode === code).length;

  return (
    <Stack spacing={2.5}>
      <Typography variant="body2" color="text.secondary">
        Each line&apos;s discretionary discount climbs its group&apos;s ladder: every approver up to the first whose limit
        covers it signs, in order (&ldquo;up to&rdquo; includes the limit). The Account Manager&apos;s limit is their own
        authority: they approve by submitting.
      </Typography>
      {matrix.groups.map((g, i) => (
        <SectionCard
          key={i}
          title={g.name || "New group"}
          icon={<LayersIcon size={18} />}
          aside={
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary">
                {mapped(g.code)} mapping{mapped(g.code) === 1 ? "" : "s"}
              </Typography>
              {/* The hint sits on a wrapper: a disabled button shows no hint of its own (2026-10-13). */}
              <Box component="span" title={mapped(g.code) > 0 ? "Move its product mappings first" : "Remove the group"}>
                <IconButton
                  aria-label={`Remove ${g.name || "group"}`}
                  size="small"
                  disabled={mapped(g.code) > 0}
                  onClick={() => onChange(matrix.groups.filter((_, j) => j !== i))}
                >
                  <Trash2Icon size={16} />
                </IconButton>
              </Box>
            </Stack>
          }
        >
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Name" value={g.name} onChange={(e) => set(i, { ...g, name: e.target.value })} fullWidth />
              <TextField
                label="Code"
                value={g.code}
                onChange={(e) => set(i, { ...g, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })}
                helperText="Stable key, e.g. PLATFORM"
                sx={{ minWidth: 220 }}
                disabled={mapped(g.code) > 0}
              />
            </Stack>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Ladder
              </Typography>
              <Stack spacing={1}>
                {g.ladder.map((t, j) => {
                  const last = j === g.ladder.length - 1;
                  const setRung = (patch: Partial<typeof t>) =>
                    set(i, { ...g, ladder: g.ladder.map((x, k) => (k === j ? { ...x, ...patch } : x)) });
                  return (
                    <Stack key={j} direction="row" spacing={1.5} alignItems="center">
                      <TextField
                        select
                        size="small"
                        label="Approver"
                        value={t.role}
                        onChange={(e) => setRung({ role: e.target.value })}
                        sx={{ width: 220 }}
                      >
                        {ladderRoles.map((r) => (
                          <MenuItem key={r.code} value={r.code}>
                            {r.label}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        size="small"
                        label={last ? "Approves everything above" : "Approves up to (%)"}
                        value={last ? "" : (t.maxPercent ?? "")}
                        placeholder={last ? "no limit" : ""}
                        disabled={last}
                        onChange={(e) => setRung({ maxPercent: e.target.value })}
                        slotProps={{ htmlInput: { inputMode: "decimal", "aria-label": `${roleLabel(t.role)} limit` } }}
                        sx={{ width: 200 }}
                      />
                      <IconButton
                        aria-label={`Remove ${roleLabel(t.role)} from the ladder`}
                        size="small"
                        disabled={g.ladder.length <= 1}
                        onClick={() => {
                          const ladder = g.ladder.filter((_, k) => k !== j);
                          // The last rung always approves everything above.
                          set(i, { ...g, ladder: ladder.map((x, k) => (k === ladder.length - 1 ? { ...x, maxPercent: null } : x)) });
                        }}
                      >
                        <Trash2Icon size={16} />
                      </IconButton>
                    </Stack>
                  );
                })}
                <Box>
                  <Button
                    size="small"
                    startIcon={<PlusIcon size={14} />}
                    onClick={() => {
                      const ladder = g.ladder.map((x, k) => (k === g.ladder.length - 1 ? { ...x, maxPercent: x.maxPercent ?? "" } : x));
                      set(i, { ...g, ladder: [...ladder, { role: ladderRoles.at(-1)?.code ?? "CFO", maxPercent: null }] });
                    }}
                  >
                    Add an approver
                  </Button>
                </Box>
              </Stack>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Always Reviews Every Line
              </Typography>
              <Stack direction="row" sx={{ flexWrap: "wrap" }}>
                {reviewerRoles.map((r) => (
                  <FormControlLabel
                    key={r.code}
                    control={
                      <Checkbox
                        checked={g.reviewers.includes(r.code)}
                        onChange={(_, on) =>
                          set(i, { ...g, reviewers: on ? [...g.reviewers, r.code] : g.reviewers.filter((x) => x !== r.code) })
                        }
                      />
                    }
                    label={r.label}
                  />
                ))}
              </Stack>
            </Box>
          </Stack>
        </SectionCard>
      ))}
      <Box>
        <Button
          startIcon={<PlusIcon size={16} />}
          onClick={() =>
            onChange([
              ...matrix.groups,
              {
                code: "",
                name: "",
                reviewers: [],
                ladder: [
                  { role: "ACCOUNT_MANAGER", maxPercent: "5" },
                  { role: "REGIONAL_DIRECTOR", maxPercent: "10" },
                  { role: "CFO", maxPercent: null },
                ],
              },
            ])
          }
        >
          Add a discount group
        </Button>
      </Box>
    </Stack>
  );
}

// --- Commercial rules --------------------------------------------------------

function SettingsEditor({
  settings,
  roles,
  onChange,
}: {
  settings: ApprovalSettings;
  roles: readonly ApprovalRoleInfo[];
  onChange: (s: ApprovalSettings) => void;
}): JSX.Element {
  const set = (patch: Partial<ApprovalSettings>) => onChange({ ...settings, ...patch });
  // The Account Manager approves by submitting, so has no steps (S3).
  const approverRoles = roles.filter((r) => r.code !== "ACCOUNT_MANAGER");
  const rule = (title: string, chain: string, field: JSX.Element, note?: string) => (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            Approvers: {chain}
          </Typography>
          {note ? (
            <Typography variant="caption" color="warning.main" display="block">
              {note}
            </Typography>
          ) : null}
        </Box>
        <Box sx={{ width: { md: 240 } }}>{field}</Box>
      </Stack>
    </Paper>
  );
  const num = (label: string, value: string, on: (v: string) => void) => (
    <TextField size="small" fullWidth label={label} value={value} onChange={(e) => on(e.target.value)} slotProps={{ htmlInput: { inputMode: "decimal" } }} />
  );
  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        The quote-level rules. Who approves each is fixed; the numbers are yours. Deal Desk reviews every quote first.
      </Typography>
      {rule("Special or changed governing terms", "Legal", <Typography variant="body2">Always</Typography>)}
      {rule(
        "Short-term deals",
        "Area GM → CRO → CFO",
        num("Under this many months", settings.shortTermMonths, (v) => set({ shortTermMonths: v })),
      )}
      {rule(
        "Extended term, and SaaS multi-year",
        "Area GM → CRO → CFO",
        num("Over this many months", settings.longTermMonths, (v) => set({ longTermMonths: v })),
      )}
      {rule(
        "SaaS products",
        "(identifies the SaaS lines for the rule above)",
        <TextField size="small" fullWidth label="product_Classification__c value" value={settings.saasClassification} onChange={(e) => set({ saasClassification: e.target.value })} />,
      )}
      {rule(
        "Payment terms",
        "CFO",
        <TextField
          size="small"
          fullWidth
          label="Above Net (days)"
          value={String(settings.paymentTermsDays)}
          onChange={(e) => set({ paymentTermsDays: Number(e.target.value.replace(/\D/g, "")) || 0 })}
          slotProps={{ htmlInput: { inputMode: "numeric" } }}
        />,
      )}
      {rule(
        "Billing frequency",
        "CFO",
        <Stack>
          {BILLING_OPTIONS.map((bf) => (
            <FormControlLabel
              key={bf}
              control={
                <Checkbox
                  size="small"
                  checked={settings.billingApproval.includes(bf)}
                  onChange={(_, on) =>
                    set({
                      billingApproval: on
                        ? BILLING_OPTIONS.filter((x) => x === bf || settings.billingApproval.includes(x))
                        : settings.billingApproval.filter((x) => x !== bf),
                    })
                  }
                />
              }
              label={<Typography variant="body2">{BILLING_LABEL[bf]}</Typography>}
            />
          ))}
        </Stack>,
        settings.billingApproval.length === 0 ? "No billing frequency needs the CFO." : undefined,
      )}
      {rule(
        "Renewal downsell",
        "RD → Area GM → CRO → Chief of Staff → CFO, then the CEO above the percentage",
        num("CEO above (% of previous ARR)", settings.downsellCeoPercent, (v) => set({ downsellCeoPercent: v })),
      )}
      {rule(
        "Regional approvers",
        "Only approvers in the account's sales region (D13)",
        <Stack>
          {approverRoles.map((r) => (
            <FormControlLabel
              key={r.code}
              control={
                <Checkbox
                  size="small"
                  checked={settings.regionalRoles.includes(r.code)}
                  onChange={(_, on) =>
                    set({
                      regionalRoles: on
                        ? approverRoles.map((x) => x.code).filter((c) => c === r.code || settings.regionalRoles.includes(c))
                        : settings.regionalRoles.filter((c) => c !== r.code),
                    })
                  }
                />
              }
              label={<Typography variant="body2">{r.label}</Typography>}
            />
          ))}
        </Stack>,
        settings.regionalRoles.length === 0 ? "Every approver acts on quotes from any region." : undefined,
      )}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "text.secondary", pt: 1 }}>
        <ArrowDownIcon size={14} />
        <Typography variant="caption">Saving checks which quotes in approval the new numbers affect before anything changes.</Typography>
      </Stack>
    </Stack>
  );
}

// --- Change log --------------------------------------------------------------

function ChangeLog(): JSX.Element {
  const changes = useMatrixChanges();
  if (changes.isPending) return <CircularProgress aria-label="Loading the change log" />;
  if (changes.error) {
    return (
      <ErrorNotice error={changes.error} onRetry={() => void changes.refetch()}>
        Couldn&apos;t load the change log.
      </ErrorNotice>
    );
  }
  if (!changes.data.length) {
    return (
      <EmptyState compact icon={<HistoryIcon size={20} />} title="No changes yet" body="The matrix is the V1 sheet as seeded." />
    );
  }
  return (
    <Stack spacing={1.5} component="ol" sx={{ listStyle: "none", m: 0, p: 0 }}>
      {changes.data.map((c) => (
        <Paper component="li" key={c.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {formatDate(c.changedAt.slice(0, 10))} · {c.changedByEmail}
          </Typography>
          <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
            {c.changes.map((line) => (
              <Typography key={line} component="li" variant="body2">
                {line}
              </Typography>
            ))}
          </Box>
          {c.recalled.length ? (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              Recalled: {c.recalled.map((q) => q.quoteNumber).join(", ")}
            </Typography>
          ) : null}
        </Paper>
      ))}
    </Stack>
  );
}
