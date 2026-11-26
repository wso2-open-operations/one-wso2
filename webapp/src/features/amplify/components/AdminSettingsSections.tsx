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
import { Box, Button, Divider, Skeleton, Switch, TextField, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { LinkedinIcon } from "@components/icons/LinkedinIcon";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { AmplifySetting, CoinSchedule, PointAction, PointRule, PointValues } from "../api/amplifyTypes";
import { useAmplifySettings, usePointRules, usePointValues, type SettingsScope } from "../api/useAmplifyData";
import { useAmplifyGrant } from "../api/useAmplifyEditorAccess";
import { useSaveSettings, useSetPointRule } from "../api/useAmplifyMutations";
import { SETTINGS_CONFLICT_MESSAGE, describeAmplifyError } from "../util/amplifyError";
import { SCHEDULE_LABELS, isCoinSchedule, rateExample } from "../util/coins";
import { num } from "../util/dashboardFormat";
import { MAX_RULE_POINTS, parseRulePoints } from "../util/points";
import {
  COIN_BLOCK_COINS,
  COIN_BLOCK_POINTS,
  COIN_SCHEDULE,
  COIN_WALLETS_ENABLED,
  OWN_POST_DAILY_LIMIT,
  SETTING_RANGES,
  SHARING_ENABLED,
  booleanSetting,
  numberSetting,
  parseWholeNumber,
  settingChanges,
  settingsFormKey,
  stringSetting,
} from "../util/settings";
import { CoinMark } from "./AmplifyTone";
import LinkedInPageConnection from "./LinkedInPageConnection";

/** The help text under Send Coins to wallets. */
export const WALLETS_HELP =
  "Off until the WSO2 Coins service is ready. Points keep counting and convert on the first run after it's on.";

/** Beside the wallet switch for the PO team, who see it but can't change it. */
export const MANAGED_BY_ADMINS = "Managed by admins";

/** The note under Point values. */
export const NEW_ACTIVITY_ONLY_NOTE = "New values apply to new activity; points already earned don't change.";

/** The help text under Amplify posting. */
export const POSTING_HELP = "Turn off to stop all posting at once. Repost on LinkedIn still works.";

/** The toast after Save changes. */
export const SAVED_MESSAGE = "Changes saved. They apply from the next run.";

const SCHEDULES = Object.keys(SCHEDULE_LABELS) as CoinSchedule[];

/** The six point values, in the order Amplify Admin draws them (two columns). */
const VALUE_FIELDS = [
  { key: "REPOST", label: "Repost" },
  { key: "REPOST_COMMENTARY", label: "Repost with your own thoughts" },
  { key: "REACTION", label: "Reaction on LinkedIn" },
  { key: "COMMENT", label: "Comment on LinkedIn" },
  { key: "OWN_POST", label: "Own post approved" },
  { key: "FEATURED_EXTRA", label: "Own post featured (extra)" },
] as const;
type ValueKey = (typeof VALUE_FIELDS)[number]["key"];
type ValueTexts = Record<ValueKey, string>;

/**
 * The saved values as the fields show them. The featured field is the extra a feature adds; amplify-api stores the
 * total (`OWN_POST_AMPLIFIED`), so it is shown as total less approval.
 */
function savedValueTexts(values: PointValues): ValueTexts {
  const text = (n: number | undefined) => (n === undefined ? "" : String(n));
  const extra =
    values.OWN_POST_AMPLIFIED !== undefined && values.OWN_POST !== undefined
      ? Math.max(0, values.OWN_POST_AMPLIFIED - values.OWN_POST)
      : undefined;
  return {
    REPOST: text(values.REPOST),
    REPOST_COMMENTARY: text(values.REPOST_COMMENTARY),
    REACTION: text(values.REACTION),
    COMMENT: text(values.COMMENT),
    OWN_POST: text(values.OWN_POST),
    FEATURED_EXTRA: text(extra),
  };
}

/** The value in force for each action, from GET /po/point-rules. */
function rulesInForce(rules: readonly PointRule[]): PointValues {
  const values: PointValues = {};
  for (const r of rules) if (r.inForce) values[r.action] = r.points;
  return values;
}

/** One new point value to save. */
export interface RuleChange {
  action: PointAction;
  points: number;
}

/**
 * The point values to save, or null while any field is invalid. A blank field is no change when there is no value
 * yet, and invalid when there is one. Changing approval or the extra saves the featured total again.
 */
export function pointValueChanges(saved: PointValues, texts: ValueTexts): RuleChange[] | null {
  const parsed: Partial<Record<ValueKey, number>> = {};
  const savedTexts = savedValueTexts(saved);
  for (const { key } of VALUE_FIELDS) {
    const t = texts[key].trim();
    if (t === "") {
      if (savedTexts[key] !== "") return null;
      continue;
    }
    const n = parseRulePoints(t);
    if (n === null) return null;
    parsed[key] = n;
  }
  const changes: RuleChange[] = [];
  for (const action of ["REPOST", "REPOST_COMMENTARY", "REACTION", "COMMENT", "OWN_POST"] as const) {
    const n = parsed[action];
    if (n !== undefined && n !== saved[action]) changes.push({ action, points: n });
  }
  if (parsed.OWN_POST !== undefined && parsed.FEATURED_EXTRA !== undefined) {
    const total = parsed.OWN_POST + parsed.FEATURED_EXTRA;
    if (total > MAX_RULE_POINTS) return null;
    if (total !== saved.OWN_POST_AMPLIFIED) changes.push({ action: "OWN_POST_AMPLIFIED", points: total });
  }
  return changes;
}

/** A section of Amplify Admin: a bordered card with a title. */
function Card({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <Box component="section" aria-label={title} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2.5, mb: 2.5 }}>
      <Typography component="h2" sx={{ fontWeight: 700, fontSize: 19, display: "flex", alignItems: "center", gap: 1.25, mb: 1.5 }}>
        {icon}
        {title}
      </Typography>
      {children}
    </Box>
  );
}

/** One setting: its name and help on the left, the control on the right. */
function Row({ label, help, children, first }: { label: string; help?: ReactNode; children: ReactNode; first?: boolean }) {
  return (
    <>
      {!first && <Divider />}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap", py: 1.75 }}>
        <Box sx={{ minWidth: 0, flex: "1 1 260px" }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{label}</Typography>
          {help && (
            <Typography variant="body2" color="text.secondary">
              {help}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>{children}</Box>
      </Box>
    </>
  );
}

/** A right-aligned number box. */
function NumberBox({
  label,
  value,
  onChange,
  error,
  disabled,
  max,
  min = 0,
  width = 120,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error: boolean;
  disabled: boolean;
  max: number;
  min?: number;
  width?: number;
}) {
  return (
    <TextField
      type="number"
      size="small"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      error={error}
      sx={{ width, "& input": { textAlign: "right" } }}
      slotProps={{ htmlInput: { min, max, step: 1, "aria-label": label } }}
    />
  );
}

/**
 * Amplify Admin's settings: Coins, Point values and the own-post daily limit, and for admins the LinkedIn page
 * connection (its own Connect and Disconnect) and the Amplify posting switch (`sharing.enabled`), with one Discard
 * and one Save changes for the settings. Coins and the own-post limit show to `CAN_POINT_RULES` or `CAN_ADMIN`,
 * through `/admin/settings` for an admin and `/po/settings` otherwise (the PO team sees the wallet switch but only admins change it). Point
 * values are edited by `CAN_POINT_RULES` (POST /po/point-rules); an admin without it sees them read-only.
 */
export default function AdminSettingsForm() {
  const admin = useAmplifyGrant("CAN_ADMIN");
  const po = useAmplifyGrant("CAN_POINT_RULES");
  const scope: SettingsScope = admin.hasAccess ? "admin" : "po";
  const settings = useAmplifySettings(scope, admin.hasAccess || po.hasAccess);
  const rules = usePointRules(po.hasAccess);
  const values = usePointValues();
  const [resets, setResets] = useState(0);

  if (!admin.hasAccess && !po.hasAccess) return null;
  if (settings.isPending) return <Skeleton variant="rounded" height={320} />;
  if (settings.isError) {
    return (
      <ErrorNotice error={settings.error} onRetry={() => void settings.refetch()} retrying={settings.isFetching}>
        Couldn&apos;t load the settings.
      </ErrorNotice>
    );
  }
  const pointSource = po.hasAccess ? rules : values;
  if (pointSource.isPending) return <Skeleton variant="rounded" height={320} />;
  if (pointSource.isError) {
    return (
      <ErrorNotice error={pointSource.error} onRetry={() => void pointSource.refetch()} retrying={pointSource.isFetching}>
        Couldn&apos;t load the point values.
      </ErrorNotice>
    );
  }
  const saved = po.hasAccess ? rulesInForce((rules.data ?? []) as PointRule[]) : ((values.data ?? {}) as PointValues);
  const key = `${settingsFormKey(settings.data)}#${JSON.stringify(saved)}#${resets}`;
  return (
    <AdminForm
      key={key}
      settings={settings.data}
      scope={scope}
      savedValues={saved}
      canEditValues={po.hasAccess}
      onDiscard={() => setResets((n) => n + 1)}
    />
  );
}

/** The form, started from the saved settings and values; a new version of either starts it again. */
function AdminForm({
  settings,
  scope,
  savedValues,
  canEditValues,
  onDiscard,
}: {
  settings: AmplifySetting[];
  scope: SettingsScope;
  savedValues: PointValues;
  canEditValues: boolean;
  onDiscard: () => void;
}) {
  const saveSettings = useSaveSettings();
  const setRule = useSetPointRule();
  const { showError, showSuccess } = useNotifications();
  const [busy, setBusy] = useState(false);

  const savedPoints = numberSetting(settings, COIN_BLOCK_POINTS);
  const savedCoins = numberSetting(settings, COIN_BLOCK_COINS);
  const savedSchedule = stringSetting(settings, COIN_SCHEDULE);
  const savedWallets = booleanSetting(settings, COIN_WALLETS_ENABLED);
  const savedLimit = numberSetting(settings, OWN_POST_DAILY_LIMIT);
  const savedPosting = scope === "admin" ? booleanSetting(settings, SHARING_ENABLED) : null;
  const [pointsText, setPointsText] = useState(savedPoints === null ? "" : String(savedPoints));
  const [coinsText, setCoinsText] = useState(savedCoins === null ? "" : String(savedCoins));
  const [schedule, setSchedule] = useState<CoinSchedule>(isCoinSchedule(savedSchedule) ? savedSchedule : "MONTHLY");
  const [wallets, setWallets] = useState(savedWallets ?? false);
  const [limitText, setLimitText] = useState(savedLimit === null ? "" : String(savedLimit));
  const [posting, setPosting] = useState(savedPosting ?? true);
  const [valueTexts, setValueTexts] = useState<ValueTexts>(() => savedValueTexts(savedValues));

  const coinsAvailable = savedPoints !== null && savedCoins !== null && isCoinSchedule(savedSchedule);
  const blockPoints = parseWholeNumber(pointsText, SETTING_RANGES[COIN_BLOCK_POINTS]);
  const blockCoins = parseWholeNumber(coinsText, SETTING_RANGES[COIN_BLOCK_COINS]);
  const rateValid = !coinsAvailable || (blockPoints !== null && blockCoins !== null);
  const limitRange = SETTING_RANGES[OWN_POST_DAILY_LIMIT];
  const limit = savedLimit === null ? null : parseWholeNumber(limitText, limitRange);
  const limitValid = savedLimit === null || limit !== null;
  const canSwitch = scope === "admin" && savedWallets !== null;

  const settingsChanges =
    rateValid && limitValid
      ? settingChanges(settings, {
          ...(coinsAvailable && blockPoints !== null && blockCoins !== null
            ? { [COIN_BLOCK_POINTS]: blockPoints, [COIN_BLOCK_COINS]: blockCoins, [COIN_SCHEDULE]: schedule }
            : {}),
          ...(canSwitch ? { [COIN_WALLETS_ENABLED]: wallets } : {}),
          ...(limit !== null ? { [OWN_POST_DAILY_LIMIT]: limit } : {}),
          ...(savedPosting !== null ? { [SHARING_ENABLED]: posting } : {}),
        })
      : [];
  const ruleChanges = canEditValues ? pointValueChanges(savedValues, valueTexts) : [];
  const valid = rateValid && limitValid && ruleChanges !== null;
  const dirty = settingsChanges.length > 0 || (ruleChanges?.length ?? 0) > 0;
  const example = blockPoints !== null && blockCoins !== null ? rateExample(blockPoints, blockCoins) : null;

  const save = async () => {
    if (!valid || !dirty || busy) return;
    setBusy(true);
    try {
      if (settingsChanges.length > 0) {
        try {
          await saveSettings.mutateAsync({ scope, changes: settingsChanges });
        } catch (err) {
          showError(describeAmplifyError(err, { VERSION_CONFLICT: SETTINGS_CONFLICT_MESSAGE }));
          return;
        }
      }
      for (const change of ruleChanges ?? []) {
        try {
          await setRule.mutateAsync(change);
        } catch (err) {
          showError(describeAmplifyError(err));
          return;
        }
      }
      showSuccess(SAVED_MESSAGE);
    } finally {
      setBusy(false);
    }
  };

  const setValue = (key: ValueKey, v: string) => setValueTexts((t) => ({ ...t, [key]: v }));

  return (
    <Box>
      <Card title="Coins" icon={<CoinMark size={22} />}>
        {coinsAvailable ? (
          <>
            <Row first label="Conversion rate" help="Points turn into Coins in whole blocks; the rest carries over.">
              <NumberBox
                label="Points"
                value={pointsText}
                onChange={setPointsText}
                error={blockPoints === null}
                disabled={busy}
                min={1}
                max={SETTING_RANGES[COIN_BLOCK_POINTS].max}
              />
              <Typography variant="body2">points =</Typography>
              <NumberBox
                label="Coins"
                value={coinsText}
                onChange={setCoinsText}
                error={blockCoins === null}
                disabled={busy}
                min={1}
                max={SETTING_RANGES[COIN_BLOCK_COINS].max}
              />
              <Typography variant="body2">Coins</Typography>
            </Row>
            {!rateValid && (
              <Typography variant="caption" color="error" sx={{ display: "block", mb: 1 }}>
                Use whole numbers from 1 to 100,000.
              </Typography>
            )}
            <Row label="Convert automatically" help="No approval step: verified points convert on this schedule.">
              <TextField
                select
                size="small"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value as CoinSchedule)}
                disabled={busy}
                sx={{ minWidth: 240 }}
                slotProps={{ select: { native: true }, htmlInput: { "aria-label": "Convert automatically" } }}
              >
                {SCHEDULES.map((s) => (
                  <option key={s} value={s}>
                    {SCHEDULE_LABELS[s]}
                  </option>
                ))}
              </TextField>
            </Row>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
            The Coins settings aren&apos;t available yet.
          </Typography>
        )}
        <Divider />
        <Box sx={{ py: 1.75 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Send Coins to wallets</Typography>
          <Typography variant="body2" color="text.secondary">
            {WALLETS_HELP}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
            <Switch
              checked={canSwitch ? wallets : (savedWallets ?? false)}
              onChange={(e) => setWallets(e.target.checked)}
              disabled={!canSwitch || busy}
              slotProps={{ input: { role: "switch", "aria-label": "Send Coins to wallets" } }}
            />
            <Typography variant="body2" sx={{ fontWeight: 700, color: (canSwitch ? wallets : savedWallets) ? "success.main" : "warning.dark" }}>
              {(canSwitch ? wallets : savedWallets) ? "On" : "Off"}
              {!canSwitch && ` · ${MANAGED_BY_ADMINS}`}
            </Typography>
          </Box>
        </Box>
        {example && (
          <Box
            role="status"
            sx={{ border: "1px solid", borderColor: "warning.light", bgcolor: "action.hover", borderRadius: 2, px: 2, py: 1.5, mt: 0.5 }}
          >
            <Typography variant="body2">
              <strong>Example at this rate:</strong> {num(example.points)} points → <strong>{num(example.coins)} Coins</strong>
              {example.carried > 0 ? `, ${num(example.carried)} points carry over to the next run.` : "."}
            </Typography>
          </Box>
        )}
      </Card>

      <Card title="Point values">
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, columnGap: 5 }}>
          {VALUE_FIELDS.map(({ key: k, label }) => {
            const t = valueTexts[k];
            const bad = t.trim() !== "" && parseRulePoints(t) === null;
            return (
              <Box
                key={k}
                sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, py: 1.5, borderTop: "1px solid", borderColor: "divider" }}
              >
                <Typography sx={{ fontWeight: 600, fontSize: 15 }}>{label}</Typography>
                <NumberBox
                  label={label}
                  value={t}
                  onChange={(v) => setValue(k, v)}
                  error={bad || (t.trim() === "" && savedValueTexts(savedValues)[k] !== "")}
                  disabled={busy || !canEditValues}
                  max={MAX_RULE_POINTS}
                />
              </Box>
            );
          })}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {NEW_ACTIVITY_ONLY_NOTE}
        </Typography>
      </Card>

      {savedLimit !== null && (
        <Card title="Own posts">
          <Row first label="Own posts one person can submit a day" help="0 means no limit.">
            <NumberBox
              label="Own posts one person can submit a day"
              value={limitText}
              onChange={setLimitText}
              error={limit === null}
              disabled={busy}
              min={limitRange.min}
              max={limitRange.max}
            />
          </Row>
          {limit === null && (
            <Typography variant="caption" color="error">
              Use a whole number from {limitRange.min} to {limitRange.max}.
            </Typography>
          )}
        </Card>
      )}

      {scope === "admin" && (
        <Card title="LinkedIn page connection" icon={<LinkedinIcon size={22} color="#0A66C2" />}>
          <LinkedInPageConnection />
        </Card>
      )}

      {savedPosting !== null && (
        <Card title={'"Post it for me" posting'}>
          <Row first label="Amplify posting" help={POSTING_HELP}>
            <Switch
              checked={posting}
              onChange={(e) => setPosting(e.target.checked)}
              disabled={busy}
              slotProps={{ input: { role: "switch", "aria-label": "Amplify posting" } }}
            />
            <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 28 }}>
              {posting ? "On" : "Off"}
            </Typography>
          </Row>
        </Card>
      )}

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, flexWrap: "wrap" }}>
        <Button variant="outlined" onClick={onDiscard} disabled={!dirty || busy}>
          Discard
        </Button>
        <Button variant="contained" onClick={() => void save()} disabled={!dirty || !valid || busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </Box>
    </Box>
  );
}
