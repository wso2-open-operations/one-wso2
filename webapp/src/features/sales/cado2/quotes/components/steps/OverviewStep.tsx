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

import { useCallback, useEffect, useRef, useState, type JSX, type ReactNode } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { Alert, AlertTitle, Box, Chip, MenuItem, Stack, TextField, Typography } from "@wso2/oxygen-ui";
import {
  useAccountContacts,
  useAccountOpportunities,
  useActiveLegalEntities,
  useCurrencies,
  useOpportunityProducts,
} from "@features/sales/cado2/quotes/api/useQuoteApi";
import type { Account, Opportunity } from "@features/sales/cado2/quotes/api/quoteTypes";
import {
  BriefcaseIcon,
  Building2Icon,
  LandmarkIcon,
  RepeatIcon,
  StarIcon,
} from "@wso2/oxygen-ui-icons-react";
import {
  addressFrom,
  emptyAddress,
  emptyContact,
  parseDateString,
  pulledLines,
  type DraftFormValues,
} from "@features/sales/cado2/quotes/form/draftForm";
import SalesforceFindings, { type Finding } from "@features/sales/cado2/quotes/components/SalesforceFindings";
import { formatMoney } from "@features/sales/cado2/utils/money";
import AccountPicker from "@features/sales/cado2/quotes/components/pickers/AccountPicker";
import OpportunityPicker from "@features/sales/cado2/quotes/components/pickers/OpportunityPicker";
import SectionCard from "@features/sales/cado2/components/section-card/SectionCard";
import { lockedRenewalStart } from "@features/sales/cado2/quotes/form/renewalStart";
import { subscriptionPeriod } from "@features/sales/cado2/utils/subscription";
import { useFieldIssue } from "@features/sales/cado2/quotes/components/fieldIssues";
import PrimaryQuoteField from "@features/sales/cado2/quotes/components/PrimaryQuoteField";

interface OverviewStepProps {
  /** After the first save the account and opportunity are fixed (UI choice 3). */
  readonly locked: boolean;
  /** The quote being edited; null before its first save. */
  readonly quoteId?: number | null;
}

/** The saved opportunity, when Salesforce no longer lists it (shown locked). */
function lockedOpportunity(id: string, name: string): Opportunity {
  return {
    id,
    name: name || id,
    stageName: null,
    closeDate: null,
    createdDate: null,
    currencyIsoCode: null,
    isWon: null,
    isClosed: null,
    directChannel: null,
    dealType: null,
    partner: null,
    recordTypeName: null,
    dealKind: "OTHER",
    arr: null,
  };
}

/** A step section: the app-wide section card with its fields stacked. */
function Section({
  title,
  icon,
  aside,
  children,
}: {
  title: string;
  icon: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SectionCard title={title} icon={icon} aside={aside}>
      <Stack spacing={2}>{children}</Stack>
    </SectionCard>
  );
}

const DEAL_KIND_LABEL = { FIRST_SALE: "First Sale", RENEWAL: "Renewal", EXPANSION: "Expansion" } as const;

/** Stage ②: what Salesforce has for the chosen account (the deal details belong to each opportunity). */
function accountFindings(
  account: { place: string; salesRegion: string; subRegion: string },
  opportunities: number | null,
  contacts: number | null,
): Finding[] {
  // null = the lookup failed: say so, never "None found" (2026-10-13).
  // No "Account" line: the chosen account is shown just above, more prominently.
  return [
    ...(account.place ? [{ key: "location", label: "Location", value: account.place }] : []),
    // Required to quote (D59).
    { key: "region", label: "Sales region", value: account.salesRegion || "Not set in Salesforce", },
    // Informational: never blocks.
    { key: "subRegion", label: "Sub-region", value: account.subRegion || "Not set in Salesforce" },
    {
      key: "opportunities",
      label: "Open opportunities",
      value:
        opportunities === null
          ? "Couldn't load from Salesforce"
          : opportunities
            ? `${opportunities} found, newest first`
            : "None found",
      warning: !opportunities,
    },
    {
      key: "contacts",
      label: "Contacts",
      value: contacts === null ? "Couldn't load from Salesforce" : contacts ? `${contacts} found` : "None found",
      warning: contacts === null,
    },
  ];
}

/**
 * Stage ③: what Salesforce says about the chosen opportunity.
 * Problems only Salesforce can fix are warning lines here.
 */
function dealFindings(v: DraftFormValues, o: Opportunity | undefined): Finding[] {
  const out: Finding[] = [];
  if (v.dealKind === "OTHER") {
    out.push({
      key: "kind",
      label: "Deal kind",
      value: `${v.recordTypeName ? `“${v.recordTypeName}”` : "No record type"}: the approvals treat it as a First Sale`,
      warning: true,
    });
  } else if (v.dealKind) {
    out.push({ key: "kind", label: "Deal kind", value: DEAL_KIND_LABEL[v.dealKind] });
  }
  if (v.dealType === "DIRECT") {
    out.push({ key: "channel", label: "Channel", value: "Direct deal" });
  } else if (v.dealType === "PARTNER") {
    out.push(
      v.partner?.name
        ? { key: "channel", label: "Channel", value: `Partner deal · ${v.partner.name}${v.partner.role ? ` (${v.partner.role})` : ""}` }
        : { key: "channel", label: "Channel", value: "Partner deal, but no primary partner in Salesforce. Add it there.", warning: true },
    );
  } else {
    out.push({
      key: "channel",
      label: "Channel",
      value: "Salesforce doesn't say whether this is direct or partner-led (Direct_Channel__c). Set it on the opportunity.",
      warning: true,
    });
  }
  // The subscription it covers (2026-10-09), not its pipeline stage.
  if (o) {
    out.push({
      key: "subscription",
      label: "Subscription",
      value: subscriptionPeriod(o),
    });
  }
  if (o?.arr !== null && o?.arr !== undefined) {
    out.push({ key: "arr", label: "ARR in Salesforce", value: `${o.currencyIsoCode ?? ""} ${formatMoney(o.arr.toFixed(2))}`.trim() });
  }
  return out;
}

/** Step ① Overview. */
export default function OverviewStep({ locked, quoteId = null }: OverviewStepProps): JSX.Element {
  const { control, setValue, getValues } = useFormContext<DraftFormValues>();
  const [accountId, isRenewal, opportunityId] = useWatch({
    control,
    name: ["accountId", "isRenewal", "opportunityId"],
  });
  const values = useWatch({ control }) as DraftFormValues;
  // The rest of the step appears once Salesforce's findings for the deal are showing
  // (at once on a saved draft, whose account and opportunity are fixed).
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const markRevealed = useCallback(() => setRevealedFor(opportunityId), [opportunityId]);
  const showRest = Boolean(opportunityId) && (locked || revealedFor === opportunityId);

  // A new quote starts from its opportunity's products (D72): only the
  // products, 1 unit each, priced from its price book; once per opportunity
  // chosen, before the first save fixes it.
  const pulled = useOpportunityProducts(!locked && accountId ? accountId : null, !locked && opportunityId ? opportunityId : null);
  const pulledFor = useRef<string | null>(null);
  useEffect(() => {
    if (locked || !pulled.data || !opportunityId || pulledFor.current === opportunityId) return;
    pulledFor.current = opportunityId;
    setValue("lines", pulledLines(pulled.data.products), { shouldDirty: true });
    setValue("notBroughtIn", pulled.data.notBroughtIn, { shouldDirty: true });
  }, [locked, pulled.data, opportunityId, setValue]);
  // Likewise, the opportunity list waits until the account's findings have
  // all ticked in (2026-10-09), so the page doesn't change under them.
  const [accountRevealedFor, setAccountRevealedFor] = useState<string | null>(null);
  const markAccountRevealed = useCallback(() => setAccountRevealedFor(accountId), [accountId]);

  // Open opportunities to quote (2026-10-09); a renewal renews closed-won ones.
  const opportunities = useAccountOpportunities(accountId || null);
  const wonOpportunities = useAccountOpportunities(isRenewal && accountId ? accountId : null, "won");
  const contacts = useAccountContacts(accountId || null);
  const legalEntities = useActiveLegalEntities();
  // For pre-filling the quote's currency from the opportunity.
  const currencies = useCurrencies();

  const oppIssue = useFieldIssue("sfOpportunityId");

  const accountAddress = useWatch({ control, name: "accountAddress" });
  const accountSalesRegion = useWatch({ control, name: "accountSalesRegion" });
  const accountSubRegion = useWatch({ control, name: "accountSubRegion" });

  const chooseAccount = (a: Account | null) => {
    setValue("accountId", a?.id ?? "", { shouldDirty: true });
    setValue("accountName", a?.name ?? "", { shouldDirty: true });
    setValue("accountAddress", a?.billingAddress ?? null, {
      shouldDirty: true,
    });
    setValue("accountSalesRegion", a?.salesRegion ?? "", { shouldDirty: true });
    setValue("accountSubRegion", a?.subRegion ?? "", { shouldDirty: true });
    // A different account invalidates everything taken from the old one.
    for (const f of ["opportunityId", "opportunityName"] as const) setValue(f, "", { shouldDirty: true });
    setValue("dealType", null, { shouldDirty: true });
    setValue("partner", null, { shouldDirty: true });
    setValue("dealKind", "", { shouldDirty: true });
    setValue("recordTypeName", "", { shouldDirty: true });
    setValue("isRenewal", false, { shouldDirty: true });
    setValue("previousOpportunityIds", [], { shouldDirty: true });
    for (const f of ["billingContact", "securityContact"] as const)
      setValue(f, { ...emptyContact }, { shouldDirty: true });
    setValue("billTo", { ...emptyAddress }, { shouldDirty: true });
    setValue("shipTo", { ...emptyAddress }, { shouldDirty: true });
  };

  const chooseOpportunity = (o: Opportunity | undefined) => {
    if (!o) return;
    setValue("opportunityId", o.id, { shouldDirty: true });
    setValue("opportunityName", o.name ?? "", { shouldDirty: true });
    setValue("dealType", o.dealType, { shouldDirty: true });
    setValue("partner", o.partner, { shouldDirty: true });
    // Salesforce decides whether this is a renewal.
    setValue("dealKind", o.dealKind, { shouldDirty: true });
    setValue("recordTypeName", o.recordTypeName ?? "", { shouldDirty: true });
    setValue("isRenewal", o.dealKind === "RENEWAL", { shouldDirty: true });
    if (o.dealKind !== "RENEWAL") setValue("previousOpportunityIds", [], { shouldDirty: true });
    // The contract start from the opportunity; without
    // one the AM enters it. Its end is not read: the AM adds the years.
    const start = o.subsStartDate && parseDateString(o.subsStartDate) ? o.subsStartDate : "";
    setValue("startDate", start, { shouldDirty: true });
    // Pre-fill addresses: partner deals bill the partner and ship
    // to the customer; direct deals bill and ship to the customer.
    const v = getValues();
    const customer = addressFrom(v.accountId, v.accountName, v.accountAddress);
    // Currency and price book from the opportunity: its products all
    // come from one book. Only a currency CadO2 offers; Products & Pricing
    // drops a book with no active products in it, and says why.
    const offered = Boolean(o.currencyIsoCode && currencies.data?.includes(o.currencyIsoCode));
    setValue("currencyIsoCode", offered ? (o.currencyIsoCode ?? "") : "", { shouldDirty: true });
    setValue("defaultPricebookId", offered ? (o.pricebook?.id ?? "") : "", { shouldDirty: true });
    setValue("defaultPricebookName", offered ? (o.pricebook?.name ?? "") : "", { shouldDirty: true });
    if (o.dealType === "PARTNER" && o.partner?.id) {
      setValue("billTo", addressFrom(o.partner.id, o.partner.name ?? "", o.partner.billingAddress), {
        shouldDirty: true,
      });
      setValue("shipTo", customer, { shouldDirty: true });
      setValue("shipToSameAsBillTo", false, { shouldDirty: true });
    } else {
      setValue("billTo", customer, { shouldDirty: true });
      setValue("shipTo", { ...emptyAddress }, { shouldDirty: true });
      setValue("shipToSameAsBillTo", true, { shouldDirty: true });
    }
  };

  const previousOptions = (wonOpportunities.data ?? []).filter((o) => o.id !== opportunityId);

  // A renewal's start is locked (D85): its own opportunity's start date, else
  // the day after the renewed opportunity ends, set when that is chosen;
  // shown on Products & Pricing. Without either in Salesforce, the AM chooses it there.
  const renewedOf = (ids: readonly string[]) => (wonOpportunities.data ?? []).filter((o) => ids.includes(o.id));
  const chooseRenewed = (ids: string[]) => {
    setValue("previousOpportunityIds", ids, { shouldDirty: true });
    const own = opportunities.data?.find((o) => o.id === opportunityId);
    const locked = lockedRenewalStart(own, renewedOf(ids));
    setValue("startDate", locked?.date ?? "", { shouldDirty: true });
  };

  // Watched, not read once: picking an account re-renders on its id before
  // the name is set, and a one-off read would show the old (empty) name.
  const accountName = useWatch({ control, name: "accountName" });
  const opportunityName = useWatch({ control, name: "opportunityName" });

  return (
    <Stack spacing={2.5}>
      <Section
        title="Customer & Opportunity"
        icon={<Building2Icon size={18} />}
        aside={locked ? <Chip size="small" variant="outlined" label="Fixed after first save" /> : undefined}
      >
        {/* Account first; the opportunity list appears once it is chosen (F5 feedback). */}
        <AccountPicker
          chosenName={accountId ? accountName : ""}
          locked={locked}
          onChoose={chooseAccount}
        />
        {locked ? (
          <Typography variant="body2" color="text.secondary">
            The account and opportunity can&apos;t change after the first save. For a different opportunity, start a new
            quote.
          </Typography>
        ) : null}

        {accountId ? (
          <SalesforceFindings
            key={accountId}
            title="Found in Salesforce for This Account"
            onDone={markAccountRevealed}
            loading={opportunities.isPending || contacts.isPending}
            findings={accountFindings(
              {
                place: [accountAddress?.city, accountAddress?.country].filter(Boolean).join(", "),
                salesRegion: accountSalesRegion,
                subRegion: accountSubRegion,
              },
              opportunities.error ? null : (opportunities.data ?? []).length,
              contacts.error ? null : (contacts.data ?? []).length,
            )}
            animate={!locked}
          />
        ) : null}

        {/* Approvals will route on the region (2026-10-07): the quote can't go on without it. */}
        {accountId && !accountSalesRegion ? (
          <Alert severity="error" role="alert">
            <AlertTitle>This account has no sales region in Salesforce</AlertTitle>
            CADO2 needs the account&apos;s Sales Region (<code>Sales_Regions__c</code>) to route approvals. Ask your
            Salesforce admin to set it on the account, then choose the account again
            {locked ? " (or save the draft to refresh it)" : ""}.
          </Alert>
        ) : null}

        {accountId && (locked || accountRevealedFor === accountId) ? (
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <BriefcaseIcon size={16} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Opportunity
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Open ones, newest first
              </Typography>
            </Stack>
            {/* A failed lookup is an error, not "no open opportunities" (2026-10-13). */}
            {opportunities.error && !locked ? (
              <ErrorNotice
                error={opportunities.error}
                onRetry={() => void opportunities.refetch()}
                retrying={opportunities.isFetching}
                sx={{ mb: 1.5 }}
              >
                Couldn&apos;t load the account&apos;s opportunities from Salesforce.
              </ErrorNotice>
            ) : (
            <OpportunityPicker
              label="Opportunity"
              opportunities={
                locked && !(opportunities.data ?? []).some((o) => o.id === opportunityId)
                  ? [lockedOpportunity(opportunityId, opportunityName)]
                  : (opportunities.data ?? [])
              }
              loading={opportunities.isPending}
              selected={opportunityId ? [opportunityId] : []}
              onChange={([id]) => chooseOpportunity(opportunities.data?.find((o) => o.id === id))}
              locked={locked}
              error={oppIssue}
              emptyText="This account has no open opportunities in Salesforce."
              instruction="Choose the opportunity this quote is for"
            />
            )}
          </Box>
        ) : null}

        {opportunityId ? (
          <SalesforceFindings
            key={opportunityId}
            title="What Salesforce Says About This Deal"
            loading={!locked && opportunities.isPending}
            findings={dealFindings(values, opportunities.data?.find((o) => o.id === opportunityId))}
            animate={!locked}
            onDone={markRevealed}
          />
        ) : null}
      </Section>

      {/* Everything else waits for the account and the deal (2026-09-28). */}
      {showRest ? (
        <>
          {/* Which of the opportunity's quotes is synced to Salesforce (D68). */}
          <Section title="Primary Quote" icon={<StarIcon size={18} />}>
            <PrimaryQuoteField quoteId={quoteId} opportunityId={opportunityId} />
          </Section>
          {/* Salesforce says it's a renewal: which opportunities does it renew? */}
          {isRenewal ? (
            <Section title="Renewal" icon={<RepeatIcon size={18} />}>
              <Controller
                name="previousOpportunityIds"
                control={control}
                render={({ field }) => (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Choose the closed-won opportunities this renews; several when co-terminated deals are consolidated. Their
                      ARR is compared with this quote&apos;s to check for a downsell, and the quote starts the day after they end.
                    </Typography>
                    {wonOpportunities.error ? (
                      <ErrorNotice
                        error={wonOpportunities.error}
                        onRetry={() => void wonOpportunities.refetch()}
                        retrying={wonOpportunities.isFetching}
                        sx={{ mb: 1.5 }}
                      >
                        Couldn&apos;t load the account&apos;s closed-won opportunities from Salesforce.
                      </ErrorNotice>
                    ) : (
                    <OpportunityPicker
                      label="Previous opportunities"
                      multiple
                      opportunities={previousOptions}
                      loading={wonOpportunities.isPending}
                      selected={field.value}
                      onChange={chooseRenewed}
                      emptyText="This account has no closed-won opportunities in Salesforce."
                      instruction="Tick the opportunities this quote renews"
                    />
                    )}
                  </Box>
                )}
              />
            </Section>
          ) : null}

          {/* The currency moved to Products & Pricing, next to the price book. */}
          <Section title="WSO2 Legal Entity" icon={<LandmarkIcon size={18} />}>
            {legalEntities.error ? (
              <ErrorNotice
                error={legalEntities.error}
                onRetry={() => void legalEntities.refetch()}
                retrying={legalEntities.isFetching}
                sx={{ mb: 1.5 }}
              >
                Couldn&apos;t load the legal entities.
              </ErrorNotice>
            ) : null}
            <Controller
              name="legalEntityId"
              control={control}
              render={({ field }) => (
                <TextField {...field} select label="WSO2 legal entity" size="small" fullWidth required sx={{ maxWidth: 480 }}>
                  {(legalEntities.data ?? []).map((le) => (
                    <MenuItem key={le.id} value={String(le.id)}>
                      {le.name} ({le.country})
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Section>

        </>
      ) : null}

    </Stack>
  );
}
