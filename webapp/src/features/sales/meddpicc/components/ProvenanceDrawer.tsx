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

import { Link as RouterLink } from "react-router";
import { Box, Chip, Drawer, IconButton, Link, Stack, Typography } from "@wso2/oxygen-ui";
import { CheckIcon, ExternalLinkIcon, MailIcon, MinusIcon, NotebookPenIcon, VideoIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import { formatDateTime } from "../../util/salesTime";
import { meetingPath } from "../../util/salesPaths";
import type { DealDetail, DealField, EvidenceSourceType } from "../types";
import { confidenceWord, formatFieldValue, heardLabel, isEmptyValue, isRoleProposal } from "../util/meddpiccFormat";
import { callsBehind, explainProposal, groupBySource } from "../util/provenance";
import EvidenceItem from "./EvidenceItem";
import { Compare, FallbackNote } from "./DealFieldRow";
import EchoMarker from "./EchoMarker";

const SOURCE_ICON: Record<EvidenceSourceType, typeof VideoIcon> = { CALL: VideoIcon, EMAIL: MailIcon, ACTIVITY: NotebookPenIcon };
const SOURCE_NAME: Record<EvidenceSourceType, string> = { CALL: "Call", EMAIL: "Email", ACTIVITY: "Salesforce note" };

/**
 * Where an AI suggestion came from, in full, beside the page rather than in it: the
 * values compared, how Echo got there, every quote grouped by the call or record it was
 * said in (each a way back to the recording), the Contacts weighed for a role, and which
 * of the deal's calls fed it. The card keeps one quote; this keeps everything.
 */
export default function ProvenanceDrawer({
  field,
  detail,
  open,
  onClose,
}: {
  /** The field whose suggestion is explained; null closes with nothing to show. */
  field: DealField | null;
  detail: DealDetail;
  open: boolean;
  onClose: () => void;
}) {
  const proposal = field?.proposal ?? null;
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        role: "dialog",
        "aria-labelledby": "meddpicc-provenance-title",
        sx: { width: { xs: "100vw", sm: 560 }, maxWidth: "100vw" },
      }}
    >
      {field && proposal && (
        <Box sx={{ p: 2.5, pb: 4 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography id="meddpicc-provenance-title" variant="h6" component="h2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                Where this came from
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 0.5, flexWrap: "wrap", rowGap: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {field.label}
                </Typography>
                <EchoMarker confidence={proposal.confidence} />
                <Typography variant="caption" color="text.secondary">
                  {confidenceWord(proposal.confidence)} confidence · {Math.round(proposal.confidence * 100)}%
                </Typography>
              </Stack>
            </Box>
            <IconButton size="small" onClick={onClose} aria-label="Close">
              <XIcon size={18} />
            </IconButton>
          </Stack>

          <Section title="The suggestion">
            <Compare
              before={field.notInSalesforce ? null : isEmptyValue(field.salesforceValue) ? "Empty" : formatFieldValue(field.salesforceValue)}
              after={formatFieldValue(proposal.value)}
              afterLabel={heardLabel(field)}
              confidence={proposal.confidence}
            />
            <FallbackNote proposal={proposal} />
            {proposal.rationale && (
              <Typography variant="body2" sx={{ mt: 1.25 }}>
                {proposal.rationale}
              </Typography>
            )}
          </Section>

          <Section title="How Echo got here">
            {/* Said outright, because it is the reason this list can be trusted: these are
                checks Echo runs on the evidence, not more words from the AI. */}
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
              Checked by Echo against the evidence, not written by the AI.
            </Typography>
            <Stack component="ul" spacing={0.5} sx={{ pl: 2.25, m: 0 }}>
              {explainProposal(field, detail).map((fact) => (
                <Typography key={fact} component="li" variant="body2">
                  {fact}
                </Typography>
              ))}
            </Stack>
          </Section>

          <Section title={`Every quote (${proposal.evidence.length})`}>
            {proposal.evidence.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                None.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {groupBySource(proposal.evidence).map((group) => {
                  const Icon = SOURCE_ICON[group.source.type] ?? VideoIcon;
                  const meetingId = group.source.type === "CALL" ? Number(group.source.id) : NaN;
                  return (
                    <Box key={`${group.source.type}-${group.source.id}`} component="section" aria-label={group.source.title}>
                      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 0.75, color: "text.secondary" }}>
                        <Icon size={14} aria-hidden />
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {SOURCE_NAME[group.source.type]}
                        </Typography>
                        <Typography variant="caption">·</Typography>
                        {Number.isFinite(meetingId) && meetingId > 0 ? (
                          <Link component={RouterLink} to={meetingPath(meetingId, { tab: "meddpicc" })} variant="caption" underline="hover">
                            {group.source.title}
                          </Link>
                        ) : group.source.url ? (
                          <Link href={group.source.url} target="_blank" rel="noopener noreferrer" variant="caption" underline="hover" sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}>
                            {group.source.title} <ExternalLinkIcon size={11} />
                          </Link>
                        ) : (
                          <Typography variant="caption">{group.source.title}</Typography>
                        )}
                        <Typography variant="caption">· {formatDateTime(group.source.occurredAt)}</Typography>
                      </Stack>
                      <Stack spacing={1} component="ul" sx={{ listStyle: "none", p: 0, m: 0 }}>
                        {group.quotes.map((quote, i) => (
                          <li key={`${quote.offsetSeconds}-${i}`}>
                            <EvidenceItem quote={quote} />
                          </li>
                        ))}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Section>

          {field.kind === "role" && isRoleProposal(proposal.value) && (
            <Section title="Contacts considered">
              {proposal.value.candidates.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  The Account has no Contacts to match against.
                </Typography>
              ) : (
                <Stack component="ul" spacing={0.75} sx={{ listStyle: "none", p: 0, m: 0 }}>
                  {proposal.value.candidates.map((candidate) => {
                    const suggested = candidate.contactId === (proposal.value as { suggestedContactId: string | null }).suggestedContactId;
                    return (
                      <Stack component="li" key={candidate.contactId} direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: suggested ? 700 : 500 }}>
                            {candidate.name}
                            {suggested && (
                              <Chip label="suggested" size="small" color="warning" variant="outlined" sx={{ ml: 1, height: 18, fontSize: "0.65rem" }} />
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {[candidate.title, candidate.email].filter(Boolean).join(" · ") || "No title or email on the Contact"}
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                          {Math.round(candidate.score * 100)}% name match
                        </Typography>
                      </Stack>
                    );
                  })}
                </Stack>
              )}
            </Section>
          )}

          <Section title="Calls on this deal">
            {detail.calls.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No analysed calls yet.
              </Typography>
            ) : (
              <Stack component="ul" spacing={0.5} sx={{ listStyle: "none", p: 0, m: 0 }}>
                {(() => {
                  const { contributed } = callsBehind(field, detail);
                  const ids = new Set(contributed.map((c) => c.meetingId));
                  return detail.calls.map((call) => {
                    const fed = ids.has(call.meetingId);
                    return (
                      <Stack component="li" key={call.meetingId} direction="row" spacing={1} sx={{ alignItems: "center", color: fed ? "text.primary" : "text.secondary" }}>
                        <Box component="span" sx={{ display: "inline-flex", color: fed ? "success.main" : "text.disabled" }} aria-hidden>
                          {fed ? <CheckIcon size={14} /> : <MinusIcon size={14} />}
                        </Box>
                        <Link component={RouterLink} to={meetingPath(call.meetingId, { tab: "meddpicc" })} variant="body2" underline="hover" color="inherit" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {call.title}
                        </Link>
                        <Typography variant="caption" sx={{ flexShrink: 0 }}>
                          {formatDateTime(call.start)} · {fed ? "mentioned it" : "did not mention it"}
                        </Typography>
                      </Stack>
                    );
                  });
                })()}
              </Stack>
            )}
          </Section>
        </Box>
      )}
    </Drawer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box component="section" aria-label={title} sx={{ mt: 2.5 }}>
      <Typography variant="overline" component="h3" sx={{ display: "block", color: "text.secondary", lineHeight: 1.6, mb: 0.75 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}
