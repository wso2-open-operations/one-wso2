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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { problemOf } from "@features/sales/cado2/quotes/api/errors";
import type { FormulaProduct, Issue, PricingFormula } from "@features/sales/cado2/quotes/api/quoteTypes";
import { formatMoney } from "@features/sales/cado2/utils/money";
import { ProductField, ProductsField } from "@features/sales/cado2/admin/components/AdminProductFields";
import {
  useSavePricingFormula,
  useTryPricingFormula,
} from "@features/sales/cado2/admin/pricing-formulas/api/usePricingFormulaAdmin";
import {
  bindingInputs,
  draftsOf,
  EMPTY_BINDING,
  placeholdersOf,
  usesListPrice,
  usesQty,
  type BindingDraft,
} from "./formulaModel";

const MONO = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" };

/** One placeholder: a fixed value, or the products whose lines it adds up. */
function BindingRow({
  name,
  draft,
  onChange,
  error,
}: {
  name: string;
  draft: BindingDraft;
  onChange: (d: BindingDraft) => void;
  error?: string;
}): JSX.Element {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "flex-start" }}>
      <Typography sx={{ ...MONO, fontWeight: 600, width: 36, pt: { sm: 1 } }}>{name}</Typography>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={draft.kind}
        onChange={(_, k: BindingDraft["kind"] | null) => k && onChange({ ...draft, kind: k })}
        aria-label={`What ${name} is`}
      >
        <ToggleButton value="VALUE">Value</ToggleButton>
        <ToggleButton value="PRODUCTS">Products</ToggleButton>
      </ToggleButtonGroup>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        {draft.kind === "VALUE" ? (
          <TextField
            size="small"
            fullWidth
            placeholder="25000, or 10%"
            value={draft.value}
            onChange={(e) => onChange({ ...draft, value: e.target.value })}
            error={!!error}
            helperText={error}
            slotProps={{ htmlInput: { "aria-label": `Value of ${name}` } }}
          />
        ) : (
          <ProductsField name={name} value={draft.products} onChange={(products) => onChange({ ...draft, products })} error={error} />
        )}
      </Box>
    </Stack>
  );
}

/** The messages of the issues on `field` and the fields under it. */
function messagesOn(issues: readonly Issue[], field: string): string | undefined {
  const m = issues.filter((i) => i.field === field || i.field.startsWith(`${field}.`)).map((i) => i.message);
  return m.length ? m.join(". ") : undefined;
}

interface FormulaEditorDialogProps {
  /** The formula being changed (or a REMOVED version, to bring it back); null for a new one. */
  readonly formula: PricingFormula | null;
  /** The formulas in force, by product, to say when saving makes a new version. */
  readonly saved: ReadonlyMap<string, PricingFormula>;
  readonly onClose: () => void;
  readonly onSaved: (saved: PricingFormula) => void;
}

/**
 * Adds or changes a product's pricing formula (D81): each save is the
 * product's next version, and quotes keep the version they were priced with
 * (D82). Mounted only while open.
 */
export default function FormulaEditorDialog({ formula, saved, onClose, onSaved }: FormulaEditorDialogProps): JSX.Element {
  const save = useSavePricingFormula();
  const tryIt = useTryPricingFormula();
  const [product, setProduct] = useState<FormulaProduct | null>(
    formula ? { id: formula.productId, name: formula.productName, code: formula.productCode } : null,
  );
  const [expression, setExpression] = useState(formula?.expression ?? "");
  // Required (D83): what a line priced with this version shows as its unit of measure.
  const [unitOfMeasure, setUnitOfMeasure] = useState(formula?.unitOfMeasure ?? "");
  const [drafts, setDrafts] = useState<Record<string, BindingDraft>>(() => draftsOf(formula));
  const [samples, setSamples] = useState<Record<string, string>>({});
  const [qty, setQty] = useState("1");
  const [listPrice, setListPrice] = useState("");

  const names = placeholdersOf(expression);
  const sent = bindingInputs(expression, drafts);
  const productsNames = names.filter((n) => drafts[n]?.kind === "PRODUCTS");
  const issues = problemOf(save.error ?? tryIt.error)?.issues ?? [];
  const rowError = (name: string) => messagesOn(issues, `bindings[${sent.findIndex((b) => b.name === name)}]`);
  const general = issues.filter((i) => !/^(expression|unitOfMeasure|bindings\[\d+\])/.test(i.field));
  // A product with a formula in force: saving makes its next version.
  const inForce = formula ?? (product ? saved.get(product.id) : undefined);
  const pending = save.isPending;

  const body = { productId: product?.id ?? "", expression, unitOfMeasure: unitOfMeasure.trim(), bindings: sent };
  const submit = () => {
    tryIt.reset();
    save.mutate(body, { onSuccess: onSaved });
  };
  const runTry = () => {
    save.reset();
    tryIt.mutate({ expression, bindings: sent, samples, quantity: Number(qty) || 1, listPrice });
  };

  return (
    <Dialog open onClose={() => !pending && onClose()} fullWidth maxWidth="md">
      <DialogTitle>{formula ? `Formula for ${formula.productName}` : "New formula"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {formula ? null : (
            <ProductField value={product} onChange={setProduct} error={messagesOn(issues, "productId")} />
          )}
          {inForce ? (
            <Alert severity="info">
              {inForce.status === "REMOVED"
                ? `Removed in v${inForce.version}.`
                : `${formula ? "This is" : `${inForce.productName} already has`} v${inForce.version}.`}{" "}
              Saving makes v{inForce.version + 1}; quotes keep the version they were priced with.
            </Alert>
          ) : null}

          <TextField
            label="Formula"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="max($1, $2 * $3)"
            error={!!messagesOn(issues, "expression")}
            helperText={
              messagesOn(issues, "expression") ??
              "Numbers, $1…$99, QTY, LIST_PRICE, + - * /, brackets, max(…) and min(…). The result is the unit price."
            }
            slotProps={{ htmlInput: { style: MONO, maxLength: 500 } }}
          />

          <TextField
            label="Unit of measure"
            required
            value={unitOfMeasure}
            onChange={(e) => setUnitOfMeasure(e.target.value)}
            placeholder="Annual, higher of 25,000 or 10% of subscription"
            error={!!messagesOn(issues, "unitOfMeasure")}
            helperText={messagesOn(issues, "unitOfMeasure") ?? "Shown as the unit of measure on every line priced with this formula"}
            slotProps={{ htmlInput: { maxLength: 100 } }}
          />

          {names.length ? (
            <Stack spacing={1.5}>
              <Typography variant="subtitle2">Placeholders</Typography>
              <Typography variant="body2" color="text.secondary">
                Give each one a fixed value, or products: it then stands for the total of those products&apos; lines on
                the quote, after their discount.
              </Typography>
              {names.map((n) => (
                <BindingRow
                  key={n}
                  name={n}
                  draft={drafts[n] ?? EMPTY_BINDING}
                  onChange={(d) => setDrafts({ ...drafts, [n]: d })}
                  error={rowError(n)}
                />
              ))}
            </Stack>
          ) : null}

          {expression.trim() ? (
            <Stack spacing={1.5} sx={{ p: 2, borderRadius: 1.5, bgcolor: "action.hover" }}>
              <Typography variant="subtitle2">Try it</Typography>
              <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap">
                {productsNames.map((n) => (
                  <TextField
                    key={n}
                    size="small"
                    label={`Sample total for ${n}`}
                    value={samples[n] ?? ""}
                    onChange={(e) => setSamples({ ...samples, [n]: e.target.value })}
                    sx={{ width: 200 }}
                  />
                ))}
                {usesQty(expression) ? (
                  <TextField size="small" label="QTY" value={qty} onChange={(e) => setQty(e.target.value)} sx={{ width: 120 }} />
                ) : null}
                {usesListPrice(expression) ? (
                  <TextField
                    size="small"
                    label="LIST_PRICE"
                    value={listPrice}
                    onChange={(e) => setListPrice(e.target.value)}
                    sx={{ width: 160 }}
                  />
                ) : null}
                <Button variant="outlined" onClick={runTry} disabled={tryIt.isPending}>
                  {tryIt.isPending ? "Working out…" : "Try it"}
                </Button>
              </Stack>
              {tryIt.data && !tryIt.error ? (
                <Typography variant="body2" aria-label="Sample result">
                  <Box component="span" sx={MONO}>
                    {tryIt.data.explanation}
                  </Box>{" "}
                  = <strong>{formatMoney(tryIt.data.unitPrice)}</strong> per unit
                </Typography>
              ) : null}
            </Stack>
          ) : null}

          {general.length ? (
            <Alert severity="error">
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {general.map((i) => (
                  <li key={`${i.field}${i.message}`}>{i.message}</li>
                ))}
              </Box>
            </Alert>
          ) : null}
          {(save.error || tryIt.error) && !issues.length ? (
            <ErrorNotice error={save.error ?? tryIt.error}>That didn&apos;t work.</ErrorNotice>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={pending || !product || !expression.trim() || !unitOfMeasure.trim()}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
