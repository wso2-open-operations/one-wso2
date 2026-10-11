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

import { useMemo, useState } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Avatar, Card, Chip, ComplexSelect, Divider, Grid, Skeleton, Stack, Tooltip, Typography } from "@wso2/oxygen-ui";
import { ChevronDownIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useLeaveEmployees } from "@features/leave/api/useLeaveData";
import { useParRating } from "../api/useParData";
import { useAllClosedParCycles, useParEmployeeReviews, useParLegacyHistory } from "../api/useLeadHistory";
import { buildMergedCycleOptions } from "../util/parEmployeeHistory";
import { decodeParComment } from "../util/parComment";
import { ParCommentView } from "./ParContent";
import ParEmptyState from "./ParEmptyState";
import ParHistoryReviewSection from "./ParHistoryReviewSection";
import ParLegacyRecordDetail from "./ParLegacyRecordDetail";
import ParStatusChip from "./ParStatusChip";
import type { ParLegacyHistoryByEmail } from "../api/useLeadHistory";

type CycleSelection = { kind: "none" } | { kind: "real"; parCycleId: number } | { kind: "legacy"; cycleName: string };

function InfoItem({ label, value, secondaryValue }: { label: string; value: string; secondaryValue: string }) {
  return (
    <Grid size="grow">
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, mb: 0.25 }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {value || "—"}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
        {secondaryValue || "—"}
      </Typography>
    </Grid>
  );
}

// par-app's EmployeeHistoryCard.tsx: the same real+legacy cycle history
// ParLeadEmployeeHistoryTab.tsx shows, for one fixed employee (no cycle
// picker). Kept separate from ParLeadHistoryModal.tsx's Dialog shell so the
// content itself stays independent of how it's presented.
export default function ParEmployeeHistoryView({
  employeeEmail,
  employeeName,
}: {
  employeeEmail: string;
  employeeName: string;
}) {
  const realCycles = useAllClosedParCycles();
  const legacyHistory = useParLegacyHistory(employeeEmail);
  const thumbnails = useLeaveEmployees();
  const thumbnailByEmail = useMemo(
    () => new Map(thumbnails.data?.map((e) => [e.workEmail, e.employeeThumbnail]) ?? []),
    [thumbnails.data],
  );

  const [cycleSelection, setCycleSelection] = useState<CycleSelection>({ kind: "none" });

  const isRealCycle = cycleSelection.kind === "real";
  const isLegacyCycle = cycleSelection.kind === "legacy";
  const realCycleId = isRealCycle ? cycleSelection.parCycleId : undefined;

  const rating = useParRating(realCycleId, employeeEmail, isRealCycle);
  const reviews = useParEmployeeReviews(realCycleId, isRealCycle ? employeeEmail : undefined);

  const legacyByEmail: ParLegacyHistoryByEmail = { [employeeEmail]: legacyHistory.data };
  const cycleOptions = buildMergedCycleOptions(realCycles.data ?? [], legacyByEmail);
  const cyclePickerValue = isLegacyCycle ? `legacy-${cycleSelection.cycleName}` : isRealCycle ? String(cycleSelection.parCycleId) : "none";

  const handleCycleChange = (value: string) => {
    if (value === "none") {
      setCycleSelection({ kind: "none" });
    } else if (value.startsWith("legacy-")) {
      setCycleSelection({ kind: "legacy", cycleName: value.slice("legacy-".length) });
    } else {
      setCycleSelection({ kind: "real", parCycleId: Number(value) });
    }
  };

  const legacyRecords = legacyHistory.data ?? [];
  const selectedLegacyRecord = isLegacyCycle
    ? legacyRecords.find((record) => record.cycleName === cycleSelection.cycleName)
    : undefined;

  // "No record" wording stays deliberately vague: the backend can't tell "no
  // rating exists for this cycle" apart from a genuine fetch error here.
  // Scoped to `rating` alone — a failed or still-loading `reviews` fetch is
  // its own, separate state handled inside the 360° feedback section below,
  // not a reason to hide the PAR record itself.
  const realCycleNotAvailable = isRealCycle && (rating.isError || (rating.isSuccess && !rating.data));
  const legacyCycleNotAvailable = isLegacyCycle && legacyHistory.isSuccess && !selectedLegacyRecord;

  const showRealDetails = isRealCycle && rating.isSuccess && Boolean(rating.data);
  const showLegacyDetails = isLegacyCycle && Boolean(selectedLegacyRecord);
  const isLoadingSelection = (isRealCycle && rating.isLoading) || (isLegacyCycle && legacyHistory.isLoading);

  return (
    <Stack spacing={2}>
      <ComplexSelect
        sx={{ minWidth: 280 }}
        disabled={realCycles.isLoading || legacyHistory.isLoading || cycleOptions.length === 0}
        value={cyclePickerValue}
        onChange={(e) => handleCycleChange(e.target.value as string)}
      >
        <ComplexSelect.MenuItem value="none">
          {cycleOptions.length === 0 ? "No previous PAR cycles found" : "Please select a PAR cycle"}
        </ComplexSelect.MenuItem>
        {cycleOptions.map((option) => (
          <ComplexSelect.MenuItem
            key={option.key}
            value={option.isLegacy ? `legacy-${option.cycleName}` : String(option.parCycleId)}
          >
            {option.label}
          </ComplexSelect.MenuItem>
        ))}
      </ComplexSelect>

      {realCycles.isError && (
        <ErrorNotice error={realCycles.error} onRetry={() => realCycles.refetch()} retrying={realCycles.isFetching}>
          Couldn't load past PAR cycles.
        </ErrorNotice>
      )}

      {isLegacyCycle && legacyHistory.isError && (
        <ErrorNotice error={legacyHistory.error} onRetry={() => legacyHistory.refetch()} retrying={legacyHistory.isFetching}>
          Couldn't load this employee's legacy PAR history.
        </ErrorNotice>
      )}

      {isLoadingSelection && <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5 }} />}

      {legacyCycleNotAvailable && (
        <ParEmptyState text="Not Available -- this employee has no PAR record for the selected cycle." />
      )}
      {realCycleNotAvailable && (
        <ParEmptyState text="No PAR record found for the selected cycle, or it could not be loaded right now. Try again, or check back later if this seems wrong." />
      )}

      {showLegacyDetails && selectedLegacyRecord && (
        <ParLegacyRecordDetail
          record={selectedLegacyRecord}
          employeeEmail={employeeEmail}
          employeeName={employeeName}
          thumbnail={thumbnailByEmail.get(employeeEmail)}
        />
      )}

      {showRealDetails && rating.data && (
        <Stack spacing={2}>
          <Card variant="outlined" sx={{ px: 2, py: 1.25 }}>
            <Grid container spacing={1.5} alignItems="center">
              <Grid size="auto">
                <Avatar
                  variant="rounded"
                  src={thumbnailByEmail.get(employeeEmail)}
                  alt="Employee Thumbnail"
                  sx={{ width: "3rem", height: "3rem", borderRadius: 3 }}
                />
              </Grid>
              <Grid size="grow">
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {rating.data.parSpecialRating && rating.data.parSpecialRating !== "NOT_ASSIGNED" && (
                    <ParStatusChip content={rating.data.parSpecialRating} />
                  )}
                  {rating.data.parRating && rating.data.parRating !== "NOT_ASSIGNED" && (
                    <ParStatusChip content={rating.data.parRating} />
                  )}
                </Stack>
                {rating.data.parRatingSharedBy && (
                  <Chip
                    size="small"
                    variant="outlined"
                    sx={{ mt: 1 }}
                    label={`PAR shared by: ${rating.data.parRatingSharedBy}`}
                  />
                )}
                {rating.data.parRatingUpdatedBy === "SYSTEM" && (
                  <Tooltip title="Automatically assigned by the system because the PAR deadline was missed">
                    <Chip
                      size="small"
                      color="warning"
                      variant="outlined"
                      sx={{ mt: 1, ml: rating.data.parRatingSharedBy ? 1 : 0 }}
                      label="Auto-assigned (deadline missed)"
                    />
                  </Tooltip>
                )}
              </Grid>
              <InfoItem label="Employee" value={employeeName} secondaryValue={employeeEmail} />
              <InfoItem label="Lead" value={rating.data.parLeadEmail ?? ""} secondaryValue={rating.data.parLeadEmail ?? ""} />
              <InfoItem label="Team" value={rating.data.parTeam ?? ""} secondaryValue={rating.data.parDepartment ?? ""} />
            </Grid>
          </Card>

          <Accordion
            variant="outlined"
            disabled={!rating.data.parEmployeeComment?.trim()}
            defaultExpanded={Boolean(rating.data.parEmployeeComment?.trim())}
          >
            <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>Employee PAR</AccordionSummary>
            <AccordionDetails>
              <Divider sx={{ my: 1 }} />
              <ParCommentView html={decodeParComment(rating.data.parEmployeeComment)} />
            </AccordionDetails>
          </Accordion>
          <Accordion
            variant="outlined"
            disabled={!rating.data.parLeadComment?.trim()}
            defaultExpanded={Boolean(rating.data.parLeadComment?.trim())}
          >
            <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>Lead's Feedback</AccordionSummary>
            <AccordionDetails>
              <Divider sx={{ my: 1 }} />
              <ParCommentView html={decodeParComment(rating.data.parLeadComment)} />
            </AccordionDetails>
          </Accordion>

          {reviews.isLoading ? (
            <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1.5 }} />
          ) : reviews.isError ? (
            <ErrorNotice error={reviews.error} onRetry={() => reviews.refetch()} retrying={reviews.isFetching}>
              Couldn't load this employee's 360° feedback.
            </ErrorNotice>
          ) : (
            <ParHistoryReviewSection reviews={reviews.data ?? []} />
          )}
        </Stack>
      )}
    </Stack>
  );
}
