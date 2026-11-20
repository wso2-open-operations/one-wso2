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

import { useState } from "react";
import {
  alpha,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import {
  MessageCircleQuestionIcon,
  CircleCheckIcon,
  CircleIcon,
  ExternalLinkIcon,
  FileSearchIcon,
  InfoIcon,
  PanelRightOpenIcon,
  PencilIcon,
  Undo2Icon,
  XIcon,
} from "@wso2/oxygen-ui-icons-react";
import type { DealField, EvidenceQuote, EvidenceSourceType, FieldProposal, FieldValue, NewContact } from "../types";
import { newContactFromProposal, newContactProblem, type ApprovalDraft } from "../util/approval";
import { formatFieldValue, heardLabel, isEmptyValue, isRoleProposal, sameValue } from "../util/meddpiccFormat";
import { hasCustomerEvidence, leadQuote, newestFirst, sourceOf } from "../util/evidenceSource";
import { groupBySource } from "../util/provenance";
import EchoMarker, { EchoIcon } from "./EchoMarker";
import EvidenceItem from "./EvidenceItem";
import FieldEditor from "./FieldEditor";
import NewContactForm from "./NewContactForm";

const NOT_KNOWN = "__not_known__";
const CREATE = "__create__";

function StateIcon({ field }: { field: DealField }) {
  if (field.state === "FILLED") {
    return (
      <Box component="span" sx={{ color: "success.main", display: "inline-flex" }} aria-label="Filled">
        <CircleCheckIcon size={16} />
      </Box>
    );
  }
  if (field.state === "SUGGESTED") {
    return (
      <Box component="span" sx={{ color: "warning.main", display: "inline-flex" }} aria-label="Echo suggestion">
        <EchoIcon size={16} />
      </Box>
    );
  }
  return (
    <Box component="span" sx={{ color: "text.disabled", display: "inline-flex" }} aria-label="Empty">
      <CircleIcon size={16} />
    </Box>
  );
}

/**
 * The two values side by side, for a suggestion that differs from Salesforce: what is
 * there now, and what the calls say. One look answers "what would change?".
 */
export function Compare({
  before,
  after,
  afterLabel,
  confidence,
}: {
  /** Salesforce's value; null when the field is empty there. */
  before: string | null;
  after: string;
  afterLabel: string;
  confidence: number;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) minmax(0, 1fr)" },
        gap: { xs: 0.75, sm: 2 },
      }}
    >
      {before !== null && (
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" sx={{ display: "block", lineHeight: 1.6, color: "text.secondary" }}>
            In Salesforce
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: "pre-line", overflowWrap: "anywhere", color: "text.secondary" }}>
            {before}
          </Typography>
        </Box>
      )}
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
          <Typography variant="overline" sx={{ lineHeight: 1.6, color: "text.secondary" }}>
            {afterLabel}
          </Typography>
          <EchoMarker confidence={confidence} />
        </Stack>
        <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
          {after}
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * The caveat on a value that is only the newest call's because combining the calls
 * failed: said plainly, so it is never read as what every call adds up to.
 */
export function FallbackNote({ proposal }: { proposal: FieldProposal }) {
  if (proposal.mergeStatus !== "FALLBACK") return null;
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mt: 0.75, color: "text.secondary" }}>
      <Box component="span" sx={{ display: "inline-flex" }} aria-hidden>
        <InfoIcon size={12} />
      </Box>
      <Typography variant="caption">From the latest call only — couldn&apos;t combine calls</Typography>
    </Stack>
  );
}

/**
 * One Gate field on the deal page: what Salesforce has, what the AI proposes
 * and why, and the AM's control over it.
 *
 * A field waiting for a decision leads with the decision: the Salesforce value
 * beside the suggested one, and the single best quote behind it. The rationale,
 * the confidence and every quote are one click away, in the provenance panel
 * ("Where this came from"), so the card stays a decision and not a dossier. There is no
 * per-field approve. A correct Proposal needs no action at all — Approve all
 * takes it as it is — so the per-field controls are Edit, which can also clear,
 * and Reject, which drops a wrong suggestion without touching Salesforce; a role
 * has the contact picker, which can also create the contact.
 */
export default function DealFieldRow({
  field,
  draft,
  readOnly,
  salesforceUrl,
  accountName,
  onEdit,
  onUndo,
  onRoleMatch,
  onNewContact,
  onExplain,
  onReject,
  sourceFilter = null,
  variant = "full",
  askNext,
  gateTag,
}: {
  field: DealField;
  draft: ApprovalDraft;
  readOnly: boolean;
  salesforceUrl: string;
  /** The Opportunity's Account, named when a contact is about to be created on it. */
  accountName: string;
  onEdit: (key: string, value: FieldValue) => void;
  onUndo: (key: string) => void;
  /** A Contact id, or null for "not known — leave the role unset". */
  onRoleMatch: (key: string, contactId: string | null) => void;
  /** The Contact to create for the role, or null to drop that answer. */
  onNewContact: (key: string, contact: NewContact | null) => void;
  /** Open the full account of where the field's suggestion came from. */
  onExplain: (field: DealField) => void;
  /** Turn down the field's pending suggestion. No Reject is offered without it. */
  onReject?: (field: DealField) => void;
  /** Show evidence from one source only; null shows all. */
  sourceFilter?: EvidenceSourceType | null;
  /**
   * "compact": one quiet line, for a field Salesforce already has. Edit opens the full
   * row in place, and an edited field stays full until approved or undone.
   */
  variant?: "full" | "compact";
  /** The question to ask on the next call, for a field still missing. */
  askNext?: string;
  /** The stage this field belongs to, shown when the list spans stages. */
  gateTag?: string;
}) {
  const [editing, setEditing] = useState(false);
  const { proposal } = field;
  const edited = Object.prototype.hasOwnProperty.call(draft.edits, field.key);
  const editValue = edited ? draft.edits[field.key] : undefined;
  const sfEmpty = isEmptyValue(field.salesforceValue);
  const salesforceOnly = !field.conversational;
  const rolePending = field.kind === "role" && Boolean(proposal?.pending) && isRoleProposal(proposal?.value);
  const newContact = draft.newContacts?.[field.key];

  if (variant === "compact" && !editing && !edited) {
    const value = !field.applicable
      ? "Not needed for this opportunity"
      : field.notInSalesforce
        ? proposal
          ? `${formatFieldValue(proposal.value)} (kept in Echo, not in Salesforce yet)`
          : "Not in Salesforce yet"
        : sfEmpty
          ? field.optional
            ? "Empty · optional"
            : "Empty"
          : formatFieldValue(field.salesforceValue);
    return (
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", py: 0.75, borderBottom: 1, borderColor: "divider", minWidth: 0, opacity: field.applicable ? 1 : 0.6 }}
      >
        <StateIcon field={field} />
        <Typography variant="body2" sx={{ fontWeight: 500, flexShrink: 0 }}>
          {field.label}
        </Typography>
        {gateTag && (
          <Chip label={gateTag} size="small" variant="outlined" sx={{ height: 18, fontSize: "0.65rem", flexShrink: 0 }} />
        )}
        <Typography
          variant="body2"
          color="text.secondary"
          title={value}
          sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {value}
        </Typography>
        {salesforceOnly ? (
          <Link
            href={salesforceUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="caption"
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}
          >
            Salesforce <ExternalLinkIcon size={12} />
          </Link>
        ) : (
          field.kind !== "role" &&
          !readOnly &&
          field.applicable && (
            <Button size="small" onClick={() => setEditing(true)} aria-label={`Edit ${field.label}`} sx={{ minWidth: 0, flexShrink: 0 }}>
              Edit
            </Button>
          )
        )}
      </Stack>
    );
  }

  // The quotes, newest first and from the chosen source; the best one leads, the rest wait in the panel.
  const evidence: EvidenceQuote[] = proposal
    ? newestFirst(proposal.evidence).filter((q) => !sourceFilter || sourceOf(q).type === sourceFilter)
    : [];
  const lead = leadQuote(evidence);
  // Only when Salesforce holds the same value: an approved suggestion stays "not pending"
  // after Salesforce is changed, so not pending alone says nothing about agreement.
  const callsAgree = Boolean(proposal && (field.notInSalesforce || sameValue(proposal.value, field.salesforceValue)));
  // "3 quotes, 2 sources": what the full account holds, on the control that opens it.
  const sourceCount = proposal ? groupBySource(proposal.evidence).length : 0;
  const quoteCount = proposal?.evidence.length ?? 0;
  const provenanceCounts = `${quoteCount} ${quoteCount === 1 ? "quote" : "quotes"} · ${sourceCount} ${sourceCount === 1 ? "source" : "sources"}`;
  // Drawn as a button, in the suggestion's own tint, and not as a line of text under the
  // quote: it is the way to check the suggestion before approving it, and a link in body
  // colour read as part of the quote and was walked past.
  const explain = (
    <Button
      size="small"
      variant="outlined"
      onClick={() => onExplain(field)}
      startIcon={<FileSearchIcon size={14} />}
      endIcon={<PanelRightOpenIcon size={14} />}
      aria-label={`Where ${field.label} came from`}
      sx={(theme) => ({
        mt: 1.25,
        px: 1.25,
        textTransform: "none",
        fontWeight: 600,
        borderRadius: 999,
        color: "warning.dark",
        borderColor: alpha(theme.palette.warning.main, 0.5),
        bgcolor: alpha(theme.palette.warning.main, 0.08),
        "&:hover": { bgcolor: alpha(theme.palette.warning.main, 0.16), borderColor: "warning.main" },
      })}
    >
      Where this came from
      {quoteCount > 0 && (
        <Box
          component="span"
          sx={{
            ml: 1,
            px: 0.75,
            borderRadius: 999,
            bgcolor: "background.paper",
            fontSize: "0.7rem",
            fontWeight: 600,
            color: "text.secondary",
            whiteSpace: "nowrap",
          }}
        >
          {provenanceCounts}
        </Box>
      )}
    </Button>
  );

  return (
    <Box
      sx={{
        py: 1.5,
        borderBottom: 1,
        borderColor: "divider",
        opacity: field.applicable ? 1 : 0.6,
      }}
    >
      {/* Title line: state, label, and only the tags that change what the AM does. */}
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}>
        <StateIcon field={field} />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {field.label}
        </Typography>
        {field.optional && (
          <Typography variant="caption" color="text.secondary">
            optional
          </Typography>
        )}
        {gateTag && <Chip label={gateTag} size="small" variant="outlined" sx={{ height: 18, fontSize: "0.65rem" }} />}
        {field.attest && (
          <Tooltip title="Only the account manager confirms this. Check a suggestion against the customer's own words." arrow>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, cursor: "default" }}>
              You confirm
            </Typography>
          </Tooltip>
        )}
      </Stack>

      {/* What to ask, for a field nothing has been heard for yet. */}
      {askNext && (
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "flex-start", mt: 0.75, pl: 3 }}>
          <Box component="span" sx={{ color: "info.main", display: "inline-flex", mt: "2px" }} aria-hidden>
            <MessageCircleQuestionIcon size={14} />
          </Box>
          <Typography variant="body2">
            <Box component="span" sx={{ color: "text.secondary" }}>
              Ask next call:{" "}
            </Box>
            {askNext}
          </Typography>
        </Stack>
      )}

      {!field.applicable && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
          Not needed for this opportunity, given the answers it depends on.
        </Typography>
      )}

      <Box sx={{ pl: 3, mt: 0.75 }}>
        {/* Salesforce's value on its own line, when there is no proposal to set it
            against. With a proposal, the comparison below shows both. */}
        {!field.notInSalesforce && !proposal && (
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
            <Box component="span" sx={{ fontWeight: 600 }}>
              Salesforce:
            </Box>{" "}
            {formatFieldValue(field.salesforceValue)}
          </Typography>
        )}

        {salesforceOnly && (
          <Link
            href={salesforceUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="caption"
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mt: 0.25 }}
          >
            {sfEmpty ? "Fill in Salesforce" : "Edit in Salesforce"} <ExternalLinkIcon size={12} />
          </Link>
        )}

        {proposal && proposal.pending && (
          <Box sx={{ mt: 0.5 }}>
            {/* The decision: what is there, and what the calls say instead. */}
            <Compare
              before={field.notInSalesforce ? null : sfEmpty ? "Empty" : formatFieldValue(field.salesforceValue)}
              after={formatFieldValue(proposal.value)}
              afterLabel={heardLabel(field)}
              confidence={proposal.confidence}
            />
            <FallbackNote proposal={proposal} />

            {/* An attest field backed only by WSO2's words, or by words nobody could
                attribute, is a claim about the customer rather than the customer's own
                position: said plainly, before anyone approves it. */}
            {field.attest && !hasCustomerEvidence(proposal.evidence) && (
              <Typography variant="caption" sx={{ display: "block", mt: 0.75, color: "warning.dark", fontWeight: 600 }}>
                Needs customer evidence: no quote from the customer backs this yet.
              </Typography>
            )}

            {/* One quote on the card; the panel has the rest. */}
            {lead ? (
              <Box sx={{ mt: 1 }}>
                <EvidenceItem quote={lead} />
              </Box>
            ) : (
              evidence.length === 0 &&
              sourceFilter && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                  No evidence from this source.
                </Typography>
              )
            )}
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
              {explain}
              {/* Owners only, as Edit and Approve all are. */}
              {onReject && !readOnly && (
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<XIcon size={14} />}
                  onClick={() => onReject(field)}
                  aria-label={`Reject the suggestion for ${field.label}`}
                  sx={{ mt: 1.25, textTransform: "none", color: "text.secondary" }}
                >
                  Reject
                </Button>
              )}
            </Stack>
          </Box>
        )}

        {/* The calls agree with Salesforce: one quiet line says so. */}
        {proposal && !proposal.pending && (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5, mt: 0.5 }}>
            <Typography variant="body2" sx={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
              <Box component="span" sx={{ color: "text.secondary" }}>
                {field.notInSalesforce ? "Kept in Echo: " : "Salesforce: "}
              </Box>
              <Box component="span" sx={{ fontWeight: 600 }}>
                {formatFieldValue(field.notInSalesforce ? proposal.value : field.salesforceValue)}
              </Box>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {callsAgree ? "· the calls agree" : `· the calls heard ${formatFieldValue(proposal.value)}`}
            </Typography>
            <Box sx={{ width: "100%" }}>
              <FallbackNote proposal={proposal} />
              {explain}
            </Box>
          </Stack>
        )}

        {/* The contact picker, for a role Proposal waiting on a match. */}
        {rolePending && isRoleProposal(proposal?.value) && (
          <>
            <FormControl size="small" fullWidth sx={{ mt: 1.5 }} disabled={readOnly}>
              {/* Shrunk and notched for good: with displayEmpty the box shows "Pick a
                  contact" while nothing is chosen, and a resting label would sit on it. */}
              <InputLabel id={`meddpicc-role-${field.key}`} shrink>
                Matching contact
              </InputLabel>
              <Select
                labelId={`meddpicc-role-${field.key}`}
                label="Matching contact"
                notched
                value={
                  edited && editValue === null ? NOT_KNOWN : newContact ? CREATE : (draft.roleMatches[field.key] ?? "")
                }
                onChange={(event) => {
                  const value = event.target.value as string;
                  if (value === CREATE) {
                    onNewContact(field.key, newContactFromProposal(proposal.value as Parameters<typeof newContactFromProposal>[0]));
                    return;
                  }
                  onRoleMatch(field.key, value === NOT_KNOWN ? null : value);
                }}
                displayEmpty
                renderValue={(value) => {
                  if (value === NOT_KNOWN) return "Not known — leave unset";
                  if (value === CREATE) return "Not in Salesforce yet — create a contact";
                  const candidate = (isRoleProposal(proposal?.value) ? proposal.value.candidates : []).find(
                    (c) => c.contactId === value,
                  );
                  return candidate ? candidate.name : <em>Pick a contact</em>;
                }}
              >
                {proposal.value.candidates.map((candidate) => (
                  <MenuItem key={candidate.contactId} value={candidate.contactId}>
                    <Box>
                      <Typography variant="body2">
                        {candidate.name}
                        {candidate.contactId === (proposal.value as { suggestedContactId: string | null }).suggestedContactId &&
                          " · suggested"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {[candidate.title, candidate.email].filter(Boolean).join(" · ")}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
                <MenuItem value={CREATE}>Not in Salesforce yet — create a contact</MenuItem>
                <MenuItem value={NOT_KNOWN}>Not known — leave unset</MenuItem>
              </Select>
            </FormControl>
            {newContact && (
              <NewContactForm
                contact={newContact}
                accountName={accountName}
                problem={newContactProblem(newContact)}
                readOnly={readOnly}
                onChange={(contact) => onNewContact(field.key, contact)}
              />
            )}
          </>
        )}

        {/* The AM's own value, once they have edited. */}
        {edited && field.kind !== "role" && !editing && (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 1 }}>
            <Typography variant="body2" sx={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
              <Box component="span" sx={{ fontWeight: 600 }}>
                Your value:
              </Box>{" "}
              {editValue === null ? "cleared" : formatFieldValue(editValue)}
            </Typography>
            <Tooltip title="Undo your edit" arrow>
              <Button
                size="small"
                startIcon={<Undo2Icon size={14} />}
                onClick={() => onUndo(field.key)}
                aria-label={`Undo edit to ${field.label}`}
              >
                Undo
              </Button>
            </Tooltip>
          </Stack>
        )}

        {editing ? (
          <FieldEditor
            field={field}
            initial={
              edited
                ? (editValue ?? null)
                : proposal && !isRoleProposal(proposal.value)
                  ? proposal.value
                  : field.salesforceValue
            }
            onSave={(value) => {
              onEdit(field.key, value);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          field.conversational &&
          field.kind !== "role" &&
          !readOnly && (
            <Button
              size="small"
              startIcon={<PencilIcon size={14} />}
              onClick={() => setEditing(true)}
              sx={{ mt: 0.75 }}
              aria-label={`Edit ${field.label}`}
            >
              Edit
            </Button>
          )
        )}
      </Box>
    </Box>
  );
}
