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
import { Box, Chip, Link, Paper, Stack, Typography } from "@wso2/oxygen-ui";
import { FileTextIcon, MapPinIcon, MessageSquareTextIcon } from "@wso2/oxygen-ui-icons-react";
import type { ContactRole, QuoteSheet, SheetAddress, SheetContact } from "@features/sales/cado2/quotes/sheet/sheetModel";
import SheetCard, { Fact, FactGrid } from "@features/sales/cado2/components/section-card/SectionCard";
import { BILLING_LABEL } from "@features/sales/cado2/quotes/form/draftForm";

function TextBlock({ children }: { children: ReactNode }): JSX.Element {
  return (
    <Box sx={{ mt: 0.5, pl: 1.5, borderLeft: 3, borderColor: "divider", whiteSpace: "pre-wrap" }}>
      <Typography variant="body2">{children}</Typography>
    </Box>
  );
}

/**
 * Billing (every quote, D88), payment terms and PO: as on the Commercials
 * step (D86). The terms are in the Legal section.
 */
export function TermsSection({ sheet }: { sheet: QuoteSheet }): JSX.Element {
  return (
    <SheetCard title="Commercial Terms" icon={<FileTextIcon size={18} />}>
      <FactGrid>
        <Fact label="Billing frequency" value={sheet.billingFrequency ? BILLING_LABEL[sheet.billingFrequency] : ""} />
        <Fact
          label="Payment terms"
          value={sheet.netTermsDays ? `Net ${sheet.netTermsDays}` : ""}
          hint={sheet.netTermsDays ? `Due ${sheet.netTermsDays} days after the invoice` : undefined}
        />
        <Fact label="PO number" value={sheet.poNumber ?? "None"} />
      </FactGrid>
      {/* Without the legal sections (texts not configured), the special terms show here. */}
      {!sheet.legal ? (
        <Box sx={{ mt: 2.5 }}>
          <Typography variant="overline" color="text.secondary">
            Special terms
          </Typography>
          {sheet.specialTerms ? <TextBlock>{sheet.specialTerms}</TextBlock> : <Typography variant="body2">None</Typography>}
        </Box>
      ) : null}
    </SheetCard>
  );
}

const CONTACT_LABEL: Record<ContactRole, string> = { BILLING: "Billing contact", SECURITY: "Security contact" };

/** A contact under its address, as on the order form; quiet, since it matters for the document. */
function ContactBlock({ role, contact }: { role: ContactRole; contact: SheetContact | null }): JSX.Element {
  return (
    <Box aria-label={CONTACT_LABEL[role]}>
      <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4, display: "block" }}>
        {CONTACT_LABEL[role]}
      </Typography>
      {contact ? (
        <>
          <Typography variant="body2">
            {contact.name}
            {contact.title ? (
              <Box component="span" sx={{ color: "text.secondary" }}>
                {` · ${contact.title}`}
              </Box>
            ) : null}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
            {contact.email ? (
              <Link href={`mailto:${contact.email}`} color="inherit">
                {contact.email}
              </Link>
            ) : null}
            {contact.source === "MANUAL" ? `${contact.email ? " · " : ""}typed in` : null}
          </Typography>
        </>
      ) : (
        <Typography variant="body2" color="text.disabled" sx={{ fontStyle: "italic" }}>
          {role === "SECURITY" ? "Not set (optional)" : "Not set yet"}
        </Typography>
      )}
    </Box>
  );
}

function AddressCard({
  title,
  address,
  note,
  contact,
}: {
  title: string;
  address: SheetAddress | null;
  note?: string;
  contact: ReactNode;
}): JSX.Element {
  return (
    // Three rows (title, address, contact) shared with the card beside it
    // (subgrid), so both cards' sections line up whatever their length.
    <Paper
      variant="outlined"
      aria-label={title}
      sx={{ p: 2, borderRadius: 2, minWidth: 0, display: "grid", gridRow: "span 3", gridTemplateRows: "subgrid", rowGap: 1 }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "text.secondary" }}>
        <MapPinIcon size={14} />
        <Typography variant="overline" sx={{ lineHeight: 1.4 }}>
          {title}
        </Typography>
        {note ? <Chip size="small" variant="outlined" label={note} /> : null}
      </Stack>
      <Box>
        {!address ? (
          <Typography variant="body2" color="text.disabled" sx={{ fontStyle: "italic" }}>
            Not set yet
          </Typography>
        ) : (
          <>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {address.companyName}
            </Typography>
            {address.lines.map((l) => (
              <Typography key={l} variant="body2" color="text.secondary">
                {l}
              </Typography>
            ))}
            {address.taxId ? (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
                Tax ID {address.taxId}
              </Typography>
            ) : null}
          </>
        )}
      </Box>
      <Box sx={{ borderTop: 1, borderColor: "divider", pt: 1.5, mt: 0.5 }}>{contact}</Box>
    </Paper>
  );
}

/** Bill to with the billing contact, ship to with the security contact: section 01 of the order form. */
export function AddressesSection({ sheet }: { sheet: QuoteSheet }): JSX.Element {
  return (
    <SheetCard title="Addresses and Contacts" icon={<MapPinIcon size={18} />}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0,1fr))" }, columnGap: 1.5, rowGap: 1.5 }}>
        <AddressCard title="Bill To" address={sheet.billTo} contact={<ContactBlock role="BILLING" contact={sheet.contacts[0]} />} />
        <AddressCard
          title="Ship To"
          // Printed in full either way; a small mark says it's the bill-to address.
          address={sheet.shipToSameAsBillTo ? sheet.billTo : sheet.shipTo}
          note={sheet.shipToSameAsBillTo ? "Same as bill to" : undefined}
          contact={<ContactBlock role="SECURITY" contact={sheet.contacts[1]} />}
        />
      </Box>
    </SheetCard>
  );
}

/** The rep's justification for approvers. */
export function JustificationSection({ sheet }: { sheet: QuoteSheet }): JSX.Element {
  return (
    <SheetCard title="Justification" icon={<MessageSquareTextIcon size={18} />}>
      {sheet.justification ? (
        <TextBlock>{sheet.justification}</TextBlock>
      ) : (
        <Typography variant="body2" color="text.disabled" sx={{ fontStyle: "italic" }}>
          None given
        </Typography>
      )}
    </SheetCard>
  );
}
