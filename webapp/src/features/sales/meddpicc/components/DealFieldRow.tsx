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
  CircleCheckIcon,
  CircleIcon,
  ExternalLinkIcon,
  PencilIcon,
  SparklesIcon,
  Undo2Icon,
} from "@wso2/oxygen-ui-icons-react";
import type { DealField, EvidenceSourceType, FieldValue } from "../types";
import type { ApprovalDraft } from "../util/approval";
import { formatFieldValue, isEmptyValue, isRoleProposal, letterLabel } from "../util/meddpiccFormat";
import { hasCustomerEvidence } from "../util/evidenceSource";
import EvidenceList from "./EvidenceList";
import FieldEditor from "./FieldEditor";

const NOT_KNOWN = "__not_known__";

/** A small "AI" marker for anything the model proposed rather than someone typed. */
export function AiMarker({ confidence }: { confidence?: number }) {
  return (
    <Chip
      icon={<SparklesIcon size={12} />}
      label="AI"
      size="small"
      color="warning"
      variant="outlined"
      title={confidence !== undefined ? `AI proposal, confidence ${Math.round(confidence * 100)}%` : "AI proposal"}
      sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700, "& .MuiChip-icon": { ml: 0.5 } }}
    />
  );
}

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
      <Box component="span" sx={{ color: "warning.main", display: "inline-flex" }} aria-label="AI suggestion">
        <SparklesIcon size={16} />
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
 * One Gate field on the deal page: what Salesforce has, what the AI proposes
 * and why, and the AM's control over it.
 *
 * There is no per-field approve. A correct Proposal needs no action at all —
 * Approve all takes it as it is — so the only per-field control is Edit, which
 * can also clear.
 */
export default function DealFieldRow({
  field,
  draft,
  readOnly,
  salesforceUrl,
  onEdit,
  onUndo,
  onRoleMatch,
  sourceFilter = null,
}: {
  field: DealField;
  draft: ApprovalDraft;
  readOnly: boolean;
  salesforceUrl: string;
  onEdit: (key: string, value: FieldValue) => void;
  onUndo: (key: string) => void;
  /** A Contact id, or null for "not known — leave the role unset". */
  onRoleMatch: (key: string, contactId: string | null) => void;
  /** Show evidence from one source only; null shows all. */
  sourceFilter?: EvidenceSourceType | null;
}) {
  const [editing, setEditing] = useState(false);
  const { proposal } = field;
  const edited = Object.prototype.hasOwnProperty.call(draft.edits, field.key);
  const editValue = edited ? draft.edits[field.key] : undefined;
  const sfEmpty = isEmptyValue(field.salesforceValue);
  const salesforceOnly = !field.conversational;
  const rolePending = field.kind === "role" && Boolean(proposal?.pending) && isRoleProposal(proposal?.value);

  return (
    <Box
      sx={{
        py: 1.5,
        borderBottom: 1,
        borderColor: "divider",
        opacity: field.applicable ? 1 : 0.6,
      }}
    >
      {/* Title line: state, label, the Letters it feeds, and its tags. */}
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}>
        <StateIcon field={field} />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {field.label}
        </Typography>
        {field.letters.map((letter) => (
          <Chip
            key={letter}
            label={letterLabel(letter)}
            size="small"
            variant="outlined"
            sx={{ height: 18, fontSize: "0.65rem" }}
          />
        ))}
        {field.optional && (
          <Typography variant="caption" color="text.secondary">
            optional
          </Typography>
        )}
        {field.notInSalesforce && (
          <Chip label="Not in Salesforce yet" size="small" color="default" sx={{ height: 18, fontSize: "0.65rem" }} />
        )}
        {field.attest && (
          <Chip
            label="You confirm"
            size="small"
            variant="outlined"
            title="Only the account manager confirms this. The AI never proposes Yes on it."
            sx={{ height: 18, fontSize: "0.65rem", fontWeight: 600 }}
          />
        )}
      </Stack>

      {!field.applicable && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
          Not needed for this deal, given the answers it depends on.
        </Typography>
      )}

      <Box sx={{ pl: 3, mt: 0.75 }}>
        {/* Salesforce's value. Absent for fields that don't exist there yet. */}
        {!field.notInSalesforce && (
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

        {proposal && (
          <Box sx={{ mt: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
              <AiMarker confidence={proposal.confidence} />
              <Typography variant="body2" sx={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
                {proposal.pending ? "Proposed: " : "Heard on calls: "}
                <Box component="span" sx={{ fontWeight: 600 }}>
                  {formatFieldValue(proposal.value)}
                </Box>
              </Typography>
            </Stack>

            {/* The diff, only when there is something to differ from. */}
            {proposal.pending && !sfEmpty && !field.notInSalesforce && (
              <Typography variant="caption" sx={{ display: "block", mt: 0.5, color: "warning.dark" }}>
                Salesforce: {formatFieldValue(field.salesforceValue)} → proposed:{" "}
                {formatFieldValue(proposal.value)}
              </Typography>
            )}

            {/* An attest field backed only by WSO2's words, or by words nobody could
                attribute, is a claim about the customer rather than the customer's own
                position: said plainly, before anyone approves it. */}
            {field.attest && !hasCustomerEvidence(proposal.evidence) && (
              <Typography variant="caption" sx={{ display: "block", mt: 0.5, color: "warning.dark", fontWeight: 600 }}>
                Needs customer evidence: no quote from the customer backs this yet.
              </Typography>
            )}

            {proposal.rationale && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                {proposal.rationale}
              </Typography>
            )}

            <Box sx={{ mt: 1 }}>
              <EvidenceList evidence={proposal.evidence} sourceFilter={sourceFilter} />
            </Box>
          </Box>
        )}

        {/* The contact picker, for a role Proposal waiting on a match. */}
        {rolePending && isRoleProposal(proposal?.value) && (
          <FormControl size="small" fullWidth sx={{ mt: 1.5 }} disabled={readOnly}>
            <InputLabel id={`meddpicc-role-${field.key}`}>Matching contact</InputLabel>
            <Select
              labelId={`meddpicc-role-${field.key}`}
              label="Matching contact"
              value={
                edited && editValue === null ? NOT_KNOWN : (draft.roleMatches[field.key] ?? "")
              }
              onChange={(event) => {
                const value = event.target.value as string;
                onRoleMatch(field.key, value === NOT_KNOWN ? null : value);
              }}
              displayEmpty
              renderValue={(value) => {
                if (value === NOT_KNOWN) return "Not known — leave unset";
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
                      {[candidate.title, candidate.email, `match ${Math.round(candidate.score * 100)}%`]
                        .filter(Boolean)
                        .join(" · ")}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
              <MenuItem value={NOT_KNOWN}>Not known — leave unset</MenuItem>
            </Select>
          </FormControl>
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
