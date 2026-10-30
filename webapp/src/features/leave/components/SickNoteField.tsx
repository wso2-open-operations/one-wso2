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


import { useRef, type ChangeEvent } from "react";
import { Button, Stack, Typography } from "@wso2/oxygen-ui";
import { PaperclipIcon, UploadIcon } from "@wso2/oxygen-ui-icons-react";
import { SICK_NOTE_COPY } from "../util/leaveCopy";

interface SickNoteFieldProps {
  file: File | null;
  problem: string;
  // Absent until the app config has loaded; the size is not shown without it.
  maxBytes?: number;
  contentTypes?: string[];
  onChange: (file: File | null) => void;
}

// The sick-note picker for France sick leave. Mirrors the standalone Leave
// App's SickNoteUpload; the file rules live in util/franceLeave.ts.
export default function SickNoteField({ file, problem, maxBytes, contentTypes, onChange }: SickNoteFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.files?.[0] ?? null);
    // Lets the same file be picked again after it was rejected or removed.
    event.target.value = "";
  };

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center">
        <PaperclipIcon size={16} />
        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{SICK_NOTE_COPY.title}</Typography>
      </Stack>
      <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
        {maxBytes ? SICK_NOTE_COPY.help((maxBytes / (1024 * 1024)).toFixed(1)) : SICK_NOTE_COPY.loadingLimits}
      </Typography>
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
        <input
          ref={inputRef}
          type="file"
          hidden
          accept={contentTypes?.join(",")}
          onChange={handleChange}
          data-testid="sick-note-input"
        />
        <Button
          size="small"
          variant="outlined"
          startIcon={<UploadIcon size={14} />}
          onClick={() => inputRef.current?.click()}
          sx={{ fontSize: 12, fontWeight: 600, textTransform: "none" }}
        >
          {file ? SICK_NOTE_COPY.changeFile : SICK_NOTE_COPY.chooseFile}
        </Button>
        {file && <Typography sx={{ fontSize: 12 }}>{file.name}</Typography>}
        {file && (
          <Button size="small" onClick={() => onChange(null)} sx={{ textTransform: "none" }}>
            {SICK_NOTE_COPY.remove}
          </Button>
        )}
      </Stack>
      {problem && (
        <Typography role="alert" sx={{ fontSize: 12, color: "error.main" }}>
          {problem}
        </Typography>
      )}
    </Stack>
  );
}
