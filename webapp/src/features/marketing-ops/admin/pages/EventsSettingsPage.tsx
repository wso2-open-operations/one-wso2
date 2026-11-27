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
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { Plus } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { MARKETING_OPS_EYEBROW } from "@constants/marketingOpsApps";
import MarketingOpsShell from "../../components/MarketingOpsShell";
import SettingsMasterDetail from "../components/SettingsMasterDetail";
import {
  useCreateStatus,
  useDeleteStatus,
  useDuplicateStatus,
  useFieldDefs,
  useMemberStatuses,
  useSaveFields,
  useUpdateStatus,
} from "../../api/useEvents";
import type { FieldDef } from "../../events/eventsTypes";
import GeographySync from "../../events/components/GeographySync";
import PicklistSync from "../../events/components/PicklistSync";
import FlaggedTitles from "../../events/components/FlaggedTitles";
import NewStatusDialog from "../../events/components/NewStatusDialog";
import StatusEditor from "../../events/components/StatusEditor";
import { primaryBtn, quietBtn } from "../../events/components/eventsStyles";

// Marketing Admin → Events member statuses and their columns, as one thing.
//
// They were two sections in Marketing Ops — a list of statuses, and a column editor per
// status — which was wrong. Neither is any use without the other: a status with no
// columns imports every heading on its tab as free text, and a column list belongs to
// exactly one status. So there is one nav of statuses, and selecting one gives you
// everything about it: its name, its score, whether it is live, and its columns.
//
// It sits in Marketing Admin rather than under the Events operation for the same reason
// the Pardot defaults do: these decide what MOP accepts from every regional marketing
// manager, not a preference of whoever happens to be uploading.
//
// What it replaces: two tables of spellings carried in code, each guessing at meaning.
// A tab called "Event attendees" matched nothing and 166 people were dropped in silence.

// A cheap identity for one status' column list, used as part of StatusEditor's key.
// Serializing the definitions is honest about what "the same columns" means — a
// reorder, or a single renamed heading, is a different list, and an editor open on
// the old one should restart rather than keep editing something that moved.
function fieldsRevision(defs: FieldDef[] | undefined): string {
  return defs ? JSON.stringify(defs) : "none";
}

export default function EventsSettingsPage() {
  // `true` — retired statuses are listed here, because this is where one is brought
  // back into use. The operation's own screens ask for live ones only.
  const statusesQuery = useMemberStatuses(true);
  const fieldsQuery = useFieldDefs();

  const createStatus = useCreateStatus();
  const updateStatus = useUpdateStatus();
  const deleteStatus = useDeleteStatus();
  const duplicateStatus = useDuplicateStatus();
  const saveFields = useSaveFields();

  const [wanted, setWanted] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statuses = statusesQuery.data;
  // No `?? {}` default. An absent field map is NOT an empty one: StatusEditor seeds
  // its editable draft from this prop, so rendering before it arrived let the column
  // editor start from [] — and saving that overwrote every real column with nothing.
  const fields = fieldsQuery.data;

  // Selection is DERIVED from the list rather than synced into it. A rename, a delete
  // or a duplicate changes which names exist, and the two invalidate together — so
  // `wanted` is a wish, and the first live name is the fallback when it isn't granted.
  const selected =
    statuses?.some((s) => s.name === wanted) ? wanted : (statuses?.[0]?.name ?? "");

  const groups = useMemo(
    () => [
      {
        label: "Member statuses",
        items: (statuses ?? []).map((s) => ({
          key: s.name,
          // A retired status is kept so an old submission stays readable; saying so
          // beats it looking identical to a live one.
          label: s.enabled ? s.name : `${s.name} (retired)`,
        })),
      },
    ],
    [statuses],
  );

  const current = statuses?.find((s) => s.name === selected);
  const failed = statusesQuery.isError || fieldsQuery.isError;

  return (
    <MarketingOpsShell
      eyebrow={MARKETING_OPS_EYEBROW.admin}
      title="Events — member statuses & columns"
      subtitle="The import contract. A workbook tab is matched by name, and only the columns listed here are read — so this decides what MOP accepts from every regional marketing manager."
    >
      {failed ? (
        <Alert severity="error">
          Could not load the Events settings.{" "}
          {describeError(statusesQuery.error ?? fieldsQuery.error)}
        </Alert>
      ) : !statuses || !fields ? (
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", py: 3 }}>
          <CircularProgress size={16} />
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>Loading settings…</Typography>
        </Stack>
      ) : (
        <Box>
          <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2, maxWidth: 800 }}>
            A workbook's tabs are imported by <b>name</b>. A tab called “Attendees” becomes the
            Attendees list; a tab named anything else is not imported at all — deliberately,
            because guessing what a tab meant is how a real upload once dropped 166 people without
            saying so. Add a status here before asking the regional marketing managers to add a tab
            for it.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2, fontSize: 12.5 }}>
              {error}
            </Alert>
          )}

          {statuses.length === 0 ? (
            <Box
              sx={{
                border: "1px dashed",
                borderColor: "divider",
                borderRadius: 1.5,
                px: 3,
                py: 5,
                textAlign: "center",
              }}
            >
              <Typography sx={{ fontSize: 13, color: "text.disabled", mb: 2 }}>
                No member statuses. No workbook tab can be imported until there is at least one.
              </Typography>
              <Button
                onClick={() => setAdding(true)}
                variant="contained"
                sx={primaryBtn}
                startIcon={<Plus size={17} />}
              >
                Add a member status
              </Button>
            </Box>
          ) : (
            <SettingsMasterDetail groups={groups} selected={selected} onSelect={setWanted}>
              {current && (
                // Keyed on the name so switching status remounts the editor: its local
                // draft of the columns is seeded from props, and a remount is what makes
                // that seeding correct without an effect.
                <StatusEditor
                  // Keyed on the columns as well as the name. `fields` lives under a
                  // stable query key, so a background refetch can replace it while
                  // the editor is open: `draft` was seeded once on mount but
                  // `baseline` read the new prop, which showed the editor as dirty
                  // and let a save push the pre-refetch columns back over the
                  // current ones. A changed revision is a different editor.
                  key={`${current.name}:${fieldsRevision(fields[current.name])}`}
                  status={current}
                  fields={fields[current.name] ?? []}
                  onSaveStatus={async (patch) => {
                    const updated = await updateStatus.mutateAsync({
                      source: current.name,
                      body: patch,
                    });
                    // Follow a rename to the new name — the old one no longer exists.
                    // The server normalizes the name, so prefer what it echoes back.
                    setWanted(updated?.name ?? patch.name);
                  }}
                  onSaveFields={async (next) => {
                    await saveFields.mutateAsync({ tab: current.name, fields: next });
                  }}
                  onDuplicate={async (name) => {
                    const created = await duplicateStatus.mutateAsync({
                      source: current.name,
                      name,
                    });
                    setWanted(created?.name ?? name);
                  }}
                  onDelete={async () => {
                    await deleteStatus.mutateAsync(current.name);
                    setWanted("");
                  }}
                  onError={setError}
                />
              )}
            </SettingsMasterDetail>
          )}

          {statuses.length > 0 && (
            <Box sx={{ mt: 2, pl: { xs: 0, md: "226px" } }}>
              <Button
                onClick={() => setAdding(true)}
                size="small"
                startIcon={<Plus size={16} />}
                sx={quietBtn}
              >
                Add a member status
              </Button>
            </Box>
          )}

          <NewStatusDialog
            // Keyed on each open so the dialog's fields start empty.
            key={adding ? "open" : "closed"}
            open={adding}
            onCancel={() => setAdding(false)}
            onCreate={async (name, score) => {
              const created = await createStatus.mutateAsync({ name, score, enabled: true });
              setAdding(false);
              setWanted(created?.name ?? name);
            }}
          />
        </Box>
      )}

      {/* Outside the member-status branch: they read their own endpoints, so a failure to
          load the statuses or columns doesn't take the reference syncs away with it. */}
      <PicklistSync />
      <GeographySync />
      <FlaggedTitles />
    </MarketingOpsShell>
  );
}
