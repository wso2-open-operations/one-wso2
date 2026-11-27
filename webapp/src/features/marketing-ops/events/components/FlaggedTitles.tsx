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

// Settings → Events, bottom: job titles the check took as not English.
//
// Claude's answer for a title is kept for good, so one wrong "not English" would flag the
// title on every list. Here an admin sees what has been flagged and marks a title that is
// really English (a role the company uses, say "Evangelista Técnico"); no list flags it
// again.

import { useState } from "react";
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from "@wso2/oxygen-ui";
import { describeEventsError } from "../lib/serverError";
import { useFlaggedTitles, useMarkTitleEnglish } from "../../api/useEvents";
import { sinceText } from "../lib/geography";
import { quietBtn } from "./eventsStyles";

export default function FlaggedTitles() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const flagged = useFlaggedTitles(search);
  const mark = useMarkTitleEnglish();
  const items = flagged.data ?? [];

  return (
    <Box sx={{ mt: 4, pt: 3, borderTop: "1px solid", borderColor: "divider", maxWidth: 800 }}>
      <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.5 }}>Job titles flagged as not English</Typography>
      <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 1.5 }}>
        Each job title is checked once and the answer is kept, so a title wrongly taken for
        another language is flagged on every list. If a title here is English, mark it and no
        list will flag it again.
      </Typography>

      <Stack
        component="form"
        direction="row"
        spacing={1}
        sx={{ mb: 1.5 }}
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query.trim());
        }}
      >
        <TextField
          size="small"
          placeholder="Find a title"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ flex: 1, maxWidth: 360 }}
          inputProps={{ "aria-label": "Find a flagged job title" }}
        />
        <Button type="submit" size="small" sx={quietBtn}>
          Find
        </Button>
      </Stack>

      {mark.isError && (
        <Alert severity="error" sx={{ fontSize: 12.5, mb: 1.5 }}>
          {describeEventsError(mark.error)}
        </Alert>
      )}

      {flagged.isError ? (
        <Alert severity="error" sx={{ fontSize: 12.5 }}>
          Could not load the flagged titles. {describeEventsError(flagged.error)}
        </Alert>
      ) : !flagged.data ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <CircularProgress size={14} />
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>Loading…</Typography>
        </Stack>
      ) : items.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
          {search ? `No flagged title matches “${search}”.` : "No job titles have been flagged yet."}
        </Typography>
      ) : (
        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
          {items.map((t) => (
            <Stack
              component="li"
              key={t.key}
              direction="row"
              spacing={1.5}
              sx={{ alignItems: "center", py: 0.75, borderBottom: "1px solid", borderColor: "divider" }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13 }}>
                  <b>{t.title}</b> → {t.english}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                  {t.language ?? "Not English"} · flagged {sinceText(t.created_at)}
                </Typography>
              </Box>
              <Button
                size="small"
                sx={quietBtn}
                disabled={mark.isPending}
                onClick={() => mark.mutate(t.key)}
              >
                {mark.isPending && mark.variables === t.key ? "Marking…" : "It's English"}
              </Button>
            </Stack>
          ))}
        </Box>
      )}
      {items.length >= 200 && (
        <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 1 }}>
          Showing the 200 most recent. Find a title to narrow the list.
        </Typography>
      )}
    </Box>
  );
}
