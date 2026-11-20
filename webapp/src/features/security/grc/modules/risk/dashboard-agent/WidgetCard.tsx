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

import { Box, CircularProgress, Typography } from "@wso2/oxygen-ui";
import type { JSX } from "react";
import type { Widget, WidgetResult } from "./dashboardAgentApi";
import WidgetPreview from "./WidgetPreview";

interface WidgetCardProps {
  widget: Widget;
  result?: WidgetResult;
  running: boolean;
  error?: string;
  // Called when a risk link inside the card is followed.
  onNavigate?: () => void;
}

// A widget drawn inside the conversation: its title, a sentence about the
// numbers, and the numbers themselves. The chat offers no way to copy, export or
// download them, and the query behind the widget is not shown.
export default function WidgetCard({ widget, result, running, error, onNavigate }: WidgetCardProps): JSX.Element {
  return (
    <Box sx={{ mt: 1.5, p: 2, border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "background.paper" }}>
      <Typography variant="subtitle1" fontWeight={700}>
        {widget.title}
      </Typography>
      <Box sx={{ mt: 1.5 }}>
        {running && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
            <CircularProgress size={28} />
          </Box>
        )}
        {error && (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        )}
        {result?.summary && (
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            {result.summary}
          </Typography>
        )}
        {result && (
          <WidgetPreview widget={widget} result={result} hideTruncatedNote={!!result.summary} onNavigate={onNavigate} />
        )}
      </Box>
    </Box>
  );
}
