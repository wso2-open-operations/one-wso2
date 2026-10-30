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

import { useState, type ComponentType } from "react";
import { Box, InputAdornment, TextField } from "@wso2/oxygen-ui";
import {
  BriefcaseIcon,
  Link2Icon,
  PhoneIcon,
  SmartphoneIcon,
  TagIcon,
  UserRoundIcon,
  type LucideProps,
} from "@wso2/oxygen-ui-icons-react";
import { LinkedinIcon } from "@components/icons/LinkedinIcon";
import { isSafeUrl, type SignatureData } from "../util/signatureGenerator";

interface FieldDef {
  id: keyof SignatureData;
  label: string;
  icon: ComponentType<LucideProps>;
  placeholder: string;
  required?: boolean;
  /** Full row width. Half-width fields pair up two per row. */
  wide?: boolean;
  type?: string;
  helper?: string;
}

const FIELDS: readonly FieldDef[] = [
  { id: "name", label: "Full name", icon: UserRoundIcon, placeholder: "Jane Doe", required: true, wide: true },
  { id: "designation", label: "Designation", icon: BriefcaseIcon, placeholder: "Software Engineer", wide: true },
  { id: "workPhone", label: "Work phone", icon: PhoneIcon, placeholder: "+94 11 234 5678", type: "tel" },
  { id: "personalPhone", label: "Mobile phone", icon: SmartphoneIcon, placeholder: "+94 77 123 4567", type: "tel" },
  {
    id: "linkedin",
    label: "LinkedIn URL",
    icon: LinkedinIcon,
    placeholder: "https://linkedin.com/in/yourusername",
    type: "url",
    wide: true,
  },
  {
    id: "medium",
    label: "Medium URL",
    icon: Link2Icon,
    placeholder: "https://medium.com/@yourusername",
    type: "url",
    wide: true,
  },
  {
    id: "customUrl",
    label: "Custom URL",
    icon: Link2Icon,
    placeholder: "https://github.com/yourusername",
    type: "url",
    helper: "Any other link you'd like to include",
  },
  {
    id: "customUrlLabel",
    label: "Link label",
    icon: TagIcon,
    placeholder: "GitHub",
    helper: "Display name for the custom URL",
  },
];

const URL_FIELDS = new Set<keyof SignatureData>(["medium", "linkedin", "customUrl"]);

export default function SignatureFieldsForm({
  data,
  onChange,
}: {
  data: SignatureData;
  onChange: (data: SignatureData) => void;
}) {
  const [errors, setErrors] = useState<Partial<Record<keyof SignatureData, boolean>>>({});

  const handleChange = (id: keyof SignatureData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...data, [id]: e.target.value });
    if (errors[id]) setErrors((prev) => ({ ...prev, [id]: false }));
  };

  const handleBlur = (id: keyof SignatureData) => () => {
    if (URL_FIELDS.has(id) && data[id] && !isSafeUrl(data[id])) {
      setErrors((prev) => ({ ...prev, [id]: true }));
    }
  };

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
        gap: 2,
      }}
    >
      {FIELDS.map((field) => {
        const Icon = field.icon;
        // Omitted rather than a placeholder space when there's nothing to
        // say: MUI reserves a helper-text line for any non-undefined value,
        // so a blank one under every field with no helper was the real
        // source of the gap between rows, not the grid's own `gap`.
        const helperText = errors[field.id]
          ? "That doesn't look like a valid URL."
          : field.helper;
        return (
          <Box key={field.id} sx={{ gridColumn: field.wide ? { sm: "1 / -1" } : undefined }}>
            <TextField
              id={field.id}
              label={field.label}
              value={data[field.id]}
              onChange={handleChange(field.id)}
              onBlur={handleBlur(field.id)}
              placeholder={field.placeholder}
              type={field.type ?? "text"}
              required={field.required ?? false}
              variant="outlined"
              size="small"
              fullWidth
              error={Boolean(errors[field.id])}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Icon size={15} />
                    </InputAdornment>
                  ),
                },
                htmlInput: { autoComplete: "off" },
              }}
              helperText={helperText}
            />
          </Box>
        );
      })}
    </Box>
  );
}
