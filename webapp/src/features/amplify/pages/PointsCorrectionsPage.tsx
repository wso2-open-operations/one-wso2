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

import { useState } from "react";
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon, SearchIcon, Undo2Icon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useDebouncedValue } from "@hooks/useDebouncedValue";
import type { AmplifyPersonMatch, LedgerEntry } from "../api/amplifyTypes";
import {
  PEOPLE_SEARCH_MIN_LENGTH,
  useAmplifyMe,
  usePoPeopleSearch,
  usePointsHistoryPage,
} from "../api/useAmplifyData";
import { UNKNOWN_EMPLOYEE, usePersonLookup } from "../api/usePersonLookup";
import AdjustPointsDialog from "../components/AdjustPointsDialog";
import AmplifyShell, { AmplifyPanel } from "../components/AmplifyShell";
import { REASON_SHOWN_NOTE } from "../components/CorrectionParts";
import { StatCard, StateChip } from "../components/DashboardParts";
import ReversePointsDialog from "../components/ReversePointsDialog";
import { fullDate, initialsOf, num } from "../util/dashboardFormat";
import { canReverse, isReversed, ledgerActionLabel, signedPoints } from "../util/points";

/** How long the search box waits after the last keystroke before it asks. */
export const PEOPLE_SEARCH_DEBOUNCE_MS = 300;

/** Activities per page in a person's history. */
export const HISTORY_PAGE_SIZE = 25;

/** Shown in place of the correction buttons on the caller's own points. */
export const OWN_POINTS_NOTE = "These are your own points. Another PO team member can correct them.";

function matchLabel(p: AmplifyPersonMatch): string {
  return p.displayName?.trim() || p.email;
}

/**
 * Points & corrections (CAN_ADJUST_POINTS, checked by AmplifyPointsRoute): find a person, see their all-time points
 * and every activity, reverse one, or add or remove points. Every correction carries a reason the person sees.
 */
export default function PointsCorrectionsPage() {
  const [selected, setSelected] = useState<AmplifyPersonMatch | null>(null);
  return (
    <AmplifyShell
      title="Points & corrections"
      subtitle={
        "Find a person to see their Amplify points and every activity. " +
        "Reverse an activity or add a correction, with a reason."
      }
    >
      <PersonSearch value={selected} onChange={setSelected} />
      {selected && <PersonPoints key={selected.employeeId} person={selected} />}
    </AmplifyShell>
  );
}

/** A search box over people who have used Amplify, by name or email. */
function PersonSearch({
  value,
  onChange,
}: {
  value: AmplifyPersonMatch | null;
  onChange: (p: AmplifyPersonMatch | null) => void;
}) {
  const [term, setTerm] = useState("");
  const search = usePoPeopleSearch(useDebouncedValue(term, PEOPLE_SEARCH_DEBOUNCE_MS));
  const tooShort = term.trim().length < PEOPLE_SEARCH_MIN_LENGTH;
  return (
    <Autocomplete
      sx={{ maxWidth: 520, mb: 3 }}
      options={tooShort ? [] : (search.data ?? [])}
      value={value}
      onChange={(_, p) => onChange(p)}
      onInputChange={(_, v) => setTerm(v)}
      filterOptions={(x) => x}
      getOptionLabel={matchLabel}
      isOptionEqualToValue={(a, b) => a.employeeId === b.employeeId}
      loading={!tooShort && search.isFetching}
      noOptionsText={
        tooShort
          ? `Type at least ${PEOPLE_SEARCH_MIN_LENGTH} letters of a name or email`
          : search.isError
            ? "Couldn't search. Try again."
            : "No one found"
      }
      renderOption={({ key, ...props }, p) => (
        <li key={key} {...props}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {matchLabel(p)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {p.email}
            </Typography>
          </Box>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Find a person"
          placeholder="Name or email"
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <>
                <SearchIcon size={16} style={{ marginLeft: 4, marginRight: 4 }} aria-hidden="true" />
                {params.InputProps.startAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}

/** What a row was for: the PO team's reason, else the post's title. */
function detailOf(e: LedgerEntry): string {
  return e.reason?.trim() || e.campaignTitle?.trim() || (e.campaignId ? "A Choreo Labs post" : "—");
}

/**
 * One person: all-time points, the correction button, and their activity a page at a time, with Reverse where it
 * applies.
 */
function PersonPoints({ person }: { person: AmplifyPersonMatch }) {
  const [page, setPage] = useState(0);
  const history = usePointsHistoryPage(person.employeeId, page, HISTORY_PAGE_SIZE);
  const me = useAmplifyMe();
  const lookup = usePersonLookup();
  const [reversing, setReversing] = useState<LedgerEntry | null>(null);
  const [adjusting, setAdjusting] = useState(false);

  const who = lookup({ employeeId: person.employeeId, email: person.email, displayName: person.displayName });
  const name = who.name !== UNKNOWN_EMPLOYEE ? who.name : person.email;
  const isSelf = me.data?.employee.employeeId === person.employeeId;
  const items = history.data?.items ?? [];
  const total = history.data?.totalPoints ?? null;
  const rowCount = history.data?.total ?? 0;

  return (
    <>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "stretch", mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: "1 1 280px", minWidth: 0 }}>
          <Avatar src={who.photoUrl ?? undefined} alt="" sx={{ width: 48, height: 48, fontSize: 17 }}>
            {initialsOf(name)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h2" sx={{ fontWeight: 700, fontSize: 16 }}>
              {name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
              {person.email}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ flex: "0 1 260px" }}>
          <StatCard
            label="All-time points"
            value={history.isPending ? <Skeleton width={80} /> : total === null ? "—" : num(total)}
          />
        </Box>
      </Box>

      {isSelf ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          {OWN_POINTS_NOTE}
        </Alert>
      ) : (
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", mb: 2 }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<PlusIcon size={14} />}
            onClick={() => setAdjusting(true)}
            disabled={history.isPending}
          >
            Add or remove points
          </Button>
          <Typography variant="body2" color="text.secondary">
            {REASON_SHOWN_NOTE}
          </Typography>
        </Box>
      )}

      <AmplifyPanel title="Every activity">
        {history.isPending ? (
          <Skeleton variant="rounded" height={160} />
        ) : history.isError ? (
          <ErrorNotice error={history.error} onRetry={() => void history.refetch()} retrying={history.isFetching}>
            Couldn&apos;t load this person&apos;s points.
          </ErrorNotice>
        ) : items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No points activity yet.
          </Typography>
        ) : (
          <>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small" aria-label="Every activity">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Campaign or reason</TableCell>
                    <TableCell align="right">Points</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((e) => (
                    <TableRow key={e.reference}>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{fullDate(e.createdAt)}</TableCell>
                      <TableCell>{ledgerActionLabel(e)}</TableCell>
                      <TableCell sx={{ overflowWrap: "anywhere" }}>{detailOf(e)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                        {signedPoints(e.points)}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        {isReversed(e) ? (
                          <StateChip label="Reversed" />
                        ) : (
                          !isSelf &&
                          canReverse(e) && (
                            <Button
                              size="small"
                              startIcon={<Undo2Icon size={14} />}
                              onClick={() => setReversing(e)}
                              aria-label={`Reverse ${ledgerActionLabel(e)} on ${fullDate(e.createdAt)}`}
                            >
                              Reverse
                            </Button>
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            {rowCount > HISTORY_PAGE_SIZE && (
              <TablePagination
                component="div"
                count={rowCount}
                page={page}
                rowsPerPage={HISTORY_PAGE_SIZE}
                rowsPerPageOptions={[HISTORY_PAGE_SIZE]}
                onPageChange={(_, p) => setPage(p)}
              />
            )}
          </>
        )}
      </AmplifyPanel>

      {reversing && (
        <ReversePointsDialog entry={reversing} personName={name} total={total} onClose={() => setReversing(null)} />
      )}
      {adjusting && (
        <AdjustPointsDialog
          employeeId={person.employeeId}
          personName={name}
          total={total}
          onClose={() => setAdjusting(false)}
        />
      )}
    </>
  );
}
