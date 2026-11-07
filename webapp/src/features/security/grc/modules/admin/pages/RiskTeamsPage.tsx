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
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { Pencil, Plus } from "@wso2/oxygen-ui-icons-react";
import { type JSX, useEffect, useState } from "react";
import { useAuthApiClient } from "@features/security/grc/shim/useAuthApiClient";
import {
  createTeam,
  fetchAllTeams,
  fetchLookups,
  updateTeam,
  type AdminTeam,
  type Lookup,
  type RegisterTemplate,
  type TeamPayload,
} from "../api/adminApi";
import { dialogPaperSx } from "../cardStyles";
import PlatformChecklist from "../components/PlatformChecklist";

// The DB's team_type enum still has three values (SOURCE_REGISTER, ASSIGNMENT,
// BOTH — see risk_schema.sql), but this console deliberately offers only two:
// real seed data is 7x BOTH and 2x ASSIGNMENT, zero teams have ever been
// SOURCE_REGISTER-only, so a third option nobody uses just invites confusion.
// "Register" here saves as BOTH, not a dedicated REGISTER value on the wire —
// SOURCE_REGISTER stays a valid, reachable enum value everywhere else
// (internal/risk/repository/entity/team.go's semantic filter still expands it),
// it's just not selectable from this form. Revisit if a genuine register-only,
// non-assignable team is ever needed — that's a one-line addition here, not a
// schema change.
const teamTypeOptions: { value: "BOTH" | "ASSIGNMENT"; label: string; hint: string }[] = [
  { value: "BOTH", label: "Register", hint: "Can be used as a risk's source register, and as an assignment target." },
  { value: "ASSIGNMENT", label: "Assignment", hint: "Assignment target only — cannot be a risk's source register." },
];

// A Register Template picks the fields a register's risks carry
// (RISK_MODULE_DESIGN.md §14). An assignment-only team has no risks of its own,
// so the form doesn't ask for one.
const templateLabel: Record<RegisterTemplate, string> = {
  STANDARD: "Standard",
  AGGREGATED: "Aggregated",
  MANAGED_SERVICES: "Managed Services",
};

const registerTemplateOptions: { value: RegisterTemplate; label: string; hint: string }[] = [
  { value: "STANDARD", label: "Standard", hint: "The original risk fields, including Security Compliance Reference." },
  { value: "AGGREGATED", label: "Aggregated", hint: "The standard fields plus Platform and its sub-platforms." },
  {
    value: "MANAGED_SERVICES",
    label: "Managed Services",
    hint: "No Security Compliance Reference; adds Customer Name, Product, Deployment Type and Environment.",
  },
];

const teamTypeLabel = (t: AdminTeam["team_type"]): string =>
  t === "BOTH" ? "Register" : t === "ASSIGNMENT" ? "Assignment" : "Source Register";

export default function RiskTeamsPage(): JSX.Element {
  const authFetch = useAuthApiClient();
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminTeam | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [teamType, setTeamType] = useState<"BOTH" | "ASSIGNMENT">("BOTH");
  const [registerTemplate, setRegisterTemplate] = useState<RegisterTemplate>("STANDARD");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  // Aggregated registers only: the platforms and sub-platforms the register
  // offers on Add Risk. Empty offers every active platform.
  const [platformIds, setPlatformIds] = useState<number[]>([]);
  const [platforms, setPlatforms] = useState<Lookup[]>([]);
  const [platformsError, setPlatformsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchAllTeams(authFetch)
      .then(setTeams)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load teams"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every platform and sub-platform, for the Aggregated register's checklist.
  // A failure only disables that checklist, not the rest of the form.
  useEffect(() => {
    fetchLookups(authFetch, "platforms")
      .then(setPlatforms)
      .catch((e) => setPlatformsError(e instanceof Error ? e.message : "Failed to load platforms"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => {
    setEditing(null);
    setName("");
    setCode("");
    setDescription("");
    setTeamType("BOTH");
    setRegisterTemplate("STANDARD");
    setStatus("ACTIVE");
    setPlatformIds([]);
    setDialogError(null);
    setDialogOpen(true);
  };

  const openEdit = (team: AdminTeam) => {
    setEditing(team);
    setName(team.name);
    setCode(team.code ?? "");
    setDescription(team.description ?? "");
    // A pre-existing SOURCE_REGISTER-only team (none in real data today, but
    // the enum still permits one) has no matching option in this form — fall
    // back to displaying "Register" rather than rendering an unselectable
    // blank value. The Select is locked in this case (see isSourceRegister
    // below) and handleSave sends the real team_type unchanged, so this
    // display-only substitution never reaches the save payload.
    setTeamType(team.team_type === "ASSIGNMENT" ? "ASSIGNMENT" : "BOTH");
    setRegisterTemplate(team.register_template);
    setPlatformIds(team.platform_ids ?? []);
    setStatus(team.status === "INACTIVE" ? "INACTIVE" : "ACTIVE");
    setDialogError(null);
    setDialogOpen(true);
  };

  // This form has no way to represent SOURCE_REGISTER as a real selection
  // (see teamTypeOptions above) — so an edit must never let the two-option
  // selector's displayed fallback overwrite a team that's actually
  // SOURCE_REGISTER-only on save.
  const isSourceRegister = editing?.team_type === "SOURCE_REGISTER";
  const codeRequired = teamType === "BOTH" || isSourceRegister;
  // The code only goes into generated risk codes, and only a register raises
  // risks — so an assignment-only team isn't asked for one. A team that already
  // has a code keeps showing it (and can't lose it: see handleSave).
  const showCode = codeRequired || !!editing?.code;
  // Once a risk uses the team as its source register its template is fixed:
  // those risks carry its fields. The select is disabled while locked.
  const templateLocked = !!editing?.has_risks;
  // An assignment-only team isn't asked for a template. It sends what it
  // already has (Standard for a new team), so a Team Type switch never changes
  // a saved template, which the backend refuses once risks use it.
  const showTemplate = !(teamType === "ASSIGNMENT" && !isSourceRegister);
  const effectiveTemplate: RegisterTemplate = showTemplate
    ? registerTemplate
    : (editing?.register_template ?? "STANDARD");

  const showPlatforms = showTemplate && effectiveTemplate === "AGGREGATED";

  const handleSave = async () => {
    if (!name.trim()) {
      setDialogError("Name is required.");
      return;
    }
    if (codeRequired && !code.trim()) {
      setDialogError("Code is required for a Register team.");
      return;
    }
    // The entity's PATCH treats a null code as "leave unchanged" (there's no
    // way to distinguish "clear it" from "not sent" over the wire), so an
    // edit that empties an already-set code would silently no-op. Block it
    // here instead of sending an update that can't take effect.
    if (editing?.code && !code.trim()) {
      setDialogError("Code cannot be cleared once set.");
      return;
    }
    setSaving(true);
    setDialogError(null);
    try {
      const payload: TeamPayload = {
        name: name.trim(),
        // Not sent when the field is hidden, so a code typed before switching
        // the team to Assignment can't ride along unseen.
        code: showCode && code.trim() ? code.trim().toUpperCase() : null,
        description: description.trim(),
        team_type: isSourceRegister ? "SOURCE_REGISTER" : teamType,
        register_template: effectiveTemplate,
        // Only an Aggregated register has a list. Sent whole on every save, so
        // unticking everything clears it; the platforms failing to load leaves
        // it out rather than wiping the stored list.
        ...(showPlatforms && !platformsError ? { platform_ids: platformIds } : {}),
        status,
      };
      if (editing) {
        await updateTeam(authFetch, editing.id, payload);
      } else {
        await createTeam(authFetch, payload);
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : "Failed to save team");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
        <Button variant="contained" startIcon={<Plus size={14} />} onClick={openAdd}>
          Add Team
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Template</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={22} />
                </TableCell>
              </TableRow>
            )}
            {!loading && teams.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No teams found.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              teams.map((team) => (
                <TableRow key={team.id} sx={team.status !== "ACTIVE" ? { opacity: 0.55 } : undefined}>
                  <TableCell sx={{ fontWeight: 600 }}>{team.name}</TableCell>
                  <TableCell>
                    {team.code ? (
                      <Chip size="small" label={team.code} variant="outlined" sx={{ fontFamily: "monospace" }} />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        —
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{teamTypeLabel(team.team_type)}</TableCell>
                  <TableCell>{templateLabel[team.register_template] ?? team.register_template}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={team.status === "ACTIVE" ? "Active" : team.status === "INACTIVE" ? "Inactive" : "Removed"}
                      color={team.status === "ACTIVE" ? "success" : "default"}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(team)} aria-label="Edit">
                      <Pencil size={15} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogTitle>{editing ? "Edit Risk Team" : "Add Risk Team"}</DialogTitle>
        {/* pt needs !important: MUI zeroes the top padding of a DialogContent that
            directly follows the DialogTitle, and that rule outranks a plain pt, so
            the first field's floating label was cut off at the top edge. */}
        <DialogContent sx={{ minHeight: 470, pt: "24px !important" }}>
          {dialogError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDialogError(null)}>
              {dialogError}
            </Alert>
          )}
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            helperText="The team or product name shown throughout the Risk Hub."
            sx={{ mb: 2.5 }}
          />
          {/* Team Type first: it decides whether a Code is asked for at all. */}
          <FormControl fullWidth size="small" disabled={isSourceRegister}>
            <InputLabel id="team-type-label">Team Type</InputLabel>
            <Select
              labelId="team-type-label"
              label="Team Type"
              value={teamType}
              onChange={(e) => setTeamType(e.target.value as "BOTH" | "ASSIGNMENT")}
            >
              {teamTypeOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, mb: 2.5 }}>
            {isSourceRegister
              ? "Source Register-only — this type isn't editable from this console; saving keeps it unchanged."
              : teamTypeOptions.find((o) => o.value === teamType)?.hint}
          </Typography>
          {showCode && (
            <TextField
              fullWidth
              size="small"
              label={codeRequired ? "Code *" : "Code"}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              slotProps={{ htmlInput: { maxLength: 10, style: { textTransform: "uppercase" } } }}
              helperText="Short abbreviation used to build generated risk codes, e.g. CHO."
              sx={{ mb: 2.5 }}
            />
          )}
          {showTemplate && (
            <>
              <FormControl fullWidth size="small" disabled={templateLocked}>
                <InputLabel id="team-template-label">Register Template</InputLabel>
                <Select
                  labelId="team-template-label"
                  label="Register Template"
                  value={effectiveTemplate}
                  onChange={(e) => setRegisterTemplate(e.target.value as RegisterTemplate)}
                >
                  {registerTemplateOptions.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, mb: 2.5 }}>
                {templateLocked
                  ? "Locked: risks already use this team, so its template can no longer be changed."
                  : `${registerTemplateOptions.find((o) => o.value === effectiveTemplate)?.hint} Fixed once a risk uses the team.`}
              </Typography>
            </>
          )}
          {showPlatforms && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Platforms
              </Typography>
              {platformsError ? (
                <Alert severity="warning">
                  Couldn't load the platforms, so this register's list is left unchanged. {platformsError}
                </Alert>
              ) : (
                <>
                  <PlatformChecklist platforms={platforms} value={platformIds} onChange={setPlatformIds} />
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                    The platforms, and the sub-platforms ticked under them, that Add Risk offers for this register. Leave
                    everything unticked to offer every platform.
                  </Typography>
                </>
              )}
            </Box>
          )}
          <TextField
            fullWidth
            multiline
            minRows={2}
            size="small"
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            helperText="Shown to admins managing this list — not visible elsewhere in the app."
            sx={{ mb: 2.5 }}
          />
          <FormControl fullWidth size="small">
            <InputLabel id="team-status-label">Status</InputLabel>
            <Select
              labelId="team-status-label"
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as "ACTIVE" | "INACTIVE")}
            >
              <MenuItem value="ACTIVE">Active</MenuItem>
              <MenuItem value="INACTIVE">Inactive</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
            An inactive team stops appearing in Risk Hub pickers, but existing risks that reference it are unaffected.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={saving} onClick={handleSave}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
