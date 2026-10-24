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

import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { Box, FormHelperText, FormLabel, useTheme } from "@wso2/oxygen-ui";
import { toLegalHtml } from "@features/sales/cado2/utils/legalRichText";

// Alignment as an inline style (style="text-align: center"), not Quill's
// own class, so it prints on the order form as it shows here. Registered
// once, for every editor.
const Quill = ReactQuill.Quill;
Quill.register(Quill.import("attributors/style/align") as never, true);

const FORMATS = ["bold", "italic", "underline", "link", "align"];

/**
 * The rich-text editor for legal texts (2026-10-24): bold, italic,
 * underline, links and paragraph alignment, nothing else. The same
 * react-quill-new as OneWSO2's other rich-text fields. A plain text from
 * before opens as paragraphs. The value is HTML; the backend cleans it to
 * the same allow-list.
 */
export default function LegalRichTextField({
  label,
  value,
  onChange,
  helperText,
  error = false,
  required = false,
  minHeight = 120,
}: {
  label: string;
  value: string;
  onChange: (html: string) => void;
  helperText?: string;
  error?: boolean;
  required?: boolean;
  minHeight?: number;
}): JSX.Element {
  const theme = useTheme();
  const palette = (theme.vars ?? theme).palette;
  const border = `1px solid ${error ? palette.error.main : `color-mix(in srgb, ${palette.text.primary} 30%, transparent)`}`;
  const quillRef = useRef<ReactQuill>(null);
  // A plain text from before shows as paragraphs.
  const [initial] = useState(() => toLegalHtml(value));

  // Quill's toolbar buttons have no names: give each a tooltip and an accessible name.
  useEffect(() => {
    const toolbar = quillRef.current?.getEditor().getModule("toolbar") as { container?: HTMLElement } | undefined;
    const container = toolbar?.container;
    if (!container) return;
    const labels: [string, string][] = [
      [".ql-bold", "Bold"],
      [".ql-italic", "Italic"],
      [".ql-underline", "Underline"],
      [".ql-link", "Link"],
      [".ql-align", "Alignment"],
      [".ql-clean", "Clear formatting"],
    ];
    for (const [selector, name] of labels) {
      container.querySelectorAll(selector).forEach((el) => {
        el.setAttribute("title", name);
        el.setAttribute("aria-label", name);
      });
    }
  }, []);

  const modules = useMemo(
    () => ({
      toolbar: [["bold", "italic", "underline", "link"], [{ align: [] }], ["clean"]],
      clipboard: { matchVisual: false },
    }),
    [],
  );

  return (
    <Box>
      <FormLabel required={required} error={error} sx={{ display: "block", mb: 0.75, fontSize: 13 }}>
        {label}
      </FormLabel>
      <Box
        aria-label={label}
        role="group"
        sx={{
          "& .quill": { border, borderRadius: 1, display: "flex", flexDirection: "column" },
          "& .ql-container.ql-snow, & .ql-toolbar.ql-snow": { border: "none" },
          "& .ql-toolbar.ql-snow": { borderBottom: border },
          "& .ql-container": { fontSize: "inherit", fontFamily: "inherit" },
          "& .ql-editor": { minHeight, padding: "10px 14px", overflowWrap: "break-word", color: `${palette.text.primary} !important`, lineHeight: 1.6 },
          "& .ql-snow .ql-stroke": { stroke: palette.text.secondary },
          "& .ql-snow .ql-fill": { fill: palette.text.secondary },
          "& .ql-snow .ql-picker": { color: palette.text.secondary },
          "& .ql-snow .ql-tooltip": { zIndex: 2 },
        }}
      >
        <ReactQuill ref={quillRef} theme="snow" defaultValue={initial} onChange={onChange} modules={modules} formats={FORMATS} />
      </Box>
      {helperText ? (
        <FormHelperText error={error} sx={{ mx: 1.75 }}>
          {helperText}
        </FormHelperText>
      ) : null}
    </Box>
  );
}
