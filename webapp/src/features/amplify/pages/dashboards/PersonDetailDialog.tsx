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


import { Avatar, Box, Button, Dialog, DialogContent, Divider, IconButton, Skeleton, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@wso2/oxygen-ui";
import { XIcon } from "@wso2/oxygen-ui-icons-react";
import { HttpError } from "@api/http";
import { dialogPaperSx } from "@components/confirmation-dialog/dialogPaperSx";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useDashboardPerson } from "../../api/useAmplifyDashboards";
import { usePersonLookup, type PersonRef } from "../../api/usePersonLookup";
import { Empty, PriorityPill, SectionLabel } from "../../components/DashboardParts";
import RepostGrid from "../../components/RepostGrid";
import { num, windowText } from "../../util/dashboardFormat";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase() || "?";
}

/**
 * One person's Post Performance, opened from any name an amplify_* role can click: the photo with name, team and
 * business unit, their numbers, and only the posts and categories that person reposted.
 */
export default function PersonDetailDialog({ person, onClose }: { person: PersonRef; onClose: () => void }) {
  const q = useDashboardPerson(person.employeeId);
  const lookup = usePersonLookup();
  // The popup can open before the board answers; the name Amplify holds for the person fills in then.
  const who = lookup({ ...person, displayName: q.data?.displayName ?? person.displayName, email: q.data?.email ?? person.email });
  const posts = q.data?.campaigns ?? [];
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth scroll="paper" aria-label={`${who.name} Amplify Details`} slotProps={{ paper: { sx: dialogPaperSx } }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, px: 2.5, pt: 2.5 }}>
        <Avatar src={who.photoUrl ?? undefined} alt="" sx={{ width: 64, height: 64, fontSize: 22 }}>
          {initials(who.name)}
        </Avatar>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography component="h2" sx={{ fontSize: 18, fontWeight: 700, overflowWrap: "anywhere" }}>
            {who.name} Amplify Details
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Team: {who.team ?? "-"} &nbsp; BU: {who.businessUnit ?? "-"}
          </Typography>
        </Box>
        <IconButton aria-label="Close" onClick={onClose} size="small">
          <XIcon size={18} />
        </IconButton>
      </Box>
      <DialogContent>
        {q.isPending ? (
          <Skeleton variant="rounded" height={160} />
        ) : q.isError ? (
          q.error instanceof HttpError && q.error.status === 404 ? (
            <Empty>Amplify has no activity for this person yet.</Empty>
          ) : (
            <ErrorNotice error={q.error} onRetry={() => void q.refetch()}>
              Couldn&apos;t load this person.
            </ErrorNotice>
          )
        ) : (
          q.data && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 2 }}>
                  {(
                    [
                      ["Points this month", q.data.pointsThisMonth],
                      ["Reposts", q.data.reposts],
                      ["With comments", q.data.repostsWithCommentary],
                      ["Posts reposted", posts.length],
                    ] as const
                  ).map(([label, value]) => (
                    <Box key={label} sx={{ minWidth: 0 }}>
                      <SectionLabel>{label}</SectionLabel>
                      <Typography sx={{ fontSize: 26, fontWeight: 600 }}>{num(value)}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box>
                <SectionLabel>Posts</SectionLabel>
                <Divider sx={{ my: 1 }} />
                {posts.length === 0 ? (
                  <Empty>No reposts yet.</Empty>
                ) : (
                  <Box sx={{ overflowX: "auto" }}>
                    <Table size="small" aria-label="Posts reposted by this person" sx={{ minWidth: 580 }}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Post</TableCell>
                          <TableCell>Category</TableCell>
                          <TableCell>Window</TableCell>
                          <TableCell align="right">Reposts</TableCell>
                          <TableCell align="right">Reposts/Comments</TableCell>
                          <TableCell align="right">Points</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {posts.map((p) => (
                          <TableRow key={p.campaignId}>
                            <TableCell>
                              {p.title}
                              {p.isPriority && <PriorityPill />}
                            </TableCell>
                            <TableCell>{p.categoryLabel}</TableCell>
                            <TableCell>{windowText(p.opensAt, p.closesAt)}</TableCell>
                            <TableCell align="right">{num(p.reposts)}</TableCell>
                            <TableCell align="right">{num(p.repostsWithCommentary)}</TableCell>
                            <TableCell align="right">{num(p.points)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                )}
              </Box>
              <Box>
                <SectionLabel>Reposts by category</SectionLabel>
                <Divider sx={{ my: 1 }} />
                <RepostGrid
                  label="Reposts by category by this person"
                  empty={<Empty>No reposts yet.</Empty>}
                  rows={q.data.byCategory.map((c) => ({
                    key: c.code,
                    title: c.label,
                    total: c.reposts + c.repostsWithCommentary,
                    plain: c.reposts,
                    commented: c.repostsWithCommentary,
                    points: c.points,
                  }))}
                />
              </Box>
            </Box>
          )
        )}
        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2.5 }}>
          <Button onClick={onClose} variant="outlined">
            Close
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
