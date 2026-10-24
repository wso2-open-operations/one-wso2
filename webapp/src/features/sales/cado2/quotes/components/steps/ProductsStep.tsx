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

import { useMemo, useState, type JSX } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  DatePickers,
  Stack,
  TableCell,
  TableRow,
  Tooltip,
  Typography,
  IconButton,
} from "@wso2/oxygen-ui";
import {
  ChartColumnIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  CopyIcon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "@wso2/oxygen-ui-icons-react";
import SectionCard from "@features/sales/cado2/components/section-card/SectionCard";
import EmptyState from "@features/sales/cado2/components/empty-state/EmptyState";
import DealFiguresSection from "@features/sales/cado2/quotes/components/sheet/DealFiguresSection";
import ScheduleTable from "@features/sales/cado2/quotes/components/sheet/ScheduleTable";
import YearSections, { OrderTotalsFooter, type SectionYear } from "@features/sales/cado2/quotes/components/sheet/YearSections";
import { useCollapsedYears } from "@features/sales/cado2/quotes/components/sheet/useCollapsedYears";
import { hasYearlySchedule, orderForm, sheetFromForm } from "@features/sales/cado2/quotes/sheet/sheetModel";
import type { PricingPreview } from "@features/sales/cado2/quotes/api/quoteTypes";
import {
  addYear,
  childrenOf,
  cloneYear,
  contractYears,
  deleteYear,
  insertIndex,
  isPartnerLed,
  lastYearEndProblem,
  MAX_YEARS,
  parseDateString,
  setLastYearEnd,
  toDateString,
  type ContractYear,
  type DraftFormValues,
  type LineValue,
} from "@features/sales/cado2/quotes/form/draftForm";
import AddLineDialog from "@features/sales/cado2/quotes/components/AddLineDialog";
import TermCard from "@features/sales/cado2/quotes/components/TermCard";
import PartnerCommissionCard from "@features/sales/cado2/quotes/components/PartnerCommissionCard";
import PricingSetupCard from "@features/sales/cado2/quotes/components/PricingSetupCard";
import { useFieldIssue } from "@features/sales/cado2/quotes/components/fieldIssues";

const { DatePicker } = DatePickers;

interface ProductsStepProps {
  /** The latest live preview, if the quote could be priced. */
  readonly preview: PricingPreview | null;
}

function LineIssue({ index }: { index: number }) {
  const issues = [
    useFieldIssue(`lines[${index}].pricebookEntryId`),
    useFieldIssue(`lines[${index}].quantity`),
    useFieldIssue(`lines[${index}].discretionaryDiscountPercent`),
    useFieldIssue(`lines[${index}].yearNumber`),
    useFieldIssue(`lines[${index}].startDate`),
    useFieldIssue(`lines[${index}].endDate`),
    useFieldIssue(`lines[${index}]`),
  ].filter(Boolean);
  if (issues.length === 0) return null;
  return (
    <TableRow>
      <TableCell colSpan={8} sx={{ pt: 0, borderTop: 0 }}>
        <Typography variant="caption" color="error">
          {[...new Set(issues)].join(" · ")}
        </Typography>
      </TableCell>
    </TableRow>
  );
}

/**
 * Step ② Products & Pricing, laid out by year:
 *
 *   Price book → partner commission → Term (start date; where the years take it)
 *   Products                                          [Collapse all]
 *     ▾ Year 1  dates          3 products · USD …   [+ Product] [Clone] [Delete]
 *         Subscription / Support / Professional Services
 *     ▸ Year 2  dates (6 months)  …                  (the last year's end can be brought forward)
 *     [+ Add Year 3]
 *     Total order value · all 2 years              (the card's footer)
 *   Deal Figures → Yearly Schedule
 *
 * The AM adds the years; nothing is split automatically. Every year is 12
 * months except the last, which can be shorter. Any year can be deleted:
 * later ones move up. Clone year copies a year's recurring products into a
 * new year at the end. A new product goes after its year's other lines, so
 * line numbers run year by year.
 */
export default function ProductsStep({ preview }: ProductsStepProps): JSX.Element {
  const { control, getValues, setValue } = useFormContext<DraftFormValues>();
  const { fields, insert, update, remove, replace } = useFieldArray({
    control,
    name: "lines",
  });
  const values = useWatch({ control }) as DraftFormValues;
  const [editing, setEditing] = useState<{ open: boolean; index: number | null; year: number }>({
    open: false,
    index: null,
    year: 1,
  });
  const fold = useCollapsedYears();
  const linesIssue = useFieldIssue("lines");
  const yearsIssue = useFieldIssue("years");
  const lastEndIssue = useFieldIssue("lastYearEndDate");

  const currency = values.currencyIsoCode;
  // The opportunity's book must be usable; the card says what to fix otherwise.
  // Products can be added before the start date (D78); they are priced once it is chosen.
  const ready = Boolean(currency && values.defaultPricebookId);
  const years: SectionYear[] = values.startDate
    ? contractYears(values.startDate, values.yearCount, values.lastYearEndDate)
    : Array.from({ length: values.yearCount }, (_, i) => ({ number: i + 1, start: "", end: "" }));
  const fullLastEnd = contractYears(values.startDate, values.yearCount).at(-1)?.end ?? "";
  const lastProblem = lastYearEndProblem(values.startDate, values.yearCount, values.lastYearEndDate);
  // Why the amounts are blank.
  const amountsHint =
    preview || values.lines.length === 0
      ? null
      : !values.startDate
        ? "Amounts appear once the start date is chosen."
        : values.yearCount < 1
          ? "Amounts appear once Year 1 is added."
          : null;
  // The same lines, amounts and figures as the Review step's sheet.
  const sheet = useMemo(() => sheetFromForm(values, preview, null), [values, preview]);
  const total = orderForm(sheet.lines, sheet.partnerCommissionPercent);

  const onSave = (line: LineValue, children: LineValue[]) => {
    const lines = getValues("lines");
    if (editing.index === null) {
      // After its year's lines, its bundle right below it.
      const at = insertIndex(lines, line.yearNumber);
      if (children.length === 0) insert(at, line);
      else replace([...lines.slice(0, at), line, ...children, ...lines.slice(at)]);
    } else if (childrenOf(lines, line.key).length > 0) {
      // A parent's children keep its year and dates.
      replace(
        lines.map((l, i) =>
          i === editing.index
            ? line
            : l.parentKey === line.key
              ? { ...l, yearNumber: line.yearNumber, startDate: line.startDate, endDate: l.recurring ? line.endDate : "" }
              : l,
        ),
      );
    } else update(editing.index, line);
    setEditing({ open: false, index: null, year: 1 });
  };
  // Removing a bundle parent removes its children; a child leaves only with it.
  const removeLine = (i: number) => {
    const lines = getValues("lines");
    const key = lines[i].key;
    if (childrenOf(lines, key).length === 0) remove(i);
    else replace(lines.filter((l, k) => k !== i && l.parentKey !== key));
  };
  // Year changes rewrite the count, the last year's end and, for clone and
  // delete, the lines together.
  const setYears = (next: { yearCount: number; lastYearEndDate: string; lines?: LineValue[] }) => {
    setValue("yearCount", next.yearCount, { shouldDirty: true });
    setValue("lastYearEndDate", next.lastYearEndDate, { shouldDirty: true });
    if (next.lines) replace(next.lines);
  };
  const changeLastEnd = (end: string) => {
    const next = setLastYearEnd(getValues(), end);
    setValue("lastYearEndDate", next.lastYearEndDate, { shouldDirty: true });
    if (next.lines !== getValues("lines")) replace(next.lines);
  };

  const addButton = (n: number, label = "Product") => (
    <Button
      size="small"
      startIcon={<PlusIcon size={14} />}
      disabled={!ready}
      aria-label={`Add product to Year ${n}`}
      onClick={() => setEditing({ open: true, index: null, year: n })}
    >
      {label}
    </Button>
  );

  const yearActions = (n: number) => {
    const ofYear = values.lines.filter((l) => l.yearNumber === n);
    const recurring = ofYear.filter((l) => l.recurring).length;
    return (
      <>
        {addButton(n)}
        <Tooltip
          title={
            recurring === 0
              ? "No recurring products to copy"
              : values.yearCount >= MAX_YEARS
                ? `A quote has at most ${MAX_YEARS} years`
                : `Copy Year ${n}'s ${recurring} recurring product${recurring === 1 ? "" : "s"} into a new Year ${values.yearCount + 1}`
          }
        >
          <span>
            <Button
              size="small"
              startIcon={<CopyIcon size={14} />}
              disabled={recurring === 0 || values.yearCount >= MAX_YEARS || !values.startDate}
              onClick={() => setYears(cloneYear(getValues(), n))}
            >
              Clone
            </Button>
          </span>
        </Tooltip>
        <Tooltip
          title={`Delete Year ${n}${ofYear.length ? ` and its ${ofYear.length} product${ofYear.length === 1 ? "" : "s"}` : ""}${n < values.yearCount ? "; later years move up" : ""}`}
        >
          <IconButton
            size="small"
            aria-label={`Delete Year ${n}`}
            onClick={() => {
              setYears(deleteYear(getValues(), n));
              fold.reset();
            }}
          >
            <Trash2Icon size={16} />
          </IconButton>
        </Tooltip>
      </>
    );
  };

  // Only the last year may be shorter than 12 months.
  const yearTop = (n: number) =>
    n === values.yearCount && values.startDate ? (
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
        <DatePicker
          label={`Year ${n} ends`}
          value={parseDateString(years[n - 1]?.end ?? "")}
          minDate={parseDateString(years[n - 1]?.start ?? "") ?? undefined}
          maxDate={parseDateString(fullLastEnd) ?? undefined}
          onChange={(d: Date | null) => d && !Number.isNaN(d.getTime()) && changeLastEnd(toDateString(d))}
          slotProps={{
            textField: {
              size: "small",
              error: Boolean(lastProblem || lastEndIssue),
              helperText: lastProblem || lastEndIssue || "The last year can be shorter than 12 months",
              sx: { width: 220 },
            },
          }}
        />
        {values.lastYearEndDate ? (
          <Button size="small" onClick={() => changeLastEnd(fullLastEnd)}>
            Make it a full year
          </Button>
        ) : null}
      </Stack>
    ) : null;

  // Lines whose year was removed or never set (none normally): listed so they can be fixed.
  const orphans = values.lines.flatMap((l, i) => (l.yearNumber >= 1 && l.yearNumber <= values.yearCount ? [] : [i]));
  const editingYear = years.find((y) => y.number === editing.year);
  const anyFolded = fold.collapsed.size > 0;

  return (
    <Stack spacing={2.5}>
      {linesIssue ? <Alert severity="error">{linesIssue}</Alert> : null}

      {/* The opportunity's currency and price book, locked. */}
      <PricingSetupCard />

      {values.notBroughtIn?.length ? (
        <Alert severity="info" variant="outlined">
          <AlertTitle>Not brought in from Salesforce ({values.notBroughtIn.length})</AlertTitle>
          {values.notBroughtIn.map((n) => `${n.productName}: ${n.reason}`).join(" · ")}
        </Alert>
      ) : null}

      {/* Partner-led: the commission, right above the products whose totals it
          changes (D91); shown before any product too. */}
      {isPartnerLed(values) ? (
        <PartnerCommissionCard commission={total.commission} total={total.total} currency={currency} />
      ) : null}

      {/* When it starts and where the years take it, right above the products
          it lays out (2026-10-23). */}
      <TermCard />

      <SectionCard
        title="Products"
        icon={<PackageIcon size={18} />}
        aside={
          years.length > 1 ? (
            <Button
              size="small"
              startIcon={anyFolded ? <ChevronsUpDownIcon size={14} /> : <ChevronsDownUpIcon size={14} />}
              onClick={() => fold.toggleAll(years.map((y) => y.number))}
            >
              {anyFolded ? "Expand all" : "Collapse all"}
            </Button>
          ) : undefined
        }
      >
        {yearsIssue ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {yearsIssue}
          </Alert>
        ) : null}
        {orphans.length ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {orphans.length === 1 ? "1 product has" : `${orphans.length} products have`} no year:{" "}
            {orphans.map((i) => values.lines[i].productName).join(", ")}. Remove {orphans.length === 1 ? "it" : "them"} and
            add {orphans.length === 1 ? "it" : "them"} to a year.
            <Box sx={{ mt: 1 }}>
              {orphans.map((i) => (
                <Button key={fields[i]?.id ?? i} size="small" color="inherit" onClick={() => remove(i)}>
                  Remove {values.lines[i].productName}
                </Button>
              ))}
            </Box>
          </Alert>
        ) : null}

        {values.yearCount === 0 ? (
          <EmptyState
            compact
            icon={<PackageIcon size={20} />}
            title="No years yet"
            body="Add Year 1 to start adding products. Every year is 12 months; the last can be shorter."
            action={
              <Button variant="contained" startIcon={<PlusIcon size={16} />} onClick={() => setYears(addYear(getValues()))}>
                Add Year 1
              </Button>
            }
          />
        ) : (
          <>
            <YearSections
              years={years}
              lines={sheet.lines}
              currency={currency}
              commissionPercent={sheet.partnerCommissionPercent}
              collapsed={fold.collapsed}
              onToggle={fold.toggle}
              yearActions={yearActions}
              yearTop={yearTop}
              empty={(n) => (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                  <Typography variant="body2" color="text.secondary">
                    {`No products in Year ${n}. Add products from ${values.defaultPricebookName ? `the ${values.defaultPricebookName} price book` : "the quote's price book"}, or clone an earlier year.`}
                  </Typography>
                  {addButton(n, "Add product")}
                </Stack>
              )}
              lineActions={(i) => (
                <>
                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      aria-label={`Edit line ${i + 1}`}
                      onClick={() => setEditing({ open: true, index: i, year: values.lines[i].yearNumber })}
                    >
                      <PencilIcon size={16} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip
                    title={
                      values.lines[i].parentKey
                        ? `Comes with ${sheet.lines[i]?.parentName ?? "its bundle's product"}: remove that to remove it`
                        : childrenOf(values.lines, values.lines[i].key).length
                          ? "Remove, with the products that come with it"
                          : "Remove"
                    }
                  >
                    <span>
                      <IconButton
                        size="small"
                        aria-label={`Remove line ${i + 1}`}
                        disabled={Boolean(values.lines[i].parentKey)}
                        onClick={() => removeLine(i)}
                      >
                        <Trash2Icon size={16} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </>
              )}
              below={(i) => <LineIssue key={fields[i]?.id} index={i} />}
              flagUncategorised
            />
            {values.yearCount < MAX_YEARS ? (
              <Button
                variant="outlined"
                size="small"
                startIcon={<PlusIcon size={14} />}
                onClick={() => setYears(addYear(getValues()))}
                sx={{ my: 2 }}
              >
                Add Year {values.yearCount + 1}
              </Button>
            ) : null}
            {amountsHint ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {amountsHint}
              </Typography>
            ) : null}
            <OrderTotalsFooter
              lines={sheet.lines}
              currency={currency}
              commissionPercent={sheet.partnerCommissionPercent}
              yearCount={values.yearCount}
            />
          </>
        )}
      </SectionCard>

      {fields.length > 0 ? <DealFiguresSection sheet={sheet} /> : null}

      {hasYearlySchedule(sheet) ? (
        <SectionCard title="Yearly Schedule" icon={<ChartColumnIcon size={18} />}>
          <ScheduleTable years={sheet.years} lines={sheet.lines} netOfCommission={sheet.partnerCommissionPercent !== null} />
        </SectionCard>
      ) : null}

      {editing.open && values.defaultPricebookId ? (
        <AddLineDialog
          key={editing.index ?? `new-${editing.year}`}
          open
          line={editing.index === null ? null : getValues(`lines.${editing.index}`)}
          currency={currency}
          pricebook={{ id: values.defaultPricebookId, name: values.defaultPricebookName }}
          year={editingYear && editingYear.start ? (editingYear as ContractYear) : null}
          parentName={editing.index === null ? null : sheet.lines[editing.index]?.parentName}
          onSave={onSave}
          onClose={() => setEditing({ open: false, index: null, year: 1 })}
        />
      ) : null}
    </Stack>
  );
}
