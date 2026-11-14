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
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { PercentIcon, PlusIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useCado2Toast } from "@features/sales/cado2/components/toast/toastContext";
import PageHeader from "@features/sales/cado2/components/page-header/PageHeader";
import EmptyState from "@features/sales/cado2/components/empty-state/EmptyState";
import { ProductsField } from "@features/sales/cado2/admin/components/AdminProductFields";
import LifecycleDialog from "@features/sales/cado2/quotes/components/detail/LifecycleDialog";
import { messageOf } from "@features/sales/cado2/quotes/api/errors";
import type { FormulaProduct } from "@features/sales/cado2/quotes/api/quoteTypes";
import { formatDate } from "@features/sales/cado2/quotes/form/draftForm";
import {
  useDeleteVolumeDiscount,
  useSaveVolumeDiscount,
  useVolumeDiscounts,
  type VolumeDiscountTable,
} from "@features/sales/cado2/admin/volume-discounts/api/useVolumeDiscounts";
import { below, ceilingOK, covers, startOf } from "@features/sales/cado2/admin/volume-discounts/model/tiers";
import ChangeLogCard from "@features/sales/cado2/admin/components/ChangeLogCard";
import { useAdminChanges } from "@features/sales/cado2/admin/components/useAdminChanges";
import { volumeChangeLines, volumeTitle } from "@features/sales/cado2/admin/components/changeLog";
import { cado2ServiceUrls } from "@config/apiConfig";

const num = { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" } as const;
const pct = (v: string) => `${Number(v)}%`;

/** A tier row being edited: the start and ceiling as typed. */
interface TierDraft {
  readonly key: number;
  readonly from: string;
  readonly ceiling: string;
}

/** A table being edited; id null for a new one. */
interface TableDraft {
  readonly id: number | null;
  readonly name: string;
  readonly products: readonly FormulaProduct[];
  readonly tiers: readonly TierDraft[];
}

let nextKey = 1;
const tierDraft = (from = "", ceiling = ""): TierDraft => ({ key: nextKey++, from, ceiling });

/** A saved product as the picker holds it: Salesforce's id when known, else its code. */
const picked = (p: VolumeDiscountTable["products"][number]): FormulaProduct => ({
  id: p.productId ?? `code:${p.productCode}`,
  name: p.productName ?? p.productCode,
  code: p.productCode,
});

const draftOf = (t: VolumeDiscountTable | null): TableDraft =>
  t
    ? {
        id: t.id,
        name: t.name,
        products: t.products.map(picked),
        tiers: t.tiers.map((x) => tierDraft(String(x.fromQuantity), String(Number(x.ceilingPercent)))),
      }
    : { id: null, name: "", products: [], tiers: [tierDraft("1", "0")] };

/** What's wrong with a draft before it is sent, or null; the backend checks again. */
function draftProblem(d: TableDraft): string | null {
  if (!d.name.trim()) return "Enter the table's name";
  if (d.products.length === 0) return "Add at least one product";
  const noCode = d.products.find((p) => !p.code);
  if (noCode) return `${noCode.name} has no product code in Salesforce, so it can't be in a table`;
  if (d.tiers.length === 0) return "Add at least one tier";
  const starts = d.tiers.map((t) => startOf(t.from));
  if (starts.some((s) => s === null)) return "Each tier starts at a whole number of at least 1";
  if (starts.some((s, i) => i > 0 && (s as number) <= (starts[i - 1] as number))) return "Tiers must go up";
  if (d.tiers.some((t) => !ceilingOK(t.ceiling))) return "Each ceiling is between 0 and 100, with at most 2 decimals";
  return null;
}

/** The tiers of a saved table: what each covers and its ceiling. */
function TiersTable({ table }: { table: VolumeDiscountTable }): JSX.Element {
  const ranges = covers(table.tiers.map((t) => t.fromQuantity));
  const first = below(table.tiers[0]?.fromQuantity ?? null);
  return (
    <Table size="small" aria-label={`Tiers of ${table.name}`}>
      <TableHead>
        <TableRow>
          <TableCell>Covers</TableCell>
          <TableCell align="right">Volume discount ceiling</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {first ? (
          <TableRow>
            <TableCell sx={{ color: "text.secondary" }}>{first}</TableCell>
            <TableCell align="right" sx={{ color: "text.secondary" }}>
              No volume discount
            </TableCell>
          </TableRow>
        ) : null}
        {table.tiers.map((t, i) => (
          <TableRow key={t.fromQuantity}>
            <TableCell sx={num}>{ranges[i]}</TableCell>
            <TableCell align="right" sx={num}>
              {pct(t.ceilingPercent)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** A saved table's products: the code, and Salesforce's name under it. */
function ProductChips({ table }: { table: VolumeDiscountTable }): JSX.Element {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
      {table.products.map((p) => (
        <Box key={p.productCode} sx={{ bgcolor: "action.hover", borderRadius: 1, px: 1.25, py: 0.75, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {p.productCode}
          </Typography>
          {p.productName ? (
            <Typography variant="caption" color="text.secondary" display="block">
              {p.productName}
            </Typography>
          ) : null}
        </Box>
      ))}
    </Box>
  );
}

const label = (text: string) => (
  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, display: "block", mb: 1 }}>
    {text}
  </Typography>
);

/** A table being added or changed, in place of its card. */
function TableEditor({ initial, onDone }: { initial: TableDraft; onDone: () => void }): JSX.Element {
  const [draft, setDraft] = useState(initial);
  const [shown, setShown] = useState<string | null>(null);
  const save = useSaveVolumeDiscount();
  const notify = useCado2Toast();
  const starts = draft.tiers.map((t) => startOf(t.from));
  const ranges = covers(starts);
  const first = below(starts[0] ?? null);
  const setTier = (key: number, change: Partial<TierDraft>) =>
    setDraft((d) => ({ ...d, tiers: d.tiers.map((t) => (t.key === key ? { ...t, ...change } : t)) }));

  const submit = () => {
    const problem = draftProblem(draft);
    setShown(problem);
    if (problem) return;
    save.mutate(
      {
        id: draft.id,
        body: {
          name: draft.name.trim(),
          productCodes: draft.products.map((p) => p.code as string),
          tiers: draft.tiers.map((t) => ({ fromQuantity: Number(t.from), ceilingPercent: t.ceiling.trim() })),
        },
      },
      {
        onSuccess: (t) => {
          notify(`${t.name} saved`);
          onDone();
        },
      },
    );
  };
  const error = shown ?? (save.error ? (messageOf(save.error) ?? "Couldn't save the table. Try again.") : null);

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }} aria-label={draft.id === null ? "New table" : `Editing ${initial.name}`} role="region">
      <Stack spacing={2.5}>
        <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1fr)" } }}>
          <Stack spacing={2} sx={{ minWidth: 0 }}>
            <TextField
              label="Name"
              size="small"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              inputProps={{ maxLength: 255 }}
            />
            <Box>
              {label("Products")}
              <ProductsField
                name={draft.name || "the table"}
                value={draft.products}
                onChange={(ps) => setDraft((d) => ({ ...d, products: ps }))}
                helperText="Each line is counted on its own, even when two of its products are in this table. A product can be in one table only."
              />
            </Box>
          </Stack>
          <Box sx={{ minWidth: 0 }}>
            {label("Tiers")}
            <Table size="small" aria-label="Tiers">
              <TableHead>
                <TableRow>
                  <TableCell>From quantity</TableCell>
                  <TableCell>Covers</TableCell>
                  <TableCell align="right">Volume discount ceiling (%)</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {first ? (
                  <TableRow>
                    <TableCell sx={{ color: "text.secondary" }}>–</TableCell>
                    <TableCell sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>{first}</TableCell>
                    <TableCell align="right" sx={{ color: "text.secondary" }}>
                      No volume discount
                    </TableCell>
                    <TableCell />
                  </TableRow>
                ) : null}
                {draft.tiers.map((t, i) => (
                  <TableRow key={t.key}>
                    <TableCell>
                      <TextField
                        size="small"
                        value={t.from}
                        onChange={(e) => setTier(t.key, { from: e.target.value })}
                        inputProps={{ inputMode: "numeric", "aria-label": `Tier ${i + 1} from quantity` }}
                        sx={{ width: 96 }}
                      />
                    </TableCell>
                    <TableCell sx={{ ...num, color: "text.secondary" }}>{ranges[i]}</TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        value={t.ceiling}
                        onChange={(e) => setTier(t.key, { ceiling: e.target.value })}
                        inputProps={{ inputMode: "decimal", "aria-label": `Tier ${i + 1} volume discount ceiling`, style: { textAlign: "right" } }}
                        sx={{ width: 96 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {draft.tiers.length > 1 ? (
                        <Button
                          size="small"
                          aria-label={`Remove tier ${i + 1}`}
                          onClick={() => setDraft((d) => ({ ...d, tiers: d.tiers.filter((x) => x.key !== t.key) }))}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button
              size="small"
              startIcon={<PlusIcon size={14} />}
              sx={{ mt: 1 }}
              onClick={() => setDraft((d) => ({ ...d, tiers: [...d.tiers, tierDraft()] }))}
            >
              Add tier
            </Button>
          </Box>
        </Box>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button onClick={onDone} disabled={save.isPending}>
            Cancel
          </Button>
          <Button variant="contained" onClick={submit} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

/**
 * CadO2 Admin → Volume Discounts (D169): tables of quantity tiers for a
 * product or group of products. A line's quantity picks its tier; the tier's
 * ceiling is the most discount the AM can give without approval, and the
 * rest is discretionary. Drafts take a change at their next save.
 *
 *   WSO2 Gateway (Self-hosted)                          [Edit] [Delete]
 *   Products  SH-API-GW            Covers         Volume discount ceiling
 *                                  Below 10       No volume discount
 *                                  10 – 100       6.44%
 *                                  1,001 and above 56.66%
 */
export default function VolumeDiscountsPage(): JSX.Element {
  const data = useVolumeDiscounts();
  const [editing, setEditing] = useState<TableDraft | null>(null);
  const [deleting, setDeleting] = useState<VolumeDiscountTable | null>(null);
  const remove = useDeleteVolumeDiscount();
  const notify = useCado2Toast();
  // Every change, with its before and after (D172); refreshed by this page's saves.
  const changes = useAdminChanges(cado2ServiceUrls.adminVolumeDiscountChanges, "volume-discounts");

  return (
    <Stack spacing={3} sx={{ maxWidth: 1000 }}>
      <PageHeader
        title="Volume Discounts"
        actions={
          <Button
            variant="contained"
            size="large"
            startIcon={<PlusIcon size={18} />}
            disabled={editing !== null || !data.data}
            onClick={() => setEditing(draftOf(null))}
          >
            New table
          </Button>
        }
      />
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "80ch" }}>
        Each table lists products and quantity tiers. A line&apos;s quantity picks its tier, and the tier&apos;s ceiling is
        the most discount the AM can give without approval. Each line is counted on its own, year by year. Drafts pick up
        changes at their next save; submitted quotes keep the ceiling they had.
      </Typography>

      {data.data && !data.data.salesforceAvailable ? (
        <Alert severity="warning">Salesforce couldn&apos;t be read, so products are listed by code only.</Alert>
      ) : null}

      {editing?.id === null ? <TableEditor initial={editing} onDone={() => setEditing(null)} /> : null}

      {data.error ? (
        <ErrorNotice error={data.error} onRetry={() => void data.refetch()} retrying={data.isFetching}>
          Couldn&apos;t load the volume discounts.
        </ErrorNotice>
      ) : data.isPending ? (
        <Skeleton variant="rounded" height={260} aria-label="Loading volume discounts" />
      ) : data.data.tables.length === 0 && editing === null ? (
        <EmptyState icon={<PercentIcon size={20} />} title="No volume discount tables" body="Without one, every discount is discretionary." />
      ) : (
        data.data.tables.map((t) =>
          editing?.id === t.id ? (
            <TableEditor key={t.id} initial={editing} onDone={() => setEditing(null)} />
          ) : (
            <Paper key={t.id} variant="outlined" component="section" aria-label={t.name}>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: "divider", flexWrap: "wrap", rowGap: 0.5 }}
              >
                <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 700, flexGrow: 1, minWidth: 0 }}>
                  {t.name}
                </Typography>
                <Button size="small" disabled={editing !== null} onClick={() => setEditing(draftOf(t))} aria-label={`Edit ${t.name}`}>
                  Edit
                </Button>
                <Button size="small" color="error" disabled={editing !== null} onClick={() => setDeleting(t)} aria-label={`Delete ${t.name}`}>
                  Delete
                </Button>
              </Stack>
              <Box sx={{ display: "grid", gap: 3, p: 2.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1fr)" } }}>
                <Box sx={{ minWidth: 0 }}>
                  {label("Products")}
                  <ProductChips table={t} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  {label("Tiers")}
                  <TiersTable table={t} />
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", px: 2.5, pb: 1.5 }}>
                Last changed by {t.updatedByEmail} on {formatDate(t.updatedAt.slice(0, 10))}.
              </Typography>
            </Paper>
          ),
        )
      )}

      {deleting ? (
        <LifecycleDialog
          title={`Delete ${deleting.name}?`}
          confirmLabel="Delete table"
          danger
          pending={remove.isPending}
          error={remove.error}
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            remove.mutate(deleting.id, {
              onSuccess: () => {
                notify(`${deleting.name} deleted`);
                setDeleting(null);
              },
            })
          }
        >
          Its products will have no volume discount ceiling, so their whole discount needs approval. Drafts follow at their next
          save; submitted quotes keep the ceiling they had.
        </LifecycleDialog>
      ) : null}

      <ChangeLogCard
        changes={changes}
        describe={(c) => ({ title: volumeTitle(c), lines: volumeChangeLines(c) })}
        label="Volume discount changes"
        empty="Every change to a table will be listed here, with what it was before."
      />
    </Stack>
  );
}
