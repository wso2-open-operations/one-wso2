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

import type { ReactNode } from "react";
import { Avatar, Box, Typography } from "@wso2/oxygen-ui";

export interface Amplifier {
  name: string;
  points: number;
  avatarUrl?: string;
  /** Shown in place of the plain name, e.g. a link that opens the person's popup. */
  nameNode?: ReactNode;
}

interface TopAmplifiersPodiumProps {
  /** Up to three leaders, already sorted: [1st, 2nd, 3rd]. Missing places leave their slot off. */
  amplifiers: Amplifier[];
}

const MEDALS = {
  1: {
    ring: "linear-gradient(145deg, #FFE08A 0%, #F5B82E 45%, #B9810F 100%)",
    glow: "rgba(245, 184, 46, 0.55)",
    solid: "#F5B82E",
    label: "1st",
  },
  2: {
    ring: "linear-gradient(145deg, #F4F7FA 0%, #B8C2CC 50%, #7D8893 100%)",
    glow: "rgba(184, 194, 204, 0.35)",
    solid: "#B8C2CC",
    label: "2nd",
  },
  3: {
    ring: "linear-gradient(145deg, #F0B27A 0%, #CD7F32 50%, #8A4F1A 100%)",
    glow: "rgba(205, 127, 50, 0.4)",
    solid: "#CD7F32",
    label: "3rd",
  },
} as const;

type Rank = keyof typeof MEDALS;

// Avatar diameters. The old avatars were ~48px, so 144px is the 3x ask.
// #1 gets a little extra so it leads. Values shrink on small screens.
const AVATAR_SIZE: Record<Rank, { xs: number; sm: number }> = {
  1: { xs: 104, sm: 160 },
  2: { xs: 88, sm: 144 },
  3: { xs: 88, sm: 144 },
};

// Pedestal heights create the podium silhouette.
const PEDESTAL_HEIGHT: Record<Rank, { xs: number; sm: number }> = {
  1: { xs: 72, sm: 104 },
  2: { xs: 52, sm: 76 },
  3: { xs: 36, sm: 56 },
};

function Crown() {
  return (
    <Box
      component="svg"
      viewBox="0 0 64 44"
      aria-hidden
      sx={{
        position: "absolute",
        top: { xs: -30, sm: -44 },
        left: "50%",
        transform: "translateX(-50%)",
        width: { xs: 44, sm: 64 },
        filter: "drop-shadow(0 4px 10px rgba(245, 184, 46, 0.6))",
        zIndex: 2,
      }}
    >
      <defs>
        <linearGradient id="crownGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE08A" />
          <stop offset="1" stopColor="#D9961A" />
        </linearGradient>
      </defs>
      <path
        d="M4 38 L8 12 L22 24 L32 6 L42 24 L56 12 L60 38 Z"
        fill="url(#crownGold)"
        stroke="#B9810F"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="11" r="3.2" fill="#FFE08A" />
      <circle cx="32" cy="5" r="3.6" fill="#FFE08A" />
      <circle cx="56" cy="11" r="3.2" fill="#FFE08A" />
      <rect x="4" y="36" width="56" height="5" rx="2" fill="#B9810F" />
    </Box>
  );
}

function PodiumSlot({ rank, person }: { rank: Rank; person: Amplifier }) {
  const medal = MEDALS[rank];
  const size = AVATAR_SIZE[rank];
  const ringWidth = rank === 1 ? 6 : 5;
  const parts = person.name.trim().split(/\s+/).filter(Boolean);
  const initials =
    ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase() || "?";

  return (
    <Box
      component="li"
      sx={{
        listStyle: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flex: 1,
        minWidth: 0,
      }}
    >
      {/* Avatar + ring + crown */}
      <Box sx={{ position: "relative", mb: 1.5, mt: rank === 1 ? { xs: 3.5, sm: 5.5 } : 0 }}>
        {rank === 1 && <Crown />}
        <Box
          sx={{
            p: `${ringWidth}px`,
            borderRadius: "50%",
            background: medal.ring,
            boxShadow: `0 0 ${rank === 1 ? 36 : 22}px ${medal.glow}`,
          }}
        >
          <Avatar
            src={person.avatarUrl}
            alt={person.name}
            sx={{
              width: size,
              height: size,
              fontSize: { xs: 28, sm: 44 },
              fontWeight: 700,
              border: "4px solid",
              borderColor: "background.paper",
              bgcolor: "action.selected",
              color: "text.primary",
            }}
          >
            {initials}
          </Avatar>
        </Box>
      </Box>

      {/* Name */}
      <Typography
        noWrap
        sx={{
          maxWidth: "100%",
          fontSize: { xs: 14, sm: 18 },
          fontWeight: 600,
          color: "text.primary",
        }}
      >
        {person.nameNode ?? person.name}
      </Typography>

      {/* Points: the hero number */}
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, mb: 1.5 }}>
        <Typography
          component="span"
          sx={{
            fontSize: rank === 1 ? { xs: 40, sm: 64 } : { xs: 30, sm: 44 },
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            color: medal.solid,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {person.points.toLocaleString()}
        </Typography>
        <Typography
          component="span"
          sx={{ fontSize: { xs: 12, sm: 14 }, color: "text.secondary" }}
        >
          pts
        </Typography>
      </Box>

      {/* Pedestal */}
      <Box
        sx={{
          width: "100%",
          height: PEDESTAL_HEIGHT[rank],
          borderRadius: "14px 14px 0 0",
          background: `linear-gradient(180deg, ${medal.glow} 0%, transparent 100%)`,
          borderTop: `3px solid ${medal.solid}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography
          sx={{
            fontSize: { xs: 22, sm: 32 },
            fontWeight: 800,
            color: medal.solid,
            opacity: 0.9,
          }}
        >
          {medal.label}
        </Typography>
      </Box>
    </Box>
  );
}

export default function TopAmplifiersPodium({ amplifiers }: TopAmplifiersPodiumProps) {
  const [first, second, third] = amplifiers;
  if (!first) return null;

  return (
    <Box
      component="ol"
      aria-label="Top three amplifiers"
      sx={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: { xs: 1, sm: 3 },
        m: 0,
        p: 0,
        maxWidth: 760,
        mx: "auto",
      }}
    >
      {/* Visual order is 2nd, 1st, 3rd. DOM order stays 2, 1, 3 to match. */}
      {second && <PodiumSlot rank={2} person={second} />}
      <PodiumSlot rank={1} person={first} />
      {third && <PodiumSlot rank={3} person={third} />}
    </Box>
  );
}

