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

import { useState, type FormEvent } from "react";
import {
  Box,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
} from "@wso2/oxygen-ui";
import { SearchIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import ScopeSwitch from "../../components/ScopeSwitch";

const ALL = "__all__";

/** The Sales Regions an account can be in (Account.Sales_Regions__c). */
const SALES_REGIONS = ["EU", "APAC", "ME", "LATAM", "AFRICA", "NA"];

/** Whose deals: the signed-in user's own, or everyone's. */
export type DealScope = "mine" | "all";

export interface OwnerOption {
  email: string;
  name: string;
}

/**
 * The filters above the deal list, on one line: whose deals (Mine or All), search, owner,
 * stage, region, and "hide closed" at the far end. The owner filter only means something
 * across everyone's deals, so it rests while Mine is on.
 *
 * Search submits as a form, like MeetingFilters, so each keystroke isn't a
 * request. The select filters apply at once — one change, one request.
 */
export default function DealFilters({
  scope,
  onScopeChange,
  search,
  onSearchChange,
  owner,
  onOwnerChange,
  owners,
  stage,
  onStageChange,
  stages,
  region,
  onRegionChange,
  hideClosed,
  onHideClosedChange,
}: {
  scope: DealScope;
  onScopeChange: (scope: DealScope) => void;
  /** The APPLIED search, not the draft. */
  search: string | null;
  onSearchChange: (search: string | null) => void;
  /** Owner email, or null for everyone. */
  owner: string | null;
  onOwnerChange: (owner: string | null) => void;
  owners: OwnerOption[];
  stage: string | null;
  onStageChange: (stage: string | null) => void;
  stages: string[];
  /** The account's Sales Region, or null for every region. */
  region: string | null;
  onRegionChange: (region: string | null) => void;
  hideClosed: boolean;
  onHideClosedChange: (hideClosed: boolean) => void;
}) {
  const [draft, setDraft] = useState(search ?? "");
  // Resynced during render when the applied search changes from outside, as MeetingFilters does.
  const applied = search ?? "";
  const [lastApplied, setLastApplied] = useState(applied);
  if (applied !== lastApplied) {
    setLastApplied(applied);
    setDraft(applied);
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = draft.trim();
    onSearchChange(trimmed ? trimmed : null);
  };

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", mb: 2 }}>
      <ScopeSwitch
        value={scope}
        onChange={onScopeChange}
        label="Whose opportunities to show"
        options={[
          { value: "mine", label: "Mine" },
          { value: "all", label: "All" },
        ]}
      />

      <Box component="form" role="search" onSubmit={submit} sx={{ flex: 1, minWidth: 220 }}>
        <TextField
          fullWidth
          size="small"
          type="search"
          label="Search"
          placeholder="Opportunity or account name"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  {draft && (
                    <IconButton
                      size="small"
                      onClick={() => {
                        setDraft("");
                        onSearchChange(null);
                      }}
                      aria-label="Clear search"
                    >
                      <XIcon size={16} />
                    </IconButton>
                  )}
                  <IconButton size="small" type="submit" aria-label="Search opportunities">
                    <SearchIcon size={16} />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      <FormControl size="small" sx={{ minWidth: 170 }} disabled={scope === "mine"}>
        <InputLabel id="deals-owner-label">Owner</InputLabel>
        <Select
          labelId="deals-owner-label"
          label="Owner"
          value={scope === "mine" ? ALL : (owner ?? ALL)}
          onChange={(event) => {
            const value = event.target.value as string;
            onOwnerChange(value === ALL ? null : value);
          }}
        >
          <MenuItem value={ALL}>All owners</MenuItem>
          {owners.map((o) => (
            <MenuItem key={o.email} value={o.email}>
              {o.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 170 }}>
        <InputLabel id="deals-stage-label">Stage</InputLabel>
        <Select
          labelId="deals-stage-label"
          label="Stage"
          value={stage ?? ALL}
          onChange={(event) => {
            const value = event.target.value as string;
            onStageChange(value === ALL ? null : value);
          }}
        >
          <MenuItem value={ALL}>All stages</MenuItem>
          {stages.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 130 }}>
        <InputLabel id="deals-region-label">Region</InputLabel>
        <Select
          labelId="deals-region-label"
          label="Region"
          value={region ?? ALL}
          onChange={(event) => {
            const value = event.target.value as string;
            onRegionChange(value === ALL ? null : value);
          }}
        >
          <MenuItem value={ALL}>All regions</MenuItem>
          {SALES_REGIONS.map((r) => (
            <MenuItem key={r} value={r}>
              {r}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControlLabel
        control={
          <Switch size="small" checked={hideClosed} onChange={(event) => onHideClosedChange(event.target.checked)} />
        }
        label="Hide closed"
        sx={{ mr: 0, whiteSpace: "nowrap" }}
      />
    </Box>
  );
}
