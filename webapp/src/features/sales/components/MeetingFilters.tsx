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
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
} from "@wso2/oxygen-ui";
import { SearchIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import type { MeetingScope } from "../api/salesTypes";
import ScopeSwitch from "./ScopeSwitch";

const ALL_REGIONS = "__all__";

/**
 * The three filters above the list: scope, region and title search.
 *
 * Both scopes are past meetings only: Echo is what the calendar add-on recorded,
 * All adds every other way a meeting got in. Region is disabled under Echo —
 * add-on meetings carry no region yet, so any pick would empty the list.
 *
 * Search is a FORM rather than a text field with a keydown handler. Submitting
 * on Enter then comes for free and works the same as clicking the button.
 *
 * The typed query is deliberately NOT applied on every keystroke. Each change
 * is a round trip with server-side paging behind it, so searching as you type
 * would fire a request per character and race their responses.
 *
 * One box, several columns: the backend matches the term against title, account
 * owner, account name, call type and the opportunity's customer name. 
 */
export default function MeetingFilters({
  scope,
  onScopeChange,
  region,
  onRegionChange,
  regions,
  regionsLoading,
  regionDisabled = false,
  search,
  onSearchChange,
  disabled,
}: {
  scope: MeetingScope;
  onScopeChange: (scope: MeetingScope) => void;
  region: string | null;
  onRegionChange: (region: string | null) => void;
  regions: string[];
  regionsLoading: boolean;
  /** Grey out the region filter (the page resets it to every region). */
  regionDisabled?: boolean;
  /** The APPLIED search, not the draft. */
  search: string | null;
  onSearchChange: (search: string | null) => void;
  disabled?: boolean;
}) {
  // Draft lives here; only submitting lifts it to the page.
  const [draft, setDraft] = useState(search ?? "");

  // Resync when the APPLIED search changes from outside this component.
  //
  // `useState(search ?? "")` seeds the box once and then ignores the prop for ever, so the
  // input and the applied filter can drift apart: a "clear all filters" control, or a deep
  // link arriving with a query, would change `search` while the box kept showing whatever
  // was last typed. 
  // Adjusted during render rather than in an effect, the same way MeetingDetailPage resets
  // the player clock.
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

  const clear = () => {
    setDraft("");
    onSearchChange(null);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 2,
        alignItems: "center",
        mb: 2,
      }}
    >
      <ScopeSwitch
        value={scope}
        onChange={onScopeChange}
        label="Which meetings to show"
        disabled={disabled}
        options={[
          { value: "echo", label: "Echo" },
          { value: "all", label: "All" },
        ]}
      />

      {/* The span is required: a disabled control fires no pointer events and takes no
          focus, so without it the tooltip explaining WHY it is disabled never appears.
          While disabled the span is focusable, and describeChild makes the tooltip its
          accessible description, so keyboard and screen-reader users get it too. */}
      <Tooltip
        title={regionDisabled ? "Region isn't available for Echo meetings yet" : ""}
        describeChild
        arrow
      >
        <Box component="span" sx={{ display: "inline-flex" }} tabIndex={regionDisabled ? 0 : undefined}>
          <FormControl
            size="small"
            sx={{ minWidth: 180 }}
            disabled={disabled || regionsLoading || regionDisabled}
          >
            <InputLabel id="sales-region-label">Region</InputLabel>
            <Select
              labelId="sales-region-label"
              label="Region"
              value={region ?? ALL_REGIONS}
              onChange={(event) => {
                const value = event.target.value as string;
                onRegionChange(value === ALL_REGIONS ? null : value);
              }}
            >
              {/* "All" is a sentinel rather than an empty string: an empty value
                  would render the Select as unset and float its label oddly. */}
              <MenuItem value={ALL_REGIONS}>All regions</MenuItem>
              {regions.map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Tooltip>

      <Box component="form" role="search" onSubmit={submit} sx={{ flex: 1, minWidth: 240 }}>
        <TextField
          fullWidth
          size="small"
          type="search"
          label="Search"
          placeholder="Title, account, call type or owner"
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  {draft && (
                    <IconButton size="small" onClick={clear} aria-label="Clear search">
                      <XIcon size={16} />
                    </IconButton>
                  )}
                  <IconButton size="small" type="submit" aria-label="Search meetings">
                    <SearchIcon size={16} />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>
    </Box>
  );
}
