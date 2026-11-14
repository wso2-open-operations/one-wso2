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
import { useState, type JSX, type ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Box, Link, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import { HistoryIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import EmptyState from "@features/sales/cado2/components/empty-state/EmptyState";
import SectionCard from "@features/sales/cado2/components/section-card/SectionCard";
import { changedText } from "@features/sales/cado2/quotes/form/draftForm";
import { ACTION_LABEL, type AdminChange } from "@features/sales/cado2/admin/components/changeLog";

/** How one change reads: its name, one line per change, and optional before/after wording. */
export interface ChangeEntry {
  readonly title: string;
  readonly lines: readonly string[];
  readonly before?: string | null;
  readonly after?: string | null;
}

/** Before and after, shown on request. */
function BeforeAfter({ before, after }: { before: string | null; after: string | null }): JSX.Element {
  const [open, setOpen] = useState(false);
  const block = (label: string, text: string | null): ReactNode => (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", bgcolor: "action.hover", borderRadius: 1, p: 1 }}>
        {text ?? "—"}
      </Typography>
    </Box>
  );
  return (
    <Box>
      <Link component="button" type="button" variant="caption" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? "Hide before and after" : "Show before and after"}
      </Link>
      {open ? (
        <Stack spacing={1} sx={{ mt: 1 }}>
          {block("Before", before)}
          {block("After", after)}
        </Stack>
      ) : null}
    </Box>
  );
}

/**
 * An Admin page's Change Log (D172): the latest changes, newest first, each
 * with who and when. Like Approval SLAs' log.
 *
 *   Changed · API Gateway                        14 Nov 2026 · admin@wso2.com
 *     From 101: 27.34% → 40.00%
 */
export default function ChangeLogCard({
  changes,
  describe,
  label,
  empty,
}: {
  readonly changes: UseQueryResult<AdminChange[], Error>;
  readonly describe: (c: AdminChange) => ChangeEntry;
  readonly label: string;
  readonly empty: string;
}): JSX.Element {
  return (
    <SectionCard title="Change Log" icon={<HistoryIcon size={16} />}>
      {changes.error ? (
        <ErrorNotice error={changes.error} onRetry={() => void changes.refetch()} retrying={changes.isFetching}>
          Couldn&apos;t load the change log.
        </ErrorNotice>
      ) : !changes.data ? (
        <Skeleton variant="rounded" height={60} />
      ) : changes.data.length === 0 ? (
        <EmptyState compact icon={<HistoryIcon size={20} />} title="No changes yet" body={empty} />
      ) : (
        <Stack component="ul" spacing={1.25} aria-label={label} sx={{ m: 0, pl: 2.5 }}>
          {changes.data.map((c) => {
            const e = describe(c);
            return (
              <Box component="li" key={c.id}>
                <Typography variant="body2">
                  <b>{ACTION_LABEL[c.action]}</b> · {e.title}
                  <Typography component="span" variant="caption" color="text.secondary">
                    {" "}
                    · {changedText(c.changedAt, c.changedByEmail)}
                  </Typography>
                </Typography>
                {e.lines.map((l) => (
                  <Typography key={l} variant="body2" color="text.secondary">
                    {l}
                  </Typography>
                ))}
                {e.before !== undefined || e.after !== undefined ? (
                  <BeforeAfter before={e.before ?? null} after={e.after ?? null} />
                ) : null}
              </Box>
            );
          })}
        </Stack>
      )}
    </SectionCard>
  );
}
