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

import {
  Alert,
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { Maximize2, Minimize2, RotateCcw, Send, Sparkles, X } from "@wso2/oxygen-ui-icons-react";
import { useEffect, useRef, useState } from "react";
import { useInRouterContext } from "react-router";
import type { JSX } from "react";
import { useAuthApiClient } from "@features/security/grc/shim/useAuthApiClient";
import {
  interpretWidget,
  MAX_HISTORY_TURNS,
  MAX_MESSAGE_LENGTH,
  runWidget,
  type AssistantHub,
  type CompareTable,
  type ControlLinkRef,
  type ControlTarget,
  type RiskLink as RiskLinkRef,
  type Timeline,
  type Widget,
  type WidgetResult,
} from "./dashboardAgentApi";
import GoToControl from "./GoToControl";
import ControlLink from "./ControlLink";
import RiskCompare from "./RiskCompare";
import RiskLink from "./RiskLink";
import RiskTimeline from "./RiskTimeline";
import WidgetCard from "./WidgetCard";

interface DashboardAgentDialogProps {
  open: boolean;
  onClose: () => void;
  hub?: AssistantHub;
}

// What the popup says, per hub.
const COPY: Record<AssistantHub, { title: string; heading: string; sub: string; placeholder: string }> = {
  risk: {
    title: "Risk assistant",
    heading: "Ask me anything about your risks",
    sub: "I can answer with numbers, tables and charts, and only ever use the risks you have access to.",
    placeholder: "Ask anything about your risks…",
  },
  audit: {
    title: "Audit assistant",
    heading: "Ask me anything about your audits",
    sub: "I can answer with numbers, tables and charts about audits, controls and evidence, and only ever use the audit data you have access to.",
    placeholder: "Ask anything about your audits…",
  },
};

// One message in the conversation. An assistant message may carry a widget,
// which is drawn under its text once the numbers arrive.
interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  note?: string;
  riskLink?: RiskLinkRef;
  timeline?: Timeline;
  // navigate: a control to take the user to; cleared once they have been taken.
  navigate?: ControlTarget;
  controlLink?: ControlLinkRef;
  // plain: the answer is just its sentence; the widget is kept for follow-ups only.
  plain?: boolean;
  compare?: CompareTable;
  widget?: Widget;
  result?: WidgetResult;
  running?: boolean;
  error?: string;
}

// describeError turns a failed call into something a user can act on. The
// backend's own messages for a bad request are written for them; anything else
// stays generic.
function describeError(err: unknown): string {
  const status = (err as { status?: number }).status;
  if (status === 429) return "You're going a little fast. Wait a minute and try again.";
  if (status === 400 && err instanceof Error && err.message) return err.message;
  if (status === 404) return "The assistant isn't available to you right now.";
  if (status === 503) return "The assistant is temporarily unavailable. Please try again in a moment.";
  return "Something went wrong. Please try again.";
}

// The Risk Hub assistant: a chat. By default it just talks; when the user asks
// to see data it answers with a number, table or chart inside the conversation.
// The backend works out what to build and applies what this user may see; the
// popup only carries the conversation and draws what comes back.
export default function DashboardAgentDialog({ open, onClose, hub = "risk" }: DashboardAgentDialogProps): JSX.Element {
  const copy = COPY[hub];
  const inRouter = useInRouterContext();
  const authFetch = useAuthApiClient();
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const nextId = useRef(1);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages, thinking, error]);

  const add = (m: Omit<ChatMessage, "id">): number => {
    const id = nextId.current++;
    setMessages((all) => [...all, { ...m, id }]);
    return id;
  };
  const update = (id: number, patch: Partial<ChatMessage>): void => {
    setMessages((all) => all.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const fetchResult = async (id: number, widget: Widget): Promise<void> => {
    try {
      const result = await runWidget(authFetch, widget.spec, hub);
      // A single number needs no card: the sentence says it. The widget is kept
      // so a follow-up ("only the high ones") can still refine it.
      if (widget.visual === "kpi" && widget.spec.dimensions.length === 0 && result.summary) {
        update(id, { result, running: false, plain: true, text: result.summary, note: undefined });
      } else {
        update(id, { result, running: false });
      }
    } catch (err) {
      update(id, { running: false, error: describeError(err) });
    }
  };

  const send = async (): Promise<void> => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput("");
    setError(null);

    // What the assistant is told: the last few turns, and the widget being
    // discussed, so "split by quarter" edits it.
    const history = messages
      .slice(-MAX_HISTORY_TURNS)
      .map((m) => ({ role: m.role, text: m.text.slice(0, MAX_MESSAGE_LENGTH) }));
    const current = [...messages].reverse().find((m) => m.widget)?.widget;

    add({ role: "user", text });
    setThinking(true);
    try {
      const res = await interpretWidget(authFetch, { message: text, history, current }, hub);
      if (res.action === "reply") {
        add({ role: "assistant", text: res.message, riskLink: res.risk_link, timeline: res.timeline, compare: res.compare, navigate: res.navigate, controlLink: res.control_link });
      } else if (res.action === "clarify") {
        add({ role: "assistant", text: res.question });
      } else if (res.action === "unsupported") {
        add({ role: "assistant", text: res.message });
      } else {
        const id = add({
          role: "assistant",
          text: "Here you go.",
          note: res.note,
          widget: res.widget,
          running: true,
        });
        void fetchResult(id, res.widget);
      }
    } catch (err) {
      setError(describeError(err));
    } finally {
      setThinking(false);
    }
  };

  const reset = (): void => {
    setMessages([]);
    setInput("");
    setError(null);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={expanded} aria-labelledby="risk-assistant-title">
      <DialogTitle id="risk-assistant-title" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Sparkles size={20} />
        <Box sx={{ flexGrow: 1 }}>{copy.title}</Box>
        <Tooltip title="Start over">
          <span>
            <IconButton aria-label="Start over" onClick={reset} disabled={messages.length === 0}>
              <RotateCcw size={18} />
            </IconButton>
          </span>
        </Tooltip>
        <IconButton aria-label={expanded ? "Exit full screen" : "Expand"} onClick={() => setExpanded((e) => !e)}>
          {expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </IconButton>
        <IconButton aria-label="Close" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ p: 0, display: "flex", flexDirection: "column", height: expanded ? "calc(100vh - 140px)" : 580 }}>
        <Box ref={scroller} sx={{ flexGrow: 1, overflowY: "auto", p: 2.5 }}>
          {messages.length === 0 && !error && (
            <Box sx={{ textAlign: "center", color: "text.secondary", pt: 8 }}>
              <Typography variant="h6" color="text.primary">
                {copy.heading}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                {copy.sub}
              </Typography>
            </Box>
          )}
          <Stack spacing={1.5}>
            {messages.map((m) => (
              <Box key={m.id} sx={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    maxWidth: (m.widget && !m.plain) || m.compare ? "100%" : "85%",
                    width: (m.widget && !m.plain) || m.compare ? "100%" : "auto",
                    bgcolor: m.role === "user" ? "action.hover" : "background.paper",
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {m.text}
                  </Typography>
                  {m.note && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                      {m.note}
                    </Typography>
                  )}
                  {m.riskLink && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      <RiskLink id={m.riskLink.id} onNavigate={onClose}>
                        Open {m.riskLink.code} in Risk Registers
                      </RiskLink>
                    </Typography>
                  )}
                  {m.navigate && inRouter && (
                    <GoToControl
                      target={m.navigate}
                      onDone={() => {
                        update(m.id, { navigate: undefined });
                        onClose();
                      }}
                    />
                  )}
                  {m.controlLink && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      <ControlLink auditId={m.controlLink.audit_id} controlId={m.controlLink.control_id} onNavigate={onClose}>
                        Open {m.controlLink.code} in the Audit Hub
                      </ControlLink>
                    </Typography>
                  )}
                  {m.timeline && <RiskTimeline timeline={m.timeline} />}
                  {m.compare && <RiskCompare compare={m.compare} onNavigate={onClose} />}
                  {m.widget && !m.plain && (
                    <WidgetCard
                      widget={m.widget}
                      result={m.result}
                      running={!!m.running}
                      error={m.error}
                      onNavigate={onClose}
                    />
                  )}
                </Paper>
              </Box>
            ))}
            {thinking && (
              <Stack direction="row" gap={1} alignItems="center">
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Thinking…
                </Typography>
              </Stack>
            )}
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
          </Stack>
        </Box>
        <Divider />
        <Box sx={{ p: 1.5 }}>
          <Stack direction="row" gap={1} alignItems="flex-end">
            <TextField
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={copy.placeholder}
              multiline
              maxRows={4}
              fullWidth
              size="small"
              slotProps={{ htmlInput: { maxLength: MAX_MESSAGE_LENGTH, "aria-label": "Your request" } }}
            />
            <IconButton aria-label="Send" color="primary" onClick={() => void send()} disabled={!input.trim() || thinking}>
              <Send size={18} />
            </IconButton>
          </Stack>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
