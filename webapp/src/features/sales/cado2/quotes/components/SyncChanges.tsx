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
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import type { SyncChange, SyncFieldChange, SyncPreview } from "@features/sales/cado2/quotes/api/quoteTypes";
import { formatDate } from "@features/sales/cado2/quotes/form/draftForm";
import { formatMoney } from "@features/sales/cado2/utils/money";

const FIELD_LABEL: Record<string, string> = {
  pricebook: "Price book",
  currency: "Currency",
  subsStartDate: "Subscription start",
  subsEndDate: "Subscription end",
  quantity: "Quantity",
  salesPrice: "Sales price",
  discount: "Discount",
  serviceStartDate: "Service start",
  serviceEndDate: "Service end",
  commission: "Commission",
};

const CHANGE_LABEL: Record<SyncChange, string> = {
  ADDED: "Added",
  CHANGED: "Changed",
  REMOVED: "Removed",
  UNCHANGED: "No change",
};

const CHANGE_COLOR: Record<SyncChange, "success" | "warning" | "error" | "default"> = {
  ADDED: "success",
  CHANGED: "warning",
  REMOVED: "error",
  UNCHANGED: "default",
};

/** One value as the AM reads it: dates spelled out, amounts in the quote's currency, percentages with %. */
function formatSyncValue(field: string, value: string | null, currency: string): string {
  if (value === null || value === "") return "(none)";
  switch (field) {
    case "subsStartDate":
    case "subsEndDate":
    case "serviceStartDate":
    case "serviceEndDate":
      return formatDate(value);
    case "salesPrice":
      return `${currency} ${formatMoney(value)}`;
    case "discount":
    case "commission":
      return `${Number(value)}%`;
    default:
      return value;
  }
}

/** "Sales price USD 25,000.00 → USD 30,000.00". */
function FieldChange({ f, currency }: { readonly f: SyncFieldChange; readonly currency: string }): JSX.Element {
  return (
    <Typography variant="body2" component="div">
      {FIELD_LABEL[f.field] ?? f.field}{" "}
      <Box component="span" sx={{ color: "text.secondary", textDecoration: "line-through" }}>
        {formatSyncValue(f.field, f.before, currency)}
      </Box>{" "}
      →{" "}
      <Box component="span" sx={{ fontWeight: 600 }}>
        {formatSyncValue(f.field, f.after, currency)}
      </Box>
    </Typography>
  );
}

/** An added product's values in one line: "Quantity 2 · Sales price USD 48,000.00 · …". */
function addedSummary(fields: readonly SyncFieldChange[], currency: string): string {
  const shown = fields.filter((f) => !(f.field === "discount" && Number(f.after) === 0) && f.after !== null);
  return shown.map((f) => `${FIELD_LABEL[f.field] ?? f.field} ${formatSyncValue(f.field, f.after, currency)}`).join(" · ");
}

/**
 * What a sync would change on the Salesforce opportunity (D138): the
 * opportunity's fields, then each product added, changed (field by field),
 * removed, or unchanged (folded). Shown in the "Sync to Salesforce" dialog
 * and, folded, in the submit dialog of a primary quote.
 */
export default function SyncChanges({ preview }: { readonly preview: SyncPreview }): JSX.Element {
  const [showUnchanged, setShowUnchanged] = useState(false);
  const { currency } = preview;
  const changedProducts = preview.products.filter((p) => p.change !== "UNCHANGED");
  const unchanged = preview.products.filter((p) => p.change === "UNCHANGED");
  return (
    <Stack spacing={2}>
      {preview.opportunity.length ? (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Opportunity
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small" aria-label="Opportunity changes">
              <TableHead>
                <TableRow>
                  <TableCell>Field</TableCell>
                  <TableCell>In Salesforce now</TableCell>
                  <TableCell>After the sync</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {preview.opportunity.map((f) => (
                  <TableRow key={f.field}>
                    <TableCell>{FIELD_LABEL[f.field] ?? f.field}</TableCell>
                    {f.changed ? (
                      <>
                        <TableCell sx={{ color: "text.secondary" }}>{formatSyncValue(f.field, f.before, currency)}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{formatSyncValue(f.field, f.after, currency)}</TableCell>
                      </>
                    ) : (
                      <TableCell colSpan={2} sx={{ color: "text.secondary" }}>
                        {formatSyncValue(f.field, f.after, currency)} · no change
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ) : null}
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Products
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Product changes">
            <TableBody>
              {changedProducts.map((p, i) => (
                <TableRow key={`${p.productName}-${i}`}>
                  <TableCell sx={{ width: "32%" }}>{p.productName}</TableCell>
                  <TableCell sx={{ width: 110 }}>
                    <Chip size="small" variant="outlined" color={CHANGE_COLOR[p.change]} label={CHANGE_LABEL[p.change]} />
                  </TableCell>
                  <TableCell>
                    {p.change === "ADDED" ? (
                      <Typography variant="body2">{addedSummary(p.fields, currency)}</Typography>
                    ) : p.change === "REMOVED" ? (
                      <Typography variant="body2" color="text.secondary">
                        Not on the quote
                      </Typography>
                    ) : (
                      p.fields.filter((f) => f.changed).map((f) => <FieldChange key={f.field} f={f} currency={currency} />)
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {unchanged.length && showUnchanged
                ? unchanged.map((p, i) => (
                    <TableRow key={`same-${p.productName}-${i}`}>
                      <TableCell>{p.productName}</TableCell>
                      <TableCell>
                        <Chip size="small" variant="outlined" label={CHANGE_LABEL.UNCHANGED} />
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  ))
                : null}
            </TableBody>
          </Table>
        </TableContainer>
        {unchanged.length ? (
          <Button size="small" onClick={() => setShowUnchanged((v) => !v)} sx={{ mt: 0.5 }}>
            {showUnchanged
              ? "Hide the products with no change"
              : `${unchanged.length} ${unchanged.length === 1 ? "product" : "products"} with no change`}
          </Button>
        ) : null}
      </Box>
    </Stack>
  );
}
