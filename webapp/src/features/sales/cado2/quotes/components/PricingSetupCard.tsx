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

import { useEffect, useState, type JSX } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Alert, AlertTitle, InputAdornment, MenuItem, Stack, TextField } from "@wso2/oxygen-ui";
import { CoinsIcon, LockIcon } from "@wso2/oxygen-ui-icons-react";
import SectionCard from "@features/sales/cado2/components/section-card/SectionCard";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import LifecycleDialog from "@features/sales/cado2/quotes/components/detail/LifecycleDialog";
import { useAccountOpportunities, useCurrencies, usePricebooks } from "@features/sales/cado2/quotes/api/useQuoteApi";
import { useFieldIssue } from "@features/sales/cado2/quotes/components/fieldIssues";
import type { DraftFormValues } from "@features/sales/cado2/quotes/form/draftForm";

const FROM_SALESFORCE = "From the Salesforce opportunity";

/** A choice waiting for the AM to confirm removing the products (D10). */
type PendingChange =
  | { readonly kind: "currency"; readonly value: string }
  | { readonly kind: "book"; readonly value: string; readonly name: string };

/**
 * The quote's currency and price book (D142). What the Salesforce opportunity
 * has is locked: Salesforce allows one price book per opportunity, and every
 * product on it comes from that book. What it lacks, the AM chooses here,
 * and the sync sets it on the opportunity:
 *
 *   opportunity has          currency       price book
 *   currency + price book    locked         locked
 *   currency, no book        locked         AM chooses
 *   neither                  AM chooses     AM chooses
 *
 * Changing a choice once products are added asks first and removes them,
 * as their prices come from the book and currency. A locked book Salesforce
 * can't use (inactive, or no active products in the currency) is to be
 * fixed there; no products can be added until it is.
 */
export default function PricingSetupCard(): JSX.Element {
  const { control, setValue, getValues } = useFormContext<DraftFormValues>();
  const [accountId, opportunityId, currency, bookId, bookName] = useWatch({
    control,
    name: ["accountId", "opportunityId", "currencyIsoCode", "defaultPricebookId", "defaultPricebookName"],
  });
  const opportunities = useAccountOpportunities(accountId || null);
  const opportunity = opportunities.data?.find((o) => o.id === opportunityId);
  const sfCurrency = opportunity?.currencyIsoCode ?? null;
  const sfBook = opportunity?.pricebook ?? null;
  const currencyLocked = Boolean(sfCurrency);
  const bookLocked = Boolean(sfBook);
  // The currency list is only needed when the AM chooses it (D143: Salesforce's).
  const currencies = useCurrencies(Boolean(opportunity) && !currencyLocked);
  const activeCurrency = currencyLocked ? (sfCurrency ?? "") : currency;
  const books = usePricebooks(opportunity ? activeCurrency : "");
  const usable = Boolean(sfBook && books.data?.some((b) => b.id === sfBook.id));
  const currencyIssue = useFieldIssue("currencyIsoCode");
  const bookIssue = useFieldIssue("defaultPricebookId");
  const [pending, setPending] = useState<PendingChange | null>(null);

  // What's wrong in Salesforce with a locked book; null while loading.
  const problem =
    opportunity && bookLocked && sfBook && books.data && !usable
      ? `The opportunity's price book, ${sfBook.name ?? sfBook.id}, is inactive in Salesforce or has no active products in ${activeCurrency}. Fix it in Salesforce, then reload this quote.`
      : null;

  // What the opportunity has, the form follows (the backend does the same on save).
  useEffect(() => {
    if (!opportunity) return;
    if (currencyLocked && currency !== sfCurrency) setValue("currencyIsoCode", sfCurrency ?? "", { shouldDirty: true });
    if (!bookLocked || !books.data) return; // the AM's choice, or the book's check still loading
    const next = usable && sfBook ? sfBook : null;
    if (bookId !== (next?.id ?? "")) {
      setValue("defaultPricebookId", next?.id ?? "", { shouldDirty: true });
      setValue("defaultPricebookName", next?.name ?? "", { shouldDirty: true });
    }
  }, [opportunity, currencyLocked, bookLocked, sfCurrency, sfBook, books.data, usable, currency, bookId, setValue]);

  const apply = (change: PendingChange) => {
    if (change.kind === "currency") {
      setValue("currencyIsoCode", change.value, { shouldDirty: true });
      // A book is priced per currency: choose it again.
      setValue("defaultPricebookId", "", { shouldDirty: true });
      setValue("defaultPricebookName", "", { shouldDirty: true });
    } else {
      setValue("defaultPricebookId", change.value, { shouldDirty: true });
      setValue("defaultPricebookName", change.name, { shouldDirty: true });
    }
    setValue("lines", [], { shouldDirty: true });
  };
  const choose = (change: PendingChange) => {
    if (getValues("lines").length > 0) setPending(change);
    else apply(change);
  };
  const lineCount = getValues("lines").length;

  const locked = { input: { readOnly: true, endAdornment: <InputAdornment position="end"><LockIcon size={14} /></InputAdornment> } };
  const missing = !opportunity ? null : !currencyLocked ? "currency and price book" : !bookLocked ? "price book" : null;
  return (
    <SectionCard title="Currency & Price Book" icon={<CoinsIcon size={18} />}>
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          {currencyLocked || !opportunity ? (
            <TextField
              label="Currency"
              value={currency || "—"}
              size="small"
              error={Boolean(currencyIssue) && !problem}
              helperText={(!problem && currencyIssue) || FROM_SALESFORCE}
              slotProps={locked}
              sx={{ width: { sm: 160 } }}
            />
          ) : (
            <TextField
              select
              label="Currency"
              value={currency}
              size="small"
              error={Boolean(currencyIssue)}
              helperText={currencyIssue || "The opportunity has no currency"}
              onChange={(e) => e.target.value !== currency && choose({ kind: "currency", value: e.target.value })}
              sx={{ width: { sm: 200 } }}
            >
              {(currencies.data ?? []).map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
          )}
          {bookLocked || !opportunity ? (
            <TextField
              label="Price book"
              value={bookId ? bookName : "—"}
              size="small"
              error={Boolean(bookIssue) && !problem}
              helperText={(!problem && bookIssue) || FROM_SALESFORCE}
              slotProps={locked}
              sx={{ flexGrow: 1 }}
            />
          ) : (
            <TextField
              select
              label="Price book"
              value={books.data?.some((b) => b.id === bookId) ? bookId : ""}
              size="small"
              disabled={!activeCurrency}
              error={Boolean(bookIssue)}
              helperText={bookIssue || (activeCurrency ? `Active books priced in ${activeCurrency}` : "Choose the currency first")}
              onChange={(e) => {
                const b = books.data?.find((x) => x.id === e.target.value);
                if (b && b.id !== bookId) choose({ kind: "book", value: b.id, name: b.name ?? b.id });
              }}
              sx={{ flexGrow: 1 }}
            >
              {(books.data ?? []).map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.name ?? b.id}
                </MenuItem>
              ))}
            </TextField>
          )}
        </Stack>
        {problem ? (
          <Alert severity="error">
            <AlertTitle>Products can&apos;t be added</AlertTitle>
            {problem}
          </Alert>
        ) : books.error ? (
          <ErrorNotice error={books.error} onRetry={() => void books.refetch()} retrying={books.isFetching}>
            Couldn&apos;t load the price books.
          </ErrorNotice>
        ) : currencies.error ? (
          <ErrorNotice error={currencies.error} onRetry={() => void currencies.refetch()} retrying={currencies.isFetching}>
            Couldn&apos;t load the currencies.
          </ErrorNotice>
        ) : missing ? (
          <Alert severity="info">
            The opportunity has no {missing} in Salesforce, so choose {missing === "price book" ? "one" : "them"} here.
            Syncing to Salesforce sets {missing === "price book" ? "it" : "them"} on the opportunity.
          </Alert>
        ) : null}
      </Stack>
      {pending ? (
        <LifecycleDialog
          title={pending.kind === "currency" ? "Change the currency?" : "Change the price book?"}
          confirmLabel="Change and remove products"
          danger
          pending={false}
          error={null}
          onClose={() => setPending(null)}
          onConfirm={() => {
            apply(pending);
            setPending(null);
          }}
        >
          {`Prices come from the price book, in the quote's currency, so the ${lineCount === 1 ? "product" : `${lineCount} products`} on this quote ${lineCount === 1 ? "is" : "are"} removed. You add them again afterwards.`}
        </LifecycleDialog>
      ) : null}
    </SectionCard>
  );
}
