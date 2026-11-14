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
import { Button, Skeleton, Stack, TextField, Typography } from "@wso2/oxygen-ui";
import { LayersIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useCado2Toast } from "@features/sales/cado2/components/toast/toastContext";
import PageHeader from "@features/sales/cado2/components/page-header/PageHeader";
import SectionCard from "@features/sales/cado2/components/section-card/SectionCard";
import { changedText } from "@features/sales/cado2/quotes/form/draftForm";
import {
  useQuoteVersions,
  useSaveQuoteVersions,
  type QuoteVersionsSetting,
} from "@features/sales/cado2/admin/quote-versions/api/useQuoteVersions";

const MIN = 2;
const MAX = 99;

/**
 * CadO2 Admin → Quote Versions (D174): how many versions a quote may have.
 * Once a quote has that many, nobody can revise it, Deal Desk included; the
 * AM clones it into a new quote, which starts again at version 1.
 */
export default function QuoteVersionsPage(): JSX.Element {
  const setting = useQuoteVersions();
  return (
    <Stack spacing={3} sx={{ maxWidth: 900 }}>
      <PageHeader title="Quote Versions" />
      <SectionCard title="Versions per Quote" icon={<LayersIcon size={16} />}>
        {setting.error ? (
          <ErrorNotice error={setting.error} onRetry={() => void setting.refetch()} retrying={setting.isFetching}>
            Couldn&apos;t load the quote versions setting.
          </ErrorNotice>
        ) : setting.isPending ? (
          <Skeleton variant="rounded" height={120} aria-label="Loading the quote versions setting" />
        ) : (
          // Keyed by the stored value, so a save shows what was stored.
          <LimitForm key={setting.data.maxVersions} setting={setting.data} />
        )}
      </SectionCard>
    </Stack>
  );
}

function LimitForm({ setting }: { setting: QuoteVersionsSetting }): JSX.Element {
  const save = useSaveQuoteVersions();
  const notify = useCado2Toast();
  const [value, setValue] = useState(String(setting.maxVersions));
  const n = /^\d+$/.test(value.trim()) ? Number(value) : NaN;
  const problem = Number.isNaN(n) || n < MIN || n > MAX ? `Enter a whole number from ${MIN} to ${MAX}` : null;
  const changed = !problem && n !== setting.maxVersions;
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <TextField
          label="Most versions per quote"
          value={value}
          onChange={(e) => {
            save.reset();
            setValue(e.target.value);
          }}
          size="small"
          inputMode="numeric"
          error={Boolean(problem)}
          helperText={problem ?? `${MIN} to ${MAX}`}
          sx={{ width: 220 }}
        />
        <Button
          variant="contained"
          disabled={!changed || save.isPending}
          onClick={() => save.mutate(n, { onSuccess: () => notify("Quote versions limit saved") })}
          sx={{ mt: 0.25 }}
        >
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Once a quote has this many versions, it can&apos;t be revised, by anyone. The Account Manager clones it into a new
        quote instead, which starts again at version 1. Quotes already over the limit keep their versions.
      </Typography>
      {save.error ? <ErrorNotice error={save.error}>Couldn&apos;t save the limit.</ErrorNotice> : null}
      {setting.updatedByEmail && setting.updatedAt ? (
        <Typography variant="caption" color="text.secondary">
          Last changed {changedText(setting.updatedAt, setting.updatedByEmail)}
        </Typography>
      ) : null}
    </Stack>
  );
}
