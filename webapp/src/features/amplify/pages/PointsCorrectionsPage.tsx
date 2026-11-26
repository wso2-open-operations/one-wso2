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

import { useState, type ReactNode } from "react";
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Link,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  alpha,
} from "@wso2/oxygen-ui";
import { SearchIcon } from "@wso2/oxygen-ui-icons-react";
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
import AdjustPointsPanel from "../components/AdjustPointsPanel";
import AmplifyShell from "../components/AmplifyShell";
import { PlainStatus, SoftPill } from "../components/AmplifyTone";
import ReversePointsPanel from "../components/ReversePointsPanel";
import { activityText, isCorrection } from "../util/activity";
import { initialsOf, num, shortDate } from "../util/dashboardFormat";
import { canReverse, isReversed, signedPoints } from "../util/points";

/** How long the search box waits after the last keystroke before it asks. */
export const PEOPLE_SEARCH_DEBOUNCE_MS = 300;

/** Activities shown before "Show all". */
export const HISTORY_PREVIEW_SIZE = 5;

/** Activities per page once "Show all" is on. */
export const HISTORY_PAGE_SIZE = 25;

/** Shown in place of the correction buttons on the caller's own points. */
export const OWN_POINTS_NOTE = "These are your own points. Another PO team member can correct them.";

/** The line under the page. */
export const POINT_VALUES_NOTE = "Point values are changed in Amplify Admin.";

function matchLabel(p: AmplifyPersonMatch): string {
  return p.displayName?.trim() || p.email;
}

/**
 * Points & corrections (CAN_ADJUST_POINTS, checked by AmplifyPointsRoute): find a person, see their points and every
 * activity, and reverse one or add or remove points in a panel beside it. Every correction carries a reason the
 * person sees.
 */
export default function PointsCorrectionsPage() {
  const [selected, setSelected] = useState<AmplifyPersonMatch | null>(null);
  return (
    <AmplifyShell
      title="Points & corrections"
      subtitle={
        "Find a person, see every point they've earned, and fix what's wrong. " +
        "Every change needs a reason, shows in their history, and is audited."
      }
    >
      <PersonSearch value={selected} onChange={setSelected} />
      {selected && <PersonPoints key={selected.employeeId} person={selected} />}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        {POINT_VALUES_NOTE}
      </Typography>
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
      sx={{ maxWidth: { md: "70%" }, mb: 3 }}
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
          placeholder="Find a person by name or email"
          inputProps={{ ...params.inputProps, "aria-label": "Find a person" }}
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <>
                <SearchIcon size={18} style={{ marginLeft: 6, marginRight: 4 }} aria-hidden="true" />
                {params.InputProps.startAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}

/** One of the person's numbers under their name. */
function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box component="section" aria-label={label}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{value}</Typography>
    </Box>
  );
}

/** A row's Coins status as drawn: "Not yet converted", a "Converted" pill, or "Reversed". */
function RowStatus({ entry }: { entry: LedgerEntry }) {
  if (isReversed(entry)) return <PlainStatus muted>Reversed</PlainStatus>;
  if (entry.settlement === "PAID") return <SoftPill>Converted</SoftPill>;
  if (entry.settlement === "ACTION_REQUIRED") return <SoftPill>Waiting for the PO team</SoftPill>;
  if (entry.settlement === "HELD") return <PlainStatus>Not yet converted</PlainStatus>;
  return null;
}

/** What a row was for: the post's title, or a plain label when the post has none. */
function postOf(e: LedgerEntry): string {
  return e.campaignTitle?.trim() || (e.campaignId ? "A Choreo Labs post" : "—");
}

/**
 * One person: their name, team and location, all-time points and points toward the next Coins, and their activity
 * (five rows, or every row a page at a time after Show all), with Reverse where it applies. A correction opens in a
 * panel on the right.
 */
function PersonPoints({ person }: { person: AmplifyPersonMatch }) {
  const [page, setPage] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const size = showAll ? HISTORY_PAGE_SIZE : HISTORY_PREVIEW_SIZE;
  const history = usePointsHistoryPage(person.employeeId, showAll ? page : 0, size);
  const me = useAmplifyMe();
  const lookup = usePersonLookup();
  const [reversing, setReversing] = useState<LedgerEntry | null>(null);
  const [adjusting, setAdjusting] = useState(false);

  const who = lookup({ employeeId: person.employeeId, email: person.email, displayName: person.displayName });
  const known = who.name !== UNKNOWN_EMPLOYEE;
  const name = known ? who.name : person.email;
  const firstName = known ? (who.name.split(/\s+/)[0] ?? null) : null;
  const where = [who.team, who.location].filter(Boolean).join(" · ");
  const isSelf = me.data?.employee.employeeId === person.employeeId;
  const items = history.data?.items ?? [];
  const total = history.data?.totalPoints ?? null;
  const held = history.data?.heldPoints ?? null;
  const rowCount = history.data?.total ?? 0;
  const panelOpen = reversing !== null || adjusting;

  const startReverse = (e: LedgerEntry) => {
    setAdjusting(false);
    setReversing(e);
  };
  const startAdjust = () => {
    setReversing(null);
    setAdjusting(true);
  };

  return (
    <Box
      sx={{
        display: "grid",
        gap: 3,
        alignItems: "start",
        gridTemplateColumns: { xs: "1fr", lg: panelOpen ? "minmax(0, 1fr) 380px" : "minmax(0, 1fr)" },
      }}
    >
      <Box
        component="section"
        aria-label={name}
        sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, minWidth: 0, overflow: "hidden" }}
      >
        <Box sx={{ p: 2.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
            <Avatar src={who.photoUrl ?? undefined} alt="" sx={{ width: 52, height: 52, fontSize: 18 }}>
              {initialsOf(name)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography component="h2" sx={{ fontWeight: 700, fontSize: 18, overflowWrap: "anywhere" }}>
                {name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                {where || person.email}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <Stat
              label="All-time points"
              value={history.isPending ? <Skeleton width={80} /> : total === null ? "—" : num(total)}
            />
            <Stat
              label="Toward next Coins"
              value={history.isPending ? <Skeleton width={60} /> : held === null ? "—" : num(held)}
            />
          </Box>
          {isSelf && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {OWN_POINTS_NOTE}
            </Alert>
          )}
        </Box>

        {history.isPending ? (
          <Skeleton variant="rounded" height={160} sx={{ mx: 2.5, mb: 2.5 }} />
        ) : history.isError ? (
          <Box sx={{ px: 2.5, pb: 2.5 }}>
            <ErrorNotice error={history.error} onRetry={() => void history.refetch()} retrying={history.isFetching}>
              Couldn&apos;t load this person&apos;s points.
            </ErrorNotice>
          </Box>
        ) : items.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, pb: 2.5 }}>
            No points activity yet.
          </Typography>
        ) : (
          <>
            <Box sx={{ overflowX: "auto" }}>
              <Table aria-label="Every activity">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Activity</TableCell>
                    <TableCell>Post</TableCell>
                    <TableCell align="right">Points</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((e) => {
                    const active = reversing?.reference === e.reference;
                    const what = activityText(e, { forPerson: true });
                    const reason = isCorrection(e) ? e.reason?.trim() : undefined;
                    return (
                      <TableRow
                        key={e.reference}
                        sx={active ? { bgcolor: (t) => alpha(t.palette.primary.main, 0.08) } : undefined}
                      >
                        <TableCell sx={{ whiteSpace: "nowrap", color: "text.secondary" }}>{shortDate(e.createdAt)}</TableCell>
                        <TableCell>
                          {what}
                          {reason && (
                            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                              {reason}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ overflowWrap: "anywhere" }}>{postOf(e)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>
                          {signedPoints(e.points)}
                        </TableCell>
                        <TableCell>
                          <RowStatus entry={e} />
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                          {!isSelf && canReverse(e) && (
                            <Button
                              size="small"
                              variant={active ? "contained" : "outlined"}
                              onClick={() => startReverse(e)}
                              aria-label={`Reverse ${what} on ${shortDate(e.createdAt)}`}
                            >
                              {active ? "Reversing" : "Reverse…"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
            {showAll && rowCount > HISTORY_PAGE_SIZE && (
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

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            flexWrap: "wrap",
            px: 2.5,
            py: 2,
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {!history.isPending && !history.isError && items.length > 0 && !showAll && (
              <>
                Showing {num(items.length)} of {num(rowCount)}
                {rowCount > items.length && (
                  <>
                    {" · "}
                    <Link component="button" type="button" onClick={() => setShowAll(true)} sx={{ verticalAlign: "baseline" }}>
                      Show all
                    </Link>
                  </>
                )}
              </>
            )}
          </Typography>
          {!isSelf && (
            <Button variant="outlined" onClick={startAdjust} disabled={history.isPending}>
              Add or remove points…
            </Button>
          )}
        </Box>
      </Box>

      {reversing && (
        <ReversePointsPanel
          key={reversing.reference}
          entry={reversing}
          personName={name}
          firstName={firstName}
          total={total}
          onClose={() => setReversing(null)}
        />
      )}
      {adjusting && (
        <AdjustPointsPanel
          employeeId={person.employeeId}
          personName={name}
          firstName={firstName}
          total={total}
          onClose={() => setAdjusting(false)}
        />
      )}
    </Box>
  );
}
