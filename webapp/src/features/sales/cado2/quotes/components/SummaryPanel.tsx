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

import type { JSX, ReactNode } from "react";
import { Box, CircularProgress, Divider, Paper, Stack, Typography } from "@wso2/oxygen-ui";
import { Building2Icon, FileTextIcon, LandmarkIcon, PackageIcon } from "@wso2/oxygen-ui-icons-react";
import type { Totals } from "@features/sales/cado2/quotes/api/quoteTypes";
import {
  BILLING_LABEL,
  formatDate,
  contractEnd,
  type ContactValue,
  type DraftFormValues,
} from "@features/sales/cado2/quotes/form/draftForm";
import { termLabel } from "@features/sales/cado2/quotes/sheet/sheetModel";
import SalesforceLink from "@features/sales/cado2/components/salesforce-link/SalesforceLink";
import { formatMoney } from "@features/sales/cado2/utils/money";

interface SummaryPanelProps {
  /** The form as it stands. */
  readonly values: DraftFormValues;
  /** The chosen legal entity's name, if known. */
  readonly legalEntityName: string | null;
  /** Live totals when priced, else the stored ones, else null. */
  readonly totals: Totals | null;
  /** True while a live preview is being fetched. */
  readonly pricing: boolean;
  /** An action under the totals, e.g. "Preview approvals". */
  readonly approvals?: ReactNode;
}

const SHOWN_LINES = 4;

/**
 * Label above value. Every value has the same look (bold body text); extra
 * detail, if any, is one small grey line under it (third review: one style).
 */
function Field({ label, children, detail }: { label: string; children: ReactNode; detail?: ReactNode }): JSX.Element {
  const empty = children === null || children === undefined || children === "" || children === false;
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.4 }}>
        {label}
      </Typography>
      {empty ? (
        <Typography variant="body2" color="text.disabled">
          Not set yet
        </Typography>
      ) : (
        <>
          <Box sx={{ typography: "body2", fontWeight: 600, color: "text.primary", overflowWrap: "anywhere" }}>
            {children}
          </Box>
          {detail ? (
            <Typography variant="caption" color="text.secondary" component="div">
              {detail}
            </Typography>
          ) : null}
        </>
      )}
    </Box>
  );
}

/** A titled group with an icon badge, so each section stands apart. */
function Group({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }): JSX.Element {
  return (
    <Box component="section" aria-label={title}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
        <Box
          aria-hidden
          sx={{
            width: 26,
            height: 26,
            borderRadius: 1,
            display: "grid",
            placeItems: "center",
            color: "primary.main",
            bgcolor: "action.selected",
          }}
        >
          {icon}
        </Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
      </Stack>
      <Stack spacing={1.25} sx={{ pl: 1.5, ml: 1.5, borderLeft: 2, borderColor: "divider" }}>
        {children}
      </Stack>
    </Box>
  );
}

/** A contact's name, linked to Salesforce when it came from there. */
function contactName(c: ContactValue): ReactNode {
  if (c.mode === "salesforce" && c.sfContactId) {
    return (
      <SalesforceLink object="Contact" id={c.sfContactId}>
        {c.name || c.sfContactId}
      </SalesforceLink>
    );
  }
  if (c.mode === "manual" && c.name.trim()) return c.name.trim();
  return null;
}

/** A contact's detail line: their email, and whether they were typed in. */
function contactDetail(c: ContactValue): string | undefined {
  const parts = [c.email.trim(), c.mode === "manual" && c.name.trim() ? "typed in" : ""].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

const hasContact = (c: ContactValue) =>
  (c.mode === "salesforce" && Boolean(c.sfContactId)) || (c.mode === "manual" && c.name.trim() !== "");

/**
 * The wizard's sticky summary (F5 reviews, 2026-09-25): the totals, then every
 * important value entered so far in four groups, with Salesforce records
 * linked. The wizard's own steps make sure nothing required is skipped, so it
 * lists no issues.
 */
export default function SummaryPanel({ values: v, legalEntityName, totals, pricing, approvals }: SummaryPanelProps): JSX.Element {
  const money = (x: string | null | undefined) => (x ? `${v.currencyIsoCode} ${formatMoney(x)}` : "—");
  const end = contractEnd(v);
  const billing = v.billingFrequency;
  const partner = v.dealType === "PARTNER" ? v.partner : null;
  const addressLines = (a: DraftFormValues["billTo"]) =>
    [a.companyName, [a.city, a.country].filter((x) => x.trim()).join(", ")].filter((x) => x.trim());
  const billTo = addressLines(v.billTo);
  // Ship to is always shown (third review): the bill-to address when it is the same.
  const shipSame = v.dealType !== "PARTNER" && v.shipToSameAsBillTo;
  const shipTo = shipSame ? billTo : addressLines(v.shipTo);

  return (
    <Paper
      variant="outlined"
      sx={{ borderRadius: 2, overflow: "hidden", position: { lg: "sticky" }, top: { lg: 16 } }}
      aria-label="Quote summary"
      component="aside"
    >
      {/* The headline numbers come first. */}
      <Box sx={{ p: 2.5, bgcolor: "action.hover" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4 }}>
            Total order value
          </Typography>
          {pricing ? (
            <Stack direction="row" spacing={0.75} alignItems="center">
              <CircularProgress size={12} />
              <Typography variant="caption" color="text.secondary">
                Updating…
              </Typography>
            </Stack>
          ) : null}
        </Stack>
        <Typography
          variant="h4"
          component="p"
          sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}
        >
          {money(totals?.tcv)}
        </Typography>
        {totals?.netOrderValue ? (
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.25 }}>
            <Typography variant="body2" color="text.secondary">
              Net order value
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {money(totals.netOrderValue)}
            </Typography>
          </Stack>
        ) : null}
      </Box>
      <Divider />
      {approvals ? (
        <>
          <Box sx={{ px: 2.5, py: 2 }}>{approvals}</Box>
          <Divider />
        </>
      ) : null}

      <Stack spacing={2.5} sx={{ p: 2.5 }}>
        <Group title="Customer" icon={<Building2Icon size={14} />}>
          <Field label="Account">
            {v.accountId ? (
              <SalesforceLink object="Account" id={v.accountId}>
                {v.accountName}
              </SalesforceLink>
            ) : null}
          </Field>
          {v.accountId ? (
            <>
              <Field label="Sales region">
                {/* The warning is the Overview step's amber box only (C6, 2026-10-14). */}
                {v.accountSalesRegion || "Not set in Salesforce"}
              </Field>
              <Field label="Sub-region">{v.accountSubRegion || "Not set"}</Field>
            </>
          ) : null}
          <Field label="Opportunity">
            {v.opportunityId ? (
              <SalesforceLink object="Opportunity" id={v.opportunityId}>
                {v.opportunityName || v.opportunityId}
              </SalesforceLink>
            ) : null}
          </Field>
          <Field label="Deal">
            {v.dealType === "PARTNER" ? "Partner deal" : v.dealType === "DIRECT" ? "Direct deal" : null}
          </Field>
          {partner?.name ? (
            <Field label="Partner">
              <SalesforceLink object="Account" id={partner.id}>
                {partner.name}
              </SalesforceLink>
            </Field>
          ) : null}
        </Group>

        <Group title="Deal Terms" icon={<LandmarkIcon size={14} />}>
          <Field label="WSO2 legal entity">{v.legalEntityId ? legalEntityName : null}</Field>
          <Field label="Currency">{v.currencyIsoCode}</Field>
          {/* The term: its dates, length and years. */}
          {v.startDate && end ? (
            <Field
              label="Term"
              detail={[termLabel({ startDate: v.startDate, endDate: end }), `${v.yearCount} year${v.yearCount === 1 ? "" : "s"}`]
                .filter(Boolean)
                .join(" · ")}
            >
              {`${formatDate(v.startDate)} – ${formatDate(end)}`}
            </Field>
          ) : (
            <Field label="Start date">{v.startDate ? formatDate(v.startDate) : null}</Field>
          )}

        </Group>

        <Group title="Products" icon={<PackageIcon size={14} />}>
          {v.lines.length === 0 ? (
            <Typography variant="body2" color="text.disabled">
              None yet
            </Typography>
          ) : (
            <Stack component="ul" spacing={1} sx={{ m: 0, p: 0, listStyle: "none" }} aria-label="Products on the quote">
              {v.lines.slice(0, SHOWN_LINES).map((l, i) => (
                <Box component="li" key={`${l.pricebookEntryId}-${i}`}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {l.productName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    Quantity {l.quantity}
                  </Typography>
                </Box>
              ))}
              {v.lines.length > SHOWN_LINES ? (
                <Typography component="li" variant="caption" color="text.secondary">
                  +{v.lines.length - SHOWN_LINES} more
                </Typography>
              ) : null}
            </Stack>
          )}
        </Group>

        <Group title="Commercials" icon={<FileTextIcon size={14} />}>
          {/* As on the step (D86): billing and payment terms first. */}
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 1.25 }}>
            <Field label="Billing">{billing ? BILLING_LABEL[billing] : null}</Field>
            <Field label="Payment terms">{v.netTermsDays ? `Net ${v.netTermsDays}` : null}</Field>
          </Box>
          <Field label="Bill to">
            {/* The whole address is the value, so every line of it is bold. */}
            {billTo.length
              ? billTo.map((line) => (
                  <Box key={line} component="span" sx={{ display: "block" }}>
                    {line}
                  </Box>
                ))
              : null}
          </Field>
          <Field label="Ship to" detail={shipSame && shipTo.length ? "Same as bill to" : undefined}>
            {shipTo.length
              ? shipTo.map((line) => (
                  <Box key={line} component="span" sx={{ display: "block" }}>
                    {line}
                  </Box>
                ))
              : null}
          </Field>
          <Field label="PO number">{v.poNumber.trim() || null}</Field>
          <Field label="Billing contact" detail={contactDetail(v.billingContact)}>
            {hasContact(v.billingContact) ? contactName(v.billingContact) : null}
          </Field>
          <Field label="Security contact (optional)" detail={contactDetail(v.securityContact)}>
            {hasContact(v.securityContact) ? contactName(v.securityContact) : null}
          </Field>
        </Group>
      </Stack>
    </Paper>
  );
}
