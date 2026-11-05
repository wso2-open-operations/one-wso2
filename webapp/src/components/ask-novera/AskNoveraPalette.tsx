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

import { Box, Button, ColorSchemeImage, Dialog, Header, IconButton, Typography, alpha } from "@wso2/oxygen-ui";
import {
  ExternalLinkIcon,
  SearchIcon,
  SendIcon,
  XIcon,
} from "@wso2/oxygen-ui-icons-react";
import InputBase from "@mui/material/InputBase";
import { keyframes } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { Capability } from "@constants/appMenu";
import type { NoveraChatMessage } from "./types";
import { matchDirectory, type DirectoryEntry } from "./directoryCatalog";
import NoveraOverviewCard from "./NoveraOverviewCard";

const BRAND_TITLE_PX = 22;
const BRAND_LOGO_PX = 32;

/** Clean fade-in entry animation for follow-up user messages on Turn 3+. */
const fadeInBubble = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

/** Smooth slowed-down glide-up animation for the second turn transition. */
const glideUpSlowAnimation = keyframes`
  from {
    opacity: 0;
    transform: translateY(48px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

interface AskNoveraPaletteProps {
  /** Optional anchor element for focus restoration when closing. */
  anchorEl?: HTMLElement | null;
  /** Close callback when user clicks back/close or presses Escape. */
  onClose: () => void;
  /** Messages array from Novera chat. */
  messages: NoveraChatMessage[];
  /** Whether Novera is actively querying the backend orchestrator. */
  isLoading: boolean;
  /** Active domain bucket identified by Agent Orchestrator (e.g. LEAVE_STANDARD). */
  activeBucket: string | null;
  /** Direct directory match when user query matches an app directory directly. */
  matchedDirectory?: DirectoryEntry;
  /** Optional callback to send a follow-up message within the palette. */
  onSendMessage?: (text: string) => void;
  /** Active search query from TopBar. */
  searchQuery?: string;
  /** Callback to trigger a new search from the full-screen canvas header. */
  onSearch?: (query: string) => void;
  /** Callback to update search query in TopBar when a follow-up query is submitted. */
  onFollowUpQuery?: (query: string) => void;
  /** Callback to clear the active search and close. */
  onClear?: () => void;
  /** Optional user capabilities set for role-based catalog filtering. */
  userCaps?: Set<Capability>;
}

/**
 * Full-screen Google-style search canvas for Ask Novera.
 *
 * Dynamically themed to match all color palettes and schemes.
 * 1. Sticky top navigation bar: Symmetrically centered search bar, brand back button, and ESC exit.
 * 2. Centered content column: Novera AI Overview card with embedded follow-up input, and matched action card.
 * 3. Google-style follow-up screen wiping: Submitting a follow-up updates query and wipes previous UI turn.
 */
export default function AskNoveraPalette({
  anchorEl,
  onClose,
  messages,
  isLoading,
  activeBucket,
  matchedDirectory,
  onSendMessage,
  searchQuery,
  onSearch,
  onFollowUpQuery,
  userCaps,
}: AskNoveraPaletteProps) {
  const navigate = useNavigate();
  const [followUpText, setFollowUpText] = useState("");
  const [expandedByMessageId, setExpandedByMessageId] = useState<Record<string, boolean>>({});
  const [prevSearchQuery, setPrevSearchQuery] = useState(searchQuery);
  const [canvasQuery, setCanvasQuery] = useState(searchQuery ?? "");

  if (prevSearchQuery !== searchQuery) {
    setPrevSearchQuery(searchQuery);
    setCanvasQuery(searchQuery ?? "");
    setExpandedByMessageId({});
  }

  // Compute action entry dynamically for the active turn in multi-turn conversations
  const actionEntry = useMemo(() => {
    if (messages.length === 0) {
      return matchedDirectory;
    }

    const latestAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    const latestUser = [...messages].reverse().find((m) => m.role === "user");

    // 1. If the latest assistant response carries a domain bucket, it takes primary authority
    const bucket = latestAssistant ? latestAssistant.bucket : activeBucket;
    if (bucket) {
      const bucketMatch = matchDirectory("", bucket, userCaps);
      if (bucketMatch) {
        return bucketMatch;
      }
    }

    // 2. Fall back to matching directory keywords from the user's latest query
    if (latestUser?.text) {
      const queryMatch = matchDirectory(latestUser.text, null, userCaps);
      if (queryMatch) {
        return queryMatch;
      }
    }

    return undefined;
  }, [messages, activeBucket, matchedDirectory, userCaps]);

  const hasPendingTurn =
    isLoading || (messages.length > 0 && messages[messages.length - 1]?.role === "user");

  const showActionCard =
    !hasPendingTurn &&
    Boolean(actionEntry && actionEntry.hasWebApp && actionEntry.href && actionEntry.label);

  const panelRef = useRef<HTMLDivElement>(null);
  const canvasInputRef = useRef<HTMLInputElement>(null);
  const activeTurnRef = useRef<HTMLDivElement>(null);
  const actionCardRef = useRef<HTMLDivElement>(null);
  const scrollStageRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const followUpInputRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    // When the canvas opens, move focus into the canvas search input
    canvasInputRef.current?.focus();
  }, []);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const panel = panelRef.current;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      if (panel?.contains(document.activeElement)) {
        anchorEl?.focus();
      }
    };
  }, [anchorEl]);

  // Google AI Chat: Initial search shows query in search bar. From second user message onwards,
  // Turn 1 (initial search text and overview) is hidden, and conversation history begins from
  // the follow-up (Turn 2) and accumulates from then on.
  const userMessageCount = messages.filter((m) => m.role === "user").length;
  const isInitialSearch = userMessageCount <= 1;

  let displayMessages = messages;
  if (userMessageCount > 1) {
    let secondUserIdx = -1;
    let seenUserCount = 0;
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === "user") {
        seenUserCount++;
        if (seenUserCount === 2) {
          secondUserIdx = i;
          break;
        }
      }
    }
    if (secondUserIdx !== -1) {
      displayMessages = messages.slice(secondUserIdx);
    }
  }

  const latestAssistantMsg = [...displayMessages].reverse().find((m) => m.role === "assistant");
  const latestUserMsg = [...displayMessages].reverse().find((m) => m.role === "user");

  useEffect(() => {
    const stage = scrollStageRef.current;
    if (!stage || typeof stage.scrollTo !== "function") {
      return;
    }

    // Use rAF so layout is fully settled before measuring. On Turn 3+, history messages
    // sit above the active bubble and require scrolling the active user turn directly below the header.
    const frameId = requestAnimationFrame(() => {
      const activeTurn = activeTurnRef.current;
      if (userMessageCount > 2 && activeTurn) {
        // getBoundingClientRect gives viewport coordinates. Adding stage.scrollTop and subtracting
        // stageTop converts to container-relative coordinate, placing active turn 14px below the header.
        const stageTop = stage.getBoundingClientRect().top;
        const turnTop = activeTurn.getBoundingClientRect().top;
        const targetScrollTop = Math.max(0, stage.scrollTop + (turnTop - stageTop) - 14);
        stage.scrollTo({ top: targetScrollTop, behavior: "smooth" });
      } else {
        stage.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
    return () => cancelAnimationFrame(frameId);
  }, [messages, isLoading, userMessageCount]);

  const hasAssistantResponse = messages.some((m) => m.role === "assistant");

  // If no AI response, not loading, and no action card to show, nothing should drop down.
  if (!hasAssistantResponse && !isLoading && !showActionCard) {
    return null;
  }

  const isConversational =
    messages.length > 0 || !matchedDirectory || matchedDirectory.hasMcpCapability;
  const showFollowUpInput = Boolean(onSendMessage) && isConversational;

  const handleToggleMessageExpand = (messageId: string, next: boolean) => {
    setExpandedByMessageId((prev) => ({
      ...prev,
      [messageId]: next,
    }));
  };

  const handleFollowUpSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = followUpText.trim();
    if (trimmed && !isLoading && onSendMessage) {
      onSendMessage(trimmed);
      setFollowUpText("");
      setCanvasQuery("");
      if (onFollowUpQuery) {
        onFollowUpQuery("");
      }
    }
  };

  const handleCanvasSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = canvasQuery.trim();
    if (trimmed && onSearch) {
      onSearch(trimmed);
    }
  };

  return (
    <Dialog
      fullScreen
      open
      onClose={onClose}
      aria-label="Ask Novera Results"
      transitionDuration={0}
      PaperProps={{
        sx: {
          bgcolor: "background.default",
          backgroundColor: "var(--oxygen-palette-background-default)",
          backdropFilter: "none",
          backgroundImage: "none",
          color: "text.primary",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
      }}
    >
        {/* Sticky Top Bar: Symmetric flanks with perfectly centered search bar */}
        <Box
          sx={{
            minHeight: 64,
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "background.default",
            backgroundColor: "var(--oxygen-palette-background-default)",
            backdropFilter: "none",
            backgroundImage: "none",
            px: { xs: 2, sm: 3 },
            display: "flex",
            alignItems: "center",
            gap: { xs: 1.5, sm: 2 },
            flexShrink: 0,
            boxShadow: (t) =>
              t.palette.mode === "dark"
                ? "0 1px 3px rgba(0, 0, 0, 0.4)"
                : "0 1px 3px rgba(0, 0, 0, 0.05)",
          }}
        >
          {/* Left Flank: Brand lockup acts as back button */}
          <Box
            sx={{
              width: { xs: "auto", sm: 140, md: 160 },
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <Header.Brand sx={{ flexShrink: 0, m: 0 }}>
              <Box
                component="button"
                type="button"
                onClick={onClose}
                aria-label="Back to page"
                sx={{
                  background: "none",
                  border: "none",
                  p: 0,
                  m: 0,
                  display: "flex",
                  alignItems: "center",
                  textDecoration: "none",
                  color: "inherit",
                  cursor: "pointer",
                  borderRadius: 1,
                  flexShrink: 0,
                  "&:hover": { opacity: 0.85 },
                  "&:focus-visible": {
                    outline: 2,
                    outlineStyle: "solid",
                    outlineColor: "primary.main",
                    outlineOffset: 2,
                  },
                }}
              >
                <Header.BrandTitle sx={{ whiteSpace: "nowrap", fontSize: BRAND_TITLE_PX }}>
                  One
                </Header.BrandTitle>
                <Header.BrandLogo sx={{ ml: "-4px" }}>
                  <ColorSchemeImage
                    src={{ light: "/wso2-logo-black.svg", dark: "/wso2-logo-white.svg" }}
                    alt=""
                    height={BRAND_LOGO_PX}
                    width="auto"
                  />
                </Header.BrandLogo>
              </Box>
            </Header.Brand>
          </Box>

          {/* Center Column: Symmetrically centered search bar */}
          <Box
            sx={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
              minWidth: 0,
            }}
          >
            <Box
              component="form"
              onSubmit={handleCanvasSearchSubmit}
              sx={{
                width: "100%",
                maxWidth: 720,
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                bgcolor: "action.hover",
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                px: 1.75,
                py: 0.5,
                transition: "border-color .15s, box-shadow .15s",
                "&:hover": { borderColor: "text.disabled" },
                "&:focus-within": {
                  borderColor: "primary.main",
                  boxShadow: (t) =>
                    `0 0 0 1px ${
                      t.vars
                        ? `rgba(${t.vars.palette.primary.mainChannel} / ${t.palette.mode === "dark" ? 0.45 : 0.25})`
                        : alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.45 : 0.25)
                    }`,
                },
              }}
            >
              <SearchIcon
                size={16}
                style={{
                  flexShrink: 0,
                  color: "var(--oxygen-palette-text-secondary, currentColor)",
                }}
              />
              <InputBase
                autoFocus
                inputRef={canvasInputRef}
                value={canvasQuery}
                onChange={(e) => setCanvasQuery(e.target.value)}
                placeholder="Search or ask Novera..."
                inputProps={{ "aria-label": "Search query" }}
                sx={{
                  flex: 1,
                  fontSize: 14,
                  color: "text.primary",
                  "& input": { p: 0 },
                }}
              />
              {canvasQuery ? (
                <IconButton
                  size="small"
                  onClick={() => {
                    setCanvasQuery("");
                  }}
                  aria-label="Clear query"
                  sx={{ p: 0.25, color: "text.secondary" }}
                >
                  <XIcon size={14} />
                </IconButton>
              ) : null}
            </Box>
          </Box>

          {/* Right Flank: ESC key indicator */}
          <Box
            sx={{
              width: { xs: "auto", sm: 140, md: 160 },
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              flexShrink: 0,
            }}
          >
            <Box
              component="button"
              type="button"
              onClick={onClose}
              aria-label="Close search (Esc)"
              sx={{
                cursor: "pointer",
                bgcolor: "action.hover",
                border: 1,
                borderColor: "divider",
                borderRadius: 0.75,
                px: 1.25,
                py: 0.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background-color .15s, border-color .15s",
                "&:hover": {
                  bgcolor: "action.selected",
                  borderColor: "text.disabled",
                },
                "&:focus-visible": {
                  outline: 2,
                  outlineStyle: "solid",
                  outlineColor: "primary.main",
                },
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 0.5,
                  lineHeight: 1,
                }}
              >
                ESC
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Scrollable Stage: centered full-width column */}
        <Box
          ref={scrollStageRef}
          sx={{
            flex: 1,
            position: "relative",
            overflowY: "auto",
            scrollBehavior: "smooth",
            px: { xs: 2, sm: 3, md: 4 },
            pt: 2.5,
            pb: userMessageCount > 1 ? "calc(100vh - 160px)" : 3,
          }}
        >
          <Box
            sx={{
              maxWidth: 820,
              width: "100%",
              mx: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {/* Conversation Stream (history starts from 2nd user query and accumulates from then on) */}
            {displayMessages.map((m) => {
              if (m.role === "user") {
                // On initial search, query is already in the top search bar
                if (isInitialSearch) {
                  return null;
                }
                const isLatestUser = m.id === latestUserMsg?.id;
                const isSecondTurn = userMessageCount === 2 && isLatestUser;
                return (
                  <Box
                    key={m.id}
                    ref={isLatestUser ? activeTurnRef : undefined}
                    sx={{
                      alignSelf: "flex-end",
                      maxWidth: "85%",
                      px: 2.25,
                      py: 1.1,
                      borderRadius: "18px 0px 18px 18px",
                      bgcolor: (t) =>
                        t.vars
                          ? `rgba(${t.vars.palette.primary.mainChannel} / ${t.palette.mode === "dark" ? 0.16 : 0.08})`
                          : alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.16 : 0.08),
                      border: 1,
                      borderColor: (t) =>
                        t.vars
                          ? `rgba(${t.vars.palette.primary.mainChannel} / ${t.palette.mode === "dark" ? 0.3 : 0.2})`
                          : alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.3 : 0.2),
                      wordBreak: "break-word",
                      animation: isSecondTurn
                        ? `${glideUpSlowAnimation} 0.85s cubic-bezier(0.16, 1, 0.3, 1) both`
                        : isLatestUser
                          ? `${fadeInBubble} 0.24s cubic-bezier(0.16, 1, 0.3, 1) both`
                          : "none",
                      "@media (prefers-reduced-motion: reduce)": {
                        animation: "none",
                      },
                    }}
                  >
                    <Typography sx={{ fontSize: 13.5, fontWeight: 500, color: "text.primary" }}>
                      {m.text}
                    </Typography>
                  </Box>
                );
              }
              const isMsgExpanded = expandedByMessageId[m.id] ?? false;
              const isLatestAssistant = m.id === latestAssistantMsg?.id;
              return (
                <NoveraOverviewCard
                  key={m.id}
                  text={m.text}
                  expanded={isMsgExpanded}
                  hasActionCard={isLatestAssistant && showActionCard}
                  hasUserMessageAbove={!isInitialSearch}
                  onToggleExpand={(next) => handleToggleMessageExpand(m.id, next)}
                >
                  {/* Embedded follow-up input bar inside the latest overview reply */}
                  {isLatestAssistant && showFollowUpInput && !isLoading && (
                    <Box
                      component="form"
                      onSubmit={handleFollowUpSubmit}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.25,
                        bgcolor: (t) =>
                          t.vars
                            ? `rgba(${t.vars.palette.primary.mainChannel} / ${t.palette.mode === "dark" ? 0.08 : 0.04})`
                            : alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.08 : 0.04),
                        border: 1,
                        borderColor: (t) =>
                          t.vars
                            ? `rgba(${t.vars.palette.primary.mainChannel} / ${t.palette.mode === "dark" ? 0.3 : 0.2})`
                            : alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.3 : 0.2),
                        borderRadius: 1,
                        px: 2,
                        py: 0.75,
                        mt: 0.5,
                        transition: "border-color .15s, box-shadow .15s",
                        "&:hover": { borderColor: "text.disabled" },
                        "&:focus-within": {
                          borderColor: "primary.main",
                          boxShadow: (t) =>
                            `0 0 0 1px ${
                              t.vars
                                ? `rgba(${t.vars.palette.primary.mainChannel} / ${
                                    t.palette.mode === "dark" ? 0.45 : 0.25
                                  })`
                                : alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.45 : 0.25)
                            }`,
                        },
                      }}
                    >
                      <InputBase
                        inputRef={followUpInputRef}
                        placeholder="Ask a follow-up..."
                        value={followUpText}
                        onChange={(e) => setFollowUpText(e.target.value)}
                        disabled={isLoading}
                        inputProps={{ "aria-label": "Ask a follow-up" }}
                        sx={{
                          flex: 1,
                          fontSize: 13.5,
                          color: "text.primary",
                          "& input": { p: 0 },
                        }}
                      />
                      <IconButton
                        type="submit"
                        size="small"
                        disabled={!followUpText.trim() || isLoading}
                        aria-label="Send follow-up"
                        sx={{
                          color: "primary.main",
                          p: 0.75,
                          "&.Mui-disabled": { color: "text.disabled" },
                        }}
                      >
                        <SendIcon size={16} />
                      </IconButton>
                    </Box>
                  )}
                </NoveraOverviewCard>
              );
            })}

            {isLoading && (
              <Box
                sx={{
                  animation:
                    userMessageCount === 2
                      ? `${glideUpSlowAnimation} 0.85s cubic-bezier(0.16, 1, 0.3, 1) both`
                      : `${fadeInBubble} 0.24s cubic-bezier(0.16, 1, 0.3, 1) both`,
                  "@media (prefers-reduced-motion: reduce)": {
                    animation: "none",
                  },
                }}
              >
                <NoveraOverviewCard key="loading" text="" isLoading={true} />
              </Box>
            )}

            {/* Matched Directory Action Button Card (Leave, Cafeteria, Subscriptions, etc.) */}
            {showActionCard && actionEntry && actionEntry.href && actionEntry.label && (
              <Box
                ref={actionCardRef}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 2,
                  p: 2,
                  borderRadius: 1,
                  bgcolor: (t) =>
                    t.vars
                      ? `rgba(${t.vars.palette.primary.mainChannel} / ${t.palette.mode === "dark" ? 0.08 : 0.04})`
                      : alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.08 : 0.04),
                  border: 1,
                  borderColor: (t) =>
                    t.vars
                      ? `rgba(${t.vars.palette.primary.mainChannel} / ${t.palette.mode === "dark" ? 0.25 : 0.15})`
                      : alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.25 : 0.15),
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.75,
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <Box
                    sx={{
                      display: "grid",
                      placeItems: "center",
                      width: 40,
                      height: 40,
                      borderRadius: 0.75,
                      flexShrink: 0,
                      bgcolor: (t) =>
                        t.vars
                          ? `rgba(${t.vars.palette.primary.mainChannel} / ${t.palette.mode === "dark" ? 0.2 : 0.1})`
                          : alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.2 : 0.1),
                      color: "primary.main",
                    }}
                  >
                    <actionEntry.icon size={20} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      sx={{
                        fontSize: 14,
                        fontWeight: 600,
                        lineHeight: 1.3,
                        color: "text.primary",
                      }}
                    >
                      {actionEntry.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: 12.5,
                        color: "text.secondary",
                        lineHeight: 1.35,
                        mt: 0.25,
                      }}
                    >
                      {actionEntry.hint}
                    </Typography>
                  </Box>
                </Box>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => {
                    if (actionEntry.href) {
                      navigate(actionEntry.href);
                      onClose();
                    }
                  }}
                  endIcon={<ExternalLinkIcon size={14} style={{ display: "block" }} />}
                  sx={{
                    borderRadius: 1,
                    textTransform: "none",
                    fontWeight: 600,
                    fontSize: 13,
                    px: 2,
                    py: 0.75,
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1.3,
                    boxShadow: "none",
                    "& .MuiButton-endIcon": {
                      ml: 0.75,
                      mr: 0,
                      display: "inline-flex",
                      alignItems: "center",
                    },
                  }}
                >
                  {actionEntry.label}
                </Button>
              </Box>
            )}

            <div ref={messagesEndRef} />
          </Box>
        </Box>
    </Dialog>
  );
}
