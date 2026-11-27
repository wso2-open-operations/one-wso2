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

import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  Box,
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { PencilIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { AmplifyGrant, PointAction, PointRule } from "../api/amplifyTypes";
import { usePointRules } from "../api/useAmplifyData";
import { useAmplifyGrant } from "../api/useAmplifyEditorAccess";
import { useSetPointRule } from "../api/useAmplifyMutations";
import AmplifyShell, { AmplifyPanel } from "../components/AmplifyShell";
import { describeAmplifyError } from "../util/amplifyError";
import { num, shortDate } from "../util/dashboardFormat";
import { MAX_RULE_POINTS, POINT_ACTION_LABELS, parseRulePoints, pointActionOrder } from "../util/points";

/** The note under Point values. */
export const NEW_ACTIVITY_ONLY_NOTE =
  "New values apply to new activity only. Points people have already earned keep their value.";

/** One section of Amplify Admin and the grant it needs. */
interface AdminSection {
  key: string;
  grant: AmplifyGrant;
  Section: ComponentType;
}

// Sections in page order. Later slices add theirs here, each with the grant it needs.
const ADMIN_SECTIONS: readonly AdminSection[] = [
  { key: "point-values", grant: "CAN_POINT_RULES", Section: PointValuesSection },
];

/**
 * Amplify Admin (AmplifyAdminRoute lets in anyone who holds a section's grant). Each section shows only to callers
 * with its own grant; for now the one section is Point values (`CAN_POINT_RULES`).
 */
export default function AmplifyAdminPage() {
  return (
    <AmplifyShell title="Amplify Admin" subtitle="Settings for Amplify across Choreo Labs.">
      {ADMIN_SECTIONS.map(({ key, grant, Section }) => (
        <GrantedSection key={key} grant={grant}>
          <Section />
        </GrantedSection>
      ))}
    </AmplifyShell>
  );
}

/** Renders `children` only for a caller amplify-api grants `grant`. */
function GrantedSection({ grant, children }: { grant: AmplifyGrant; children: ReactNode }) {
  const access = useAmplifyGrant(grant);
  return access.hasAccess && !access.isResolving ? <>{children}</> : null;
}

/** Point values: the points each action earns now, editable one at a time (GET and POST /po/point-rules). */
export function PointValuesSection() {
  const rules = usePointRules();
  const [editing, setEditing] = useState<PointAction | null>(null);
  const current = useMemo(
    () =>
      (rules.data ?? [])
        .filter((r) => r.inForce)
        .sort((a, b) => pointActionOrder(a.action) - pointActionOrder(b.action)),
    [rules.data],
  );

  return (
    <AmplifyPanel title="Point values">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {NEW_ACTIVITY_ONLY_NOTE}
      </Typography>
      {rules.isPending ? (
        <Skeleton variant="rounded" height={200} />
      ) : rules.isError ? (
        <ErrorNotice error={rules.error} onRetry={() => void rules.refetch()} retrying={rules.isFetching}>
          Couldn&apos;t load the point values.
        </ErrorNotice>
      ) : current.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No point values are set.
        </Typography>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" aria-label="Point values">
            <TableHead>
              <TableRow>
                <TableCell>Action</TableCell>
                <TableCell align="right">Points</TableCell>
                <TableCell>Since</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {current.map((rule) => (
                <PointRuleRow
                  key={rule.action}
                  rule={rule}
                  editing={editing === rule.action}
                  canEdit={editing === null}
                  onEdit={() => setEditing(rule.action)}
                  onDone={() => setEditing(null)}
                />
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </AmplifyPanel>
  );
}

/** One action's value; Edit turns the value into a field with Save and Cancel. */
function PointRuleRow({
  rule,
  editing,
  canEdit,
  onEdit,
  onDone,
}: {
  rule: PointRule;
  editing: boolean;
  /** False while another row is being edited. */
  canEdit: boolean;
  onEdit: () => void;
  onDone: () => void;
}) {
  const save = useSetPointRule();
  const { showError, showSuccess } = useNotifications();
  const [text, setText] = useState(String(rule.points));
  const label = POINT_ACTION_LABELS[rule.action] ?? rule.action;
  const points = parseRulePoints(text);
  const busy = save.isPending;

  const startEdit = () => {
    setText(String(rule.points));
    onEdit();
  };

  const submit = () => {
    if (points === null || points === rule.points || busy) return;
    save.mutate(
      { action: rule.action, points },
      {
        onSuccess: () => {
          showSuccess(`${label}: ${num(points)} points for new activity.`);
          onDone();
        },
        onError: (err) => showError(describeAmplifyError(err)),
      },
    );
  };

  return (
    <TableRow>
      <TableCell>
        {label}
        {rule.action === "OWN_POST_AMPLIFIED" && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            The total for a featured post, approval points included.
          </Typography>
        )}
      </TableCell>
      <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
        {editing ? (
          <TextField
            type="number"
            size="small"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            error={points === null}
            sx={{ width: 110 }}
            slotProps={{ htmlInput: { min: 0, max: MAX_RULE_POINTS, step: 1, "aria-label": `Points for ${label}` } }}
          />
        ) : (
          num(rule.points)
        )}
      </TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>{shortDate(rule.effectiveFrom)}</TableCell>
      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
        {editing ? (
          <Box sx={{ display: "inline-flex", gap: 1 }}>
            <Button size="small" onClick={onDone} disabled={busy}>
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={submit}
              disabled={points === null || points === rule.points || busy}
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          </Box>
        ) : (
          <Button
            size="small"
            startIcon={<PencilIcon size={14} />}
            onClick={startEdit}
            disabled={!canEdit}
            aria-label={`Edit ${label}`}
          >
            Edit
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
