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

import { useState, type JSX, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { AsteriskIcon, LayoutGridIcon, ListChecksIcon, PencilIcon, PlusIcon, Trash2Icon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import SectionCard from "@features/sales/cado2/components/section-card/SectionCard";
import { useMatrixProducts } from "@features/sales/cado2/approvals/api/useApprovalApi";
import type {
  ApprovalMapping,
  ApprovalMatrix,
  CatalogProduct,
  ListedProduct,
  MappingKind,
} from "@features/sales/cado2/approvals/api/approvalTypes";
import {
  blankMapping,
  duplicatePattern,
  duplicateRule,
  listOf,
  mappingLabel,
  matchedBy,
  moves,
  normaliseSku,
  patternClashes,
  winnerFor,
} from "../model/productMapping";

/** An open dialog: adding (index -1) or editing a mapping, or removing one. */
type Editing = { kind: MappingKind; index: number } | null;

/**
 * Product mapping (D117): product lists, SKU patterns and rules
 * (Classification and/or Product Unit) put Salesforce products into discount
 * groups. Three cards in the order they win; each with its own dialog. Clashes
 * are caught in the dialogs; Save on the page applies everything.
 */
export default function ProductMappingTab({
  matrix,
  onChange,
}: {
  matrix: ApprovalMatrix;
  onChange: (m: ApprovalMapping[]) => void;
}): JSX.Element {
  const catalog = useMatrixProducts(true);
  const products = catalog.data ?? null;
  const [editing, setEditing] = useState<Editing>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const groupName = (code: string) => matrix.groups.find((g) => g.code === code)?.name || code;
  const mappings = matrix.mappings;
  const indexed = mappings.map((m, i) => ({ m, i }));

  const put = (m: ApprovalMapping, index: number) =>
    onChange(index < 0 ? [...mappings, m] : mappings.map((x, j) => (j === index ? m : x)));

  const actions = (m: ApprovalMapping, i: number) => {
    const what = m.kind === "PRODUCTS" ? "product list" : m.kind === "SKU" ? `pattern ${m.skuPattern}` : `rule ${mappingLabel(m)}`;
    return (
      <TableCell align="right" sx={{ whiteSpace: "nowrap", width: 96 }}>
        <Tooltip title="Edit">
          <IconButton size="small" aria-label={`Edit ${what}`} onClick={() => setEditing({ kind: m.kind, index: i })}>
            <PencilIcon size={16} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Remove">
          <IconButton size="small" aria-label={`Remove ${what}`} onClick={() => setRemoving(i)}>
            <Trash2Icon size={16} />
          </IconButton>
        </Tooltip>
      </TableCell>
    );
  };

  const count = (m: ApprovalMapping) => <MatchCount products={products ? matchedBy(m, products) : null} />;

  return (
    <Stack spacing={2.5}>
      <Typography variant="body2" color="text.secondary">
        Most specific wins: <strong>product lists</strong>, then <strong>SKU patterns</strong> (more fixed characters first),
        then <strong>Classification + Product Unit</strong>, then Classification only, then Product Unit only. A discounted
        product nothing covers can&apos;t be submitted.
      </Typography>
      {catalog.error ? (
        <ErrorNotice error={catalog.error} onRetry={() => void catalog.refetch()} retrying={catalog.isFetching}>
          Couldn&apos;t load the products from Salesforce, so the counts and the product picker aren&apos;t available.
        </ErrorNotice>
      ) : null}

      <SectionCard
        title="Product lists"
        icon={<ListChecksIcon size={18} />}
        aside={<AddButton onClick={() => setEditing({ kind: "PRODUCTS", index: -1 })}>Add a product list</AddButton>}
      >
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Chosen products, one by one. Beats every other rule. A product can be in one list only.
        </Typography>
        <MappingTable label="Product lists" empty="No product lists." head={["Products", "Discount group"]}>
          {indexed
            .filter(({ m }) => m.kind === "PRODUCTS")
            .map(({ m, i }) => (
              <TableRow key={i} hover>
                <TableCell>
                  <ProductChips listed={m.products} catalog={products} />
                </TableCell>
                <TableCell sx={{ width: 240 }}>{groupName(m.groupCode)}</TableCell>
                {actions(m, i)}
              </TableRow>
            ))}
        </MappingTable>
      </SectionCard>

      <SectionCard
        title="SKU patterns"
        icon={<AsteriskIcon size={18} />}
        aside={<AddButton onClick={() => setEditing({ kind: "SKU", index: -1 })}>Add a pattern</AddButton>}
      >
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Matches the whole product code, ignoring case. <strong>*</strong> stands for any characters.
        </Typography>
        <MappingTable label="SKU patterns" empty="No patterns." head={["Product code", "Matches today", "Discount group"]}>
          {indexed
            .filter(({ m }) => m.kind === "SKU")
            .map(({ m, i }) => (
              <TableRow key={i} hover>
                <TableCell sx={{ fontFamily: "monospace" }}>{m.skuPattern}</TableCell>
                <TableCell>{count(m)}</TableCell>
                <TableCell sx={{ width: 240 }}>{groupName(m.groupCode)}</TableCell>
                {actions(m, i)}
              </TableRow>
            ))}
        </MappingTable>
      </SectionCard>

      <SectionCard
        title="Classification and Product Unit"
        icon={<LayoutGridIcon size={18} />}
        aside={<AddButton onClick={() => setEditing({ kind: "RULE", index: -1 })}>Add a rule</AddButton>}
      >
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Typed as Salesforce has them, ignoring case. Leave one empty to mean any value. With both set, a rule beats a rule
          with one.
        </Typography>
        <MappingTable label="Rules" empty="No rules." head={["Classification", "Product Unit", "Matches today", "Discount group"]}>
          {indexed
            .filter(({ m }) => m.kind === "RULE")
            .map(({ m, i }) => (
              <TableRow key={i} hover>
                <TableCell>{m.classification || <Any />}</TableCell>
                <TableCell>{m.productUnit || <Any />}</TableCell>
                <TableCell>{count(m)}</TableCell>
                <TableCell sx={{ width: 240 }}>{groupName(m.groupCode)}</TableCell>
                {actions(m, i)}
              </TableRow>
            ))}
        </MappingTable>
      </SectionCard>

      {editing ? (
        <MappingDialog
          matrix={matrix}
          catalog={products}
          editing={editing}
          onClose={() => setEditing(null)}
          onDone={(m) => {
            put(m, editing.index);
            setEditing(null);
          }}
        />
      ) : null}
      {removing !== null ? (
        <RemoveDialog
          matrix={matrix}
          catalog={products}
          index={removing}
          onClose={() => setRemoving(null)}
          onRemove={() => {
            onChange(mappings.filter((_, j) => j !== removing));
            setRemoving(null);
          }}
        />
      ) : null}
    </Stack>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }): JSX.Element {
  return (
    <Button size="small" startIcon={<PlusIcon size={14} />} onClick={onClick}>
      {children}
    </Button>
  );
}

const Any = () => (
  <Typography component="span" variant="body2" color="text.secondary">
    Any
  </Typography>
);

function MappingTable({ label, head, empty, children }: { label: string; head: string[]; empty: string; children: ReactNode[] }): JSX.Element {
  if (children.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {empty}
      </Typography>
    );
  }
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
      <Table size="small" aria-label={label}>
        <TableHead>
          <TableRow>
            {head.map((h) => (
              <TableCell key={h}>{h}</TableCell>
            ))}
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>{children}</TableBody>
      </Table>
    </TableContainer>
  );
}

/** "37 products", with a few of them on hover; "—" while the catalog is unavailable. */
function MatchCount({ products }: { products: CatalogProduct[] | null }): JSX.Element {
  if (!products) return <Typography variant="body2" color="text.secondary">—</Typography>;
  const n = products.length;
  const sample = products.slice(0, 5).map((p) => `${p.name}${p.code ? ` (${p.code})` : ""}`);
  const label = (
    <Typography variant="body2" component="span" color={n === 0 ? "warning.main" : undefined}>
      {n} product{n === 1 ? "" : "s"}
    </Typography>
  );
  return n === 0 ? (
    label
  ) : (
    <Tooltip title={[...sample, ...(n > 5 ? [`… and ${n - 5} more`] : [])].join(" · ")}>{label}</Tooltip>
  );
}

/** The products of a list; one that's no longer active in Salesforce is struck through. */
function ProductChips({ listed, catalog }: { listed: readonly ListedProduct[]; catalog: readonly CatalogProduct[] | null }): JSX.Element {
  const active = new Set(catalog?.map((p) => p.id));
  const gone = catalog ? listed.filter((p) => !active.has(p.id)).length : 0;
  return (
    <Box>
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5 }}>
        {listed.map((p) => {
          const missing = catalog !== null && !active.has(p.id);
          return (
            <Chip
              key={p.id}
              size="small"
              label={p.name || p.id}
              title={missing ? "No longer active in Salesforce" : p.code || undefined}
              sx={missing ? { textDecoration: "line-through", color: "text.secondary" } : undefined}
            />
          );
        })}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {listed.length} product{listed.length === 1 ? "" : "s"}
        {gone ? ` · ${gone} no longer active in Salesforce` : ""}
      </Typography>
    </Box>
  );
}

// --- Add / edit -------------------------------------------------------------

const TITLES: Record<MappingKind, { add: string; edit: string; addButton: string; editButton: string }> = {
  PRODUCTS: { add: "Add Product List", edit: "Edit Product List", addButton: "Add list", editButton: "Save list" },
  SKU: { add: "Add Pattern", edit: "Edit Pattern", addButton: "Add pattern", editButton: "Save pattern" },
  RULE: { add: "Add Rule", edit: "Edit Rule", addButton: "Add rule", editButton: "Save rule" },
};

function MappingDialog({
  matrix,
  catalog,
  editing,
  onClose,
  onDone,
}: {
  matrix: ApprovalMatrix;
  catalog: CatalogProduct[] | null;
  editing: NonNullable<Editing>;
  onClose: () => void;
  onDone: (m: ApprovalMapping) => void;
}): JSX.Element {
  const { kind, index } = editing;
  const [m, setM] = useState<ApprovalMapping>(() => matrix.mappings[index] ?? blankMapping(kind, matrix.groups[0]?.code ?? ""));
  const [picking, setPicking] = useState(false);
  const t = TITLES[kind];
  const others = matrix.mappings;

  // What stops "Add": empty fields, and clashes (D117), shown as they're typed.
  let problem: ReactNode = null;
  let incomplete = !m.groupCode;
  if (kind === "RULE") {
    incomplete ||= !m.classification.trim() && !m.productUnit.trim();
    const dup = incomplete ? -1 : duplicateRule(others, m, index);
    if (dup >= 0) {
      problem = (
        <>
          There&apos;s already a rule for {mappingLabel(m)} ({groupLabel(matrix, others[dup].groupCode)}). Edit that one instead.
        </>
      );
    }
  } else if (kind === "SKU") {
    incomplete ||= normaliseSku(m.skuPattern).replace(/\*/g, "") === "";
    const dup = incomplete ? -1 : duplicatePattern(others, m, index);
    const clash = incomplete || dup >= 0 ? [] : patternClashes(others, m, index);
    if (dup >= 0) {
      problem = <>The pattern {others[dup].skuPattern} is already there. Edit that one instead.</>;
    } else if (clash.length) {
      const o = others[clash[0]];
      const both = catalog ? matchedBy(m, catalog).filter((p) => matchedBy(o, [p]).length) : [];
      problem = (
        <>
          <strong>{o.skuPattern}</strong> ({groupLabel(matrix, o.groupCode)}) can match the same products
          {both.length ? (
            <>
              {" "}
              (e.g. <strong>{both[0].name}</strong>, {both[0].code})
            </>
          ) : null}{" "}
          and is just as specific. Make this pattern more specific, choose the same group, or put the products in a product
          list.
        </>
      );
    }
  } else {
    incomplete ||= m.products.length === 0;
  }

  const covered = catalog && kind !== "PRODUCTS" && !incomplete ? matchedBy(m, catalog) : null;
  // Products that would move here from another mapping that covers them now.
  const without = others.filter((_, j) => j !== index);
  const moving = covered
    ? moves(
        covered.filter((p) => winnerFor([...without, m], p) === without.length),
        without,
      )
        .to.filter((x) => without[x.index].groupCode !== m.groupCode)
        .map((x) => ({ ...x, mapping: without[x.index] }))
    : null;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="mapping-title">
      <DialogTitle id="mapping-title">{index < 0 ? t.add : t.edit}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {kind === "RULE" ? (
            <>
              <Typography variant="body2" color="text.secondary">
                Classification and Product Unit, typed exactly as in Salesforce (not case-sensitive). Leave one empty to match
                any value.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Classification"
                  value={m.classification}
                  onChange={(e) => setM({ ...m, classification: e.target.value })}
                  error={!!problem}
                  fullWidth
                  slotProps={{ htmlInput: { maxLength: 100 } }}
                />
                <TextField
                  label="Product Unit"
                  value={m.productUnit}
                  onChange={(e) => setM({ ...m, productUnit: e.target.value })}
                  error={!!problem}
                  fullWidth
                  slotProps={{ htmlInput: { maxLength: 100 } }}
                />
              </Stack>
            </>
          ) : null}
          {kind === "SKU" ? (
            <TextField
              label="Product code"
              required
              value={m.skuPattern}
              onChange={(e) => setM({ ...m, skuPattern: e.target.value })}
              error={!!problem}
              helperText="* stands for any characters, e.g. PC-*. Not case-sensitive. The whole code must match."
              slotProps={{ htmlInput: { maxLength: 100, style: { fontFamily: "monospace" } } }}
            />
          ) : null}
          {kind === "PRODUCTS" ? (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Products
              </Typography>
              <Paper variant="outlined" sx={{ p: 1, borderRadius: 1.5 }}>
                <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5 }}>
                  {m.products.map((p) => (
                    <Chip
                      key={p.id}
                      size="small"
                      label={p.name || p.id}
                      onDelete={() => setM({ ...m, products: m.products.filter((x) => x.id !== p.id) })}
                    />
                  ))}
                </Stack>
                <Button size="small" startIcon={<PlusIcon size={14} />} onClick={() => setPicking(true)} disabled={!catalog} sx={{ mt: 0.5 }}>
                  Add products…
                </Button>
              </Paper>
            </Box>
          ) : null}
          <TextField select required label="Discount group" value={m.groupCode} onChange={(e) => setM({ ...m, groupCode: e.target.value })}>
            {matrix.groups.map((g) => (
              <MenuItem key={g.code || g.name} value={g.code}>
                {g.name || g.code}
              </MenuItem>
            ))}
          </TextField>
          {problem ? <Alert severity="error">{problem}</Alert> : null}
          {!problem && covered ? (
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "action.hover" }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Matches today: {covered.length} product{covered.length === 1 ? "" : "s"}
              </Typography>
              {covered.slice(0, 3).map((p) => (
                <Stack key={p.id} direction="row" justifyContent="space-between" spacing={2}>
                  <Typography variant="caption">{p.name}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                    {p.code}
                  </Typography>
                </Stack>
              ))}
              {covered.length > 3 ? (
                <Typography variant="caption" color="text.secondary">
                  … and {covered.length - 3} more
                </Typography>
              ) : null}
              {moving?.map((x) => (
                <Typography key={x.index} variant="caption" color="warning.main" component="div" sx={{ mt: 0.5 }}>
                  {x.count} of these move here from {mappingLabel(x.mapping)} ({groupLabel(matrix, x.mapping.groupCode)}).
                </Typography>
              ))}
            </Paper>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={incomplete || !!problem} onClick={() => onDone(m)}>
          {index < 0 ? t.addButton : t.editButton}
        </Button>
      </DialogActions>
      {picking && catalog ? (
        <ProductPicker
          matrix={matrix}
          catalog={catalog}
          listIndex={index}
          chosen={m.products}
          onClose={() => setPicking(false)}
          onAdd={(added) => {
            setM({ ...m, products: [...m.products, ...added] });
            setPicking(false);
          }}
        />
      ) : null}
    </Dialog>
  );
}

function groupLabel(matrix: ApprovalMatrix, code: string): string {
  return matrix.groups.find((g) => g.code === code)?.name || code;
}

/** Search by name or code and tick several; a product in another list can't be ticked. */
function ProductPicker({
  matrix,
  catalog,
  listIndex,
  chosen,
  onClose,
  onAdd,
}: {
  matrix: ApprovalMatrix;
  catalog: readonly CatalogProduct[];
  listIndex: number;
  chosen: readonly ListedProduct[];
  onClose: () => void;
  onAdd: (p: ListedProduct[]) => void;
}): JSX.Element {
  const [term, setTerm] = useState("");
  const [ticked, setTicked] = useState<CatalogProduct[]>([]);
  const q = term.trim().toLowerCase();
  const already = new Set(chosen.map((p) => p.id));
  const found = q
    ? catalog.filter((p) => !already.has(p.id) && (p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)))
    : [];
  const shown = found.slice(0, 50);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="picker-title">
      <DialogTitle id="picker-title">Choose Products</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label="Name or product code"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          sx={{ mt: 1 }}
        />
        <Typography variant="caption" color="text.secondary" component="div" sx={{ my: 1 }}>
          {q ? `${found.length} found${found.length > shown.length ? `; showing the first ${shown.length}` : ""}.` : "Type to search."}
        </Typography>
        <Stack divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}>
          {shown.map((p) => {
            const inList = listOf(matrix.mappings, p.id, listIndex);
            const now = winnerFor(matrix.mappings, p);
            const on = ticked.some((x) => x.id === p.id);
            return (
              <Stack key={p.id} direction="row" spacing={1} alignItems="flex-start" sx={{ py: 0.75, opacity: inList >= 0 ? 0.75 : 1 }}>
                <Checkbox
                  size="small"
                  checked={on}
                  disabled={inList >= 0}
                  onChange={(_, v) => setTicked(v ? [...ticked, p] : ticked.filter((x) => x.id !== p.id))}
                  slotProps={{ input: { "aria-label": p.name } }}
                  sx={{ p: 0.5 }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {p.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {[p.code, p.classification, p.productUnit].filter(Boolean).join(" · ")}
                  </Typography>
                  {inList >= 0 ? (
                    <Typography variant="caption" color="warning.main" component="div">
                      Already in another product list ({groupLabel(matrix, matrix.mappings[inList].groupCode)}). A product can be in
                      one list only: remove it there first.
                    </Typography>
                  ) : now >= 0 ? (
                    <Typography variant="caption" color="text.secondary" component="div">
                      now: {mappingLabel(matrix.mappings[now])} → {groupLabel(matrix, matrix.mappings[now].groupCode)}
                    </Typography>
                  ) : null}
                </Box>
              </Stack>
            );
          })}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={ticked.length === 0}
          onClick={() => onAdd(ticked.map((p) => ({ id: p.id, name: p.name, code: p.code })))}
        >
          {ticked.length > 1 ? `Add ${ticked.length} products` : "Add product"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// --- Remove -----------------------------------------------------------------

/** Always asks, and says where the products go without the mapping. */
function RemoveDialog({
  matrix,
  catalog,
  index,
  onClose,
  onRemove,
}: {
  matrix: ApprovalMatrix;
  catalog: CatalogProduct[] | null;
  index: number;
  onClose: () => void;
  onRemove: () => void;
}): JSX.Element {
  const m = matrix.mappings[index];
  const noun = m.kind === "PRODUCTS" ? "product list" : m.kind === "SKU" ? "pattern" : "rule";
  const without = matrix.mappings.filter((_, j) => j !== index);
  const covered = catalog
    ? m.kind === "PRODUCTS"
      ? catalog.filter((p) => m.products.some((x) => x.id === p.id))
      : matchedBy(m, catalog).filter((p) => winnerFor(matrix.mappings, p) === index)
    : null;
  const after = covered ? moves(covered, without) : null;
  const what = m.kind === "PRODUCTS" ? `${m.products.length} product${m.products.length === 1 ? "" : "s"}` : mappingLabel(m);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="remove-title">
      <DialogTitle id="remove-title">Remove this {noun}?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          <strong>{what}</strong> → {groupLabel(matrix, m.groupCode)}
        </Typography>
        {covered && after ? (
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "action.hover" }}>
            {covered.length === 0 ? (
              <Typography variant="body2">It covers no active product today.</Typography>
            ) : (
              <Stack spacing={0.5}>
                {after.to.map((x) => (
                  <Typography key={x.index} variant="body2">
                    {x.count} product{x.count === 1 ? "" : "s"} fall back to <strong>{mappingLabel(without[x.index])}</strong> (
                    {groupLabel(matrix, without[x.index].groupCode)}).
                  </Typography>
                ))}
                {after.uncovered ? (
                  <Typography variant="body2" color="error.main">
                    <strong>
                      {after.uncovered} product{after.uncovered === 1 ? " is" : "s are"} covered by nothing else
                    </strong>
                    : a discount on {after.uncovered === 1 ? "it" : "them"} will be blocked at submit until mapped again.
                  </Typography>
                ) : null}
              </Stack>
            )}
          </Paper>
        ) : null}
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1.5 }}>
          Nothing changes until you save the matrix.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="error" onClick={onRemove}>
          Remove {noun}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
