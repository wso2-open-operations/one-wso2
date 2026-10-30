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

import { Avatar, Box, Chip, Divider, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@wso2/oxygen-ui";
import type { Leaderboard, TopBoard } from "../api/amplifyTypes";
import type { PeopleByEmail } from "../api/useAmplifyPeople";
import { AmplifyPanel } from "./AmplifyShell";
import { nameOrUnknown } from "../api/usePersonLookup";
import HowWinnersAreChosen from "./HowWinnersAreChosen";
import PersonLink from "./PersonLink";
import TopAmplifiersPodium from "./TopAmplifiersPodium";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase() || "?";
}

/** Name and photo from One WSO2's employee data when it has the person; amplify-api's name otherwise. */
function PersonAvatar({
  email,
  fallbackName,
  people,
  size,
}: {
  email: string;
  fallbackName: string;
  people: PeopleByEmail;
  size: number;
}) {
  const person = people.get(email.toLowerCase());
  const name = nameOrUnknown(person?.name, fallbackName);
  return (
    <Avatar src={person?.photoUrl ?? undefined} alt="" sx={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(name)}
    </Avatar>
  );
}

function nameOf(email: string, fallbackName: string, people: PeopleByEmail): string {
  return nameOrUnknown(people.get(email.toLowerCase())?.name, fallbackName);
}

function pts(n: number | null | undefined): string {
  return `${(n ?? 0).toLocaleString()} pts`;
}

/** The company's top three, on a podium. */
function TopThree({ board, people }: { board: TopBoard; people: PeopleByEmail }) {
  const leaders = board.company.slice(0, 3);
  return (
    <>
      {leaders.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {board.period === "MONTH"
            ? `Nobody has reached ${(board.minPoints ?? 0).toLocaleString()} points this month yet. Amplify a post and be first on the board.`
            : "No points yet. Amplify a post and be first on the board."}
        </Typography>
      ) : (
        <TopAmplifiersPodium
          amplifiers={leaders.map((leader) => {
            const person = people.get(leader.email.toLowerCase());
            const name = nameOrUnknown(person?.name, leader.displayName);
            return {
              name,
              points: leader.points ?? 0,
              avatarUrl: person?.photoUrl ?? undefined,
              nameNode: (
                <PersonLink person={{ employeeId: leader.employeeId, displayName: leader.displayName, email: leader.email }}>
                  {name}
                </PersonLink>
              ),
            };
          })}
        />
      )}
    </>
  );
}

/** The caller's own rank, points and gap. Points only; no Coin value in phase 1. */
function MyPosition({ board }: { board: TopBoard }) {
  const me = board.me;
  const ranked = me.rank != null;
  const monthly = board.period === "MONTH";
  let tagline = monthly ? "Amplify a post this month to get on the board." : "Amplify your first post to get on the board.";
  const toQualify = board.minPoints != null && !ranked ? board.minPoints - (me.points ?? 0) : 0;
  if (monthly && toQualify > 0 && (me.points ?? 0) > 0) tagline = `${pts(toQualify)} to qualify for the top ${board.topN}.`;
  if (ranked && me.inTopN) tagline = `You're in the top ${board.topN}. Keep it up!`;
  else if (ranked && me.pointsToTopN != null) tagline = `${pts(me.pointsToTopN)} to the top ${board.topN}.`;
  else if (ranked && me.pointsToNextRank != null) tagline = `${pts(me.pointsToNextRank)} to the next rank.`;

  return (
    <>
      <Typography
        variant="overline"
        sx={{ display: "block", fontWeight: 700, letterSpacing: "0.08em", color: "text.secondary", lineHeight: 1.5, mb: 1 }}
      >
        {board.period === "MONTH" ? "My position this month" : "My position"}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: { xs: 2, sm: 4 } }}>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Rank
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {ranked ? `#${me.rank}` : "—"}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Points
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {(me.points ?? 0).toLocaleString()}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ flex: "1 1 220px" }}>
          {tagline}
        </Typography>
      </Box>
    </>
  );
}

/** One box: the company's top three, a rule, then the caller's own position. */
export function TopAmplifiersPanel({ board, people }: { board: TopBoard; people: PeopleByEmail }) {
  return (
    <AmplifyPanel
      title={board.period === "MONTH" ? "Top three amplifiers this month 🏆🎉" : "Top three amplifiers 🏆🎉"}
      ariaLabel="top-amplifiers"
    >
      <TopThree board={board} people={people} />
      {board.period === "MONTH" && board.minPoints != null && (
        <HowWinnersAreChosen minPoints={board.minPoints} topN={board.topN} />
      )}
      <Divider sx={{ my: 2 }} />
      <MyPosition board={board} />
    </AmplifyPanel>
  );
}

/** My Team, ranked within the caller's team. */
export function TeamLeaderboardPanel({ board, people }: { board: Leaderboard; people: PeopleByEmail }) {
  const team = board.myTeam;
  return (
    <AmplifyPanel title={team ? `Team leaderboard · ${team.teamName}` : "Team leaderboard"}>
      {board.teamStatus === "UNAVAILABLE" && (
        <Typography variant="body2" color="text.secondary">
          Your team&apos;s board isn&apos;t available right now. Try again later.
        </Typography>
      )}
      {board.teamStatus === "NO_TEAM" && (
        <Typography variant="body2" color="text.secondary">
          We couldn&apos;t find your team.
        </Typography>
      )}
      {board.teamStatus === "OK" && team && (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" aria-label="Team leaderboard">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 56 }}>#</TableCell>
                <TableCell>Team member</TableCell>
                <TableCell>House</TableCell>
                <TableCell align="right">Points</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {team.entries.map((entry) => (
                <TableRow
                  key={entry.employeeId}
                  selected={entry.isMe}
                  sx={entry.isMe ? { "& td": { fontWeight: 700 } } : undefined}
                >
                  <TableCell>{entry.teamRank}</TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <PersonAvatar email={entry.email} fallbackName={entry.displayName} people={people} size={24} />
                      <PersonLink person={{ employeeId: entry.employeeId, displayName: entry.displayName, email: entry.email }}>
                        {nameOf(entry.email, entry.displayName, people)}
                      </PersonLink>
                      {entry.isMe && <Chip size="small" color="primary" label="You" />}
                    </Box>
                  </TableCell>
                  <TableCell>{entry.houseName ?? "—"}</TableCell>
                  <TableCell align="right">{pts(entry.points)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </AmplifyPanel>
  );
}
