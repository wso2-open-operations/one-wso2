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
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Skeleton,
  Switch,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { AmplifySetting, CoinSchedule, SettingChange } from "../api/amplifyTypes";
import { useAmplifySettings, type SettingsScope } from "../api/useAmplifyData";
import { useAmplifyGrant } from "../api/useAmplifyEditorAccess";
import { useSaveSettings } from "../api/useAmplifyMutations";
import { SETTINGS_CONFLICT_MESSAGE, describeAmplifyError } from "../util/amplifyError";
import { SCHEDULE_LABELS, isCoinSchedule, workedExample } from "../util/coins";
import {
  COIN_BLOCK_COINS,
  COIN_BLOCK_POINTS,
  COIN_SCHEDULE,
  COIN_WALLETS_ENABLED,
  OWN_POST_DAILY_LIMIT,
  SETTING_RANGES,
  booleanSetting,
  numberSetting,
  parseWholeNumber,
  settingChanges,
  settingsFormKey,
  stringSetting,
} from "../util/settings";
import { AmplifyPanel } from "./AmplifyShell";

/** The line under the Coins section's Save button. */
export const NEXT_RUN_NOTE = "Changes apply from the next run and are recorded.";

/** The line under the Own posts section's Save button. */
export const NEW_SUBMISSIONS_NOTE = "Changes apply to new submissions and are recorded.";

/** The help text under the wallet switch. */
export const WALLETS_HELP = "Off until the WSO2 Coins service is ready. Points keep counting in the meantime.";

/** Shown to the PO team in place of the wallet switch, which only admins change. */
export const MANAGED_BY_ADMINS = "Managed by admins";

const SCHEDULES = Object.keys(SCHEDULE_LABELS) as CoinSchedule[];

/**
 * Where the caller's settings live: an admin (`CAN_ADMIN`) reads and saves every key through `/admin/settings`;
 * the PO team (`CAN_POINT_RULES` alone) through `/po/settings`, which leaves the wallet switch out.
 */
function useSettingsScope() {
  const admin = useAmplifyGrant("CAN_ADMIN");
  const scope: SettingsScope = admin.hasAccess ? "admin" : "po";
  return { scope, settings: useAmplifySettings(scope) };
}

/** A section's settings once loaded: a placeholder while loading and a notice with Retry if they fail. */
function SettingsLoader({
  title,
  children,
}: {
  title: string;
  children: (settings: AmplifySetting[], scope: SettingsScope) => ReactNode;
}) {
  const { scope, settings } = useSettingsScope();
  return (
    <AmplifyPanel title={title}>
      {settings.isPending ? (
        <Skeleton variant="rounded" height={160} />
      ) : settings.isError ? (
        <ErrorNotice error={settings.error} onRetry={() => void settings.refetch()} retrying={settings.isFetching}>
          Couldn&apos;t load the settings.
        </ErrorNotice>
      ) : (
        children(settings.data, scope)
      )}
    </AmplifyPanel>
  );
}

/**
 * Saves `changes` to `scope` and says how it went. A 409 means someone else saved first: the mutation has already
 * refetched the settings (the form starts again from them), so the message says to check and save again.
 */
function useSaveWithNotices(scope: SettingsScope, success: string) {
  const save = useSaveSettings();
  const { showError, showSuccess } = useNotifications();
  const submit = (changes: SettingChange[]) => {
    if (changes.length === 0 || save.isPending) return;
    save.mutate(
      { scope, changes },
      {
        onSuccess: () => showSuccess(success),
        onError: (err) => showError(describeAmplifyError(err, { VERSION_CONFLICT: SETTINGS_CONFLICT_MESSAGE })),
      },
    );
  };
  return { submit, busy: save.isPending };
}

/**
 * Coins (CAN_POINT_RULES or CAN_ADMIN): the conversion rate, the schedule and a worked example from them, and the
 * switch that sends Coins to wallets, which only admins change.
 */
export function CoinsSection() {
  return (
    <SettingsLoader title="Coins">
      {(settings, scope) => <CoinsForm key={settingsFormKey(settings)} settings={settings} scope={scope} />}
    </SettingsLoader>
  );
}

/** The Coins form, started from `settings`; a new version of any setting starts it again. */
function CoinsForm({ settings, scope }: { settings: AmplifySetting[]; scope: SettingsScope }) {
  const savedPoints = numberSetting(settings, COIN_BLOCK_POINTS);
  const savedCoins = numberSetting(settings, COIN_BLOCK_COINS);
  const savedSchedule = stringSetting(settings, COIN_SCHEDULE);
  const savedWallets = booleanSetting(settings, COIN_WALLETS_ENABLED);
  const [pointsText, setPointsText] = useState(savedPoints === null ? "" : String(savedPoints));
  const [coinsText, setCoinsText] = useState(savedCoins === null ? "" : String(savedCoins));
  const [schedule, setSchedule] = useState<CoinSchedule>(isCoinSchedule(savedSchedule) ? savedSchedule : "MONTHLY");
  const [wallets, setWallets] = useState(savedWallets ?? false);
  const { submit, busy } = useSaveWithNotices(scope, "Coins settings saved. They apply from the next run.");

  if (savedPoints === null || savedCoins === null || !isCoinSchedule(savedSchedule)) {
    return (
      <Typography variant="body2" color="text.secondary">
        The Coins settings aren&apos;t available yet.
      </Typography>
    );
  }

  const blockPoints = parseWholeNumber(pointsText, SETTING_RANGES[COIN_BLOCK_POINTS]);
  const blockCoins = parseWholeNumber(coinsText, SETTING_RANGES[COIN_BLOCK_COINS]);
  const valid = blockPoints !== null && blockCoins !== null;
  const canSwitch = scope === "admin" && savedWallets !== null;
  const changes = valid
    ? settingChanges(settings, {
        [COIN_BLOCK_POINTS]: blockPoints,
        [COIN_BLOCK_COINS]: blockCoins,
        [COIN_SCHEDULE]: schedule,
        ...(canSwitch ? { [COIN_WALLETS_ENABLED]: wallets } : {}),
      })
    : [];
  const example = valid ? workedExample(blockPoints, blockCoins) : null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
        <FormLabel component="legend" sx={{ mb: 1 }}>
          Rate
        </FormLabel>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <TextField
            type="number"
            size="small"
            value={pointsText}
            onChange={(e) => setPointsText(e.target.value)}
            disabled={busy}
            error={blockPoints === null}
            sx={{ width: 120 }}
            slotProps={{ htmlInput: { min: 1, max: SETTING_RANGES[COIN_BLOCK_POINTS].max, step: 1, "aria-label": "Points" } }}
          />
          <Typography variant="body2">points =</Typography>
          <TextField
            type="number"
            size="small"
            value={coinsText}
            onChange={(e) => setCoinsText(e.target.value)}
            disabled={busy}
            error={blockCoins === null}
            sx={{ width: 120 }}
            slotProps={{ htmlInput: { min: 1, max: SETTING_RANGES[COIN_BLOCK_COINS].max, step: 1, "aria-label": "Coins" } }}
          />
          <Typography variant="body2">Coins</Typography>
        </Box>
        {!valid && (
          <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
            Use whole numbers from 1 to 100,000.
          </Typography>
        )}
      </Box>

      <FormControl component="fieldset" disabled={busy}>
        <FormLabel component="legend">Schedule</FormLabel>
        <RadioGroup
          row
          aria-label="Schedule"
          value={schedule}
          onChange={(e) => setSchedule(e.target.value as CoinSchedule)}
        >
          {SCHEDULES.map((s) => (
            <FormControlLabel key={s} value={s} control={<Radio size="small" />} label={SCHEDULE_LABELS[s]} />
          ))}
        </RadioGroup>
      </FormControl>

      {example && (
        <Box role="status" sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, px: 1.5, py: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            For example
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {example}
          </Typography>
        </Box>
      )}

      <Box>
        {canSwitch ? (
          <FormControlLabel
            control={<Switch checked={wallets} onChange={(e) => setWallets(e.target.checked)} disabled={busy} />}
            label="Send Coins to wallets"
          />
        ) : (
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Send Coins to wallets
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {MANAGED_BY_ADMINS}
            </Typography>
          </Box>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          {WALLETS_HELP}
        </Typography>
      </Box>

      <SaveRow onSave={() => submit(changes)} disabled={!valid || changes.length === 0} busy={busy} note={NEXT_RUN_NOTE} />
    </Box>
  );
}

/** Own posts (CAN_POINT_RULES or CAN_ADMIN): how many own posts one person may submit per day. */
export function OwnPostsSection() {
  return (
    <SettingsLoader title="Own posts">
      {(settings, scope) => <OwnPostsForm key={settingsFormKey(settings)} settings={settings} scope={scope} />}
    </SettingsLoader>
  );
}

/** The daily limit form, started from `settings`. */
function OwnPostsForm({ settings, scope }: { settings: AmplifySetting[]; scope: SettingsScope }) {
  const saved = numberSetting(settings, OWN_POST_DAILY_LIMIT);
  const [text, setText] = useState(saved === null ? "" : String(saved));
  const { submit, busy } = useSaveWithNotices(scope, "Own-post daily limit saved.");

  if (saved === null) {
    return (
      <Typography variant="body2" color="text.secondary">
        The own-post daily limit isn&apos;t available yet.
      </Typography>
    );
  }

  const range = SETTING_RANGES[OWN_POST_DAILY_LIMIT];
  const limit = parseWholeNumber(text, range);
  const changes = limit === null ? [] : settingChanges(settings, { [OWN_POST_DAILY_LIMIT]: limit });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <TextField
        type="number"
        size="small"
        label="Own posts per person per day"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy}
        error={limit === null}
        helperText={limit === null ? `Use a whole number from ${range.min} to ${range.max}.` : "0 means no limit."}
        sx={{ maxWidth: 280 }}
        slotProps={{ htmlInput: { min: range.min, max: range.max, step: 1 } }}
      />
      <SaveRow
        onSave={() => submit(changes)}
        disabled={limit === null || changes.length === 0}
        busy={busy}
        note={NEW_SUBMISSIONS_NOTE}
      />
    </Box>
  );
}

/** Save, and the line saying when changes apply. */
function SaveRow({ onSave, disabled, busy, note }: { onSave: () => void; disabled: boolean; busy: boolean; note: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
      <Button variant="contained" size="small" onClick={onSave} disabled={disabled || busy}>
        {busy ? "Saving…" : "Save"}
      </Button>
      <Typography variant="body2" color="text.secondary">
        {note}
      </Typography>
    </Box>
  );
}
