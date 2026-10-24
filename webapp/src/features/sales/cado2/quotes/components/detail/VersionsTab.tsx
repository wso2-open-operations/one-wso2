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
import { Link as RouterLink } from "react-router";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import type { QuoteView } from "@features/sales/cado2/quotes/api/quoteTypes";
import { useQuoteVersion } from "@features/sales/cado2/quotes/api/useQuoteApi";
import { STATUS_COLOR, STATUS_LABEL, compareVersions, type CompareRow } from "@features/sales/cado2/quotes/lifecycle/lifecycle";
import { formatDate } from "@features/sales/cado2/quotes/form/draftForm";
import { formatMoney } from "@features/sales/cado2/utils/money";
import { cado2Paths } from "@features/sales/cado2/cado2Paths";
import StatusChip from "@features/sales/cado2/components/status-chip/StatusChip";
import { visuallyHidden } from "@features/sales/cado2/utils/visuallyHidden";

const CHANGE_LABEL = { added: "Added", removed: "Removed", changed: "Changed", same: "" };

/** Versions & Compare tab. */
export default function VersionsTab({ quote, currency }: { quote: QuoteView; currency: string }): JSX.Element {
  const versions = quote.versions;
  // Only the owner acts on a quote; a draft is always the latest version, and
  // the owner can then close it, so CLOSE doubles as "may edit the draft".
  const canEdit = quote.actions.includes("CLOSE");
  const latestNumber = versions.at(-1)?.versionNumber;
  return (
    <Stack spacing={3}>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label="Versions">
          <TableHead>
            <TableRow>
              <TableCell>Version</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Submitted</TableCell>
              <TableCell align="right">TCV</TableCell>
              <TableCell>Last changed</TableCell>
              <TableCell align="right">
                <Box component="span" sx={visuallyHidden}>
                  Actions
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[...versions].reverse().map((v) => (
              <TableRow key={v.versionNumber} hover>
                <TableCell>v{v.versionNumber}</TableCell>
                <TableCell>
                  <StatusChip color={STATUS_COLOR[v.status]} label={STATUS_LABEL[v.status]} />
                </TableCell>
                <TableCell>{v.submittedAt ? formatDate(v.submittedAt.slice(0, 10)) : "—"}</TableCell>
                <TableCell align="right">{`${currency} ${formatMoney(v.tcv)}`.trim()}</TableCell>
                <TableCell>{formatDate(v.updatedAt.slice(0, 10))}</TableCell>
                <TableCell align="right">
                  {/* View mode is the quote page; the wizard only edits a draft (2026-10-13). */}
                  {v.status === "DRAFT" && canEdit ? (
                    <Button size="small" component={RouterLink} to={cado2Paths.editVersion(quote.id, v.versionNumber)}>
                      Edit draft
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      component={RouterLink}
                      to={cado2Paths.quote(quote.id, "quote", false, v.versionNumber === latestNumber ? undefined : v.versionNumber)}
                    >
                      View
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {versions.length >= 2 ? <Compare quote={quote} /> : null}
    </Stack>
  );
}

function Compare({ quote }: { quote: QuoteView }): JSX.Element {
  const numbers = quote.versions.map((v) => v.versionNumber);
  const [from, setFrom] = useState(numbers[numbers.length - 2]);
  const [to, setTo] = useState(numbers[numbers.length - 1]);
  const [changesOnly, setChangesOnly] = useState(true);
  const a = useQuoteVersion(quote.id, from);
  const b = useQuoteVersion(quote.id, to);

  const rows: CompareRow[] = a.data && b.data ? compareVersions(a.data, b.data) : [];
  const shown = changesOnly ? rows.filter((r) => r.change !== "same") : rows;
  const picker = (label: string, value: number, set: (n: number) => void) => (
    <TextField select size="small" label={label} value={value} onChange={(e) => set(Number(e.target.value))} sx={{ minWidth: 120 }}>
      {numbers.map((n) => (
        <MenuItem key={n} value={n}>
          v{n}
        </MenuItem>
      ))}
    </TextField>
  );

  return (
    <Box component="section">
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" component="h3">
          Compare
        </Typography>
        {picker("From", from, setFrom)}
        {picker("To", to, setTo)}
        <ToggleButtonGroup size="small" exclusive value={changesOnly} onChange={(_, v) => v !== null && setChangesOnly(v)} aria-label="Compare view">
          <ToggleButton value={true}>Changes only</ToggleButton>
          <ToggleButton value={false}>All fields</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      {/* A failed load is an error, never "No differences." (2026-10-13). */}
      {a.error || b.error ? (
        <ErrorNotice
          error={a.error ?? b.error}
          onRetry={() => {
            void a.refetch();
            void b.refetch();
          }}
          retrying={a.isFetching || b.isFetching}
        >
          Couldn&apos;t load the versions to compare.
        </ErrorNotice>
      ) : a.isPending || b.isPending ? (
        <CircularProgress size={24} aria-label="Loading the versions" />
      ) : shown.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {from === to ? "Choose two different versions." : "No differences."}
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Comparison">
            <TableHead>
              <TableRow>
                <TableCell>Field</TableCell>
                <TableCell>v{from}</TableCell>
                <TableCell>v{to}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {shown.map((r) => (
                <TableRow key={`${r.section}-${r.label}`}>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {r.section}
                    </Typography>
                    {r.label}
                  </TableCell>
                  <TableCell>{r.from}</TableCell>
                  <TableCell sx={{ fontWeight: r.change === "same" ? undefined : 600 }}>{r.to}</TableCell>
                  <TableCell>
                    {r.change !== "same" ? <Chip size="small" variant="outlined" label={CHANGE_LABEL[r.change]} /> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
