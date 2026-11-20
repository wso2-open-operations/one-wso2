import type { AddRiskFormValues, AIActionPlanSuggestion, AICategorySuggestion, AILikelihoodSuggestion } from "./types";

// An AI suggestion is only a record of what the model said about particular
// inputs. If those inputs change afterwards, the suggestion no longer
// describes the risk being saved, and sending it would log a wrong
// accepted/overridden history. Each suggestion therefore carries a `basis`:
// a fingerprint of the inputs it was made from. At save time the suggestion is
// sent only if the current inputs still produce the same fingerprint.

const text = (s: string | null | undefined): string => (s ?? "").trim();
const ids = (v: number[] | undefined): number[] => [...(v ?? [])].sort((a, b) => a - b);

export function categoryBasis(title: string, description: string, complianceReferences: number[] | undefined): string {
  return JSON.stringify([text(title), text(description), ids(complianceReferences)]);
}

export function likelihoodBasis(
  title: string,
  description: string,
  impactDescription: string | null | undefined,
  complianceReferences: number[] | undefined,
  category: number | "" | null | undefined,
  sourceRegister: number | "" | null | undefined,
): string {
  return JSON.stringify([
    text(title),
    text(description),
    text(impactDescription),
    ids(complianceReferences),
    category ?? "",
    sourceRegister ?? "",
  ]);
}

export function actionPlanBasis(
  title: string,
  description: string,
  category: number | "" | null | undefined,
  complianceReferences: number[] | undefined,
  treatmentStrategy: string | null | undefined,
): string {
  return JSON.stringify([text(title), text(description), category ?? "", ids(complianceReferences), text(treatmentStrategy)]);
}

// A plan suggestion counts as "used" only if the user clicked "Use this
// suggestion" AND the description they are saving is still that text. Editing
// or clearing it afterwards makes it an override.
export function actionPlanStillUsed(suggestion: Pick<AIActionPlanSuggestion, "description" | "used">, savedDescription: string): boolean {
  return suggestion.used && text(suggestion.description) === text(savedDescription);
}

export interface SuggestionsToSend {
  category: AICategorySuggestion | null;
  likelihood: AILikelihoodSuggestion | null;
  actionPlan: AIActionPlanSuggestion | null;
}

// The suggestions that still describe the form being submitted. Stale ones are
// dropped, so nothing is recorded for them.
export function suggestionsToSend(data: AddRiskFormValues): SuggestionsToSend {
  const category =
    data.aiCategorySuggestion &&
    data.aiCategorySuggestion.basis === categoryBasis(data.riskTitle, data.riskDescription, data.complianceReferences)
      ? data.aiCategorySuggestion
      : null;

  const likelihood =
    data.aiLikelihoodSuggestion &&
    data.aiLikelihoodSuggestion.basis ===
      likelihoodBasis(
        data.riskTitle,
        data.riskDescription,
        data.impactDescription,
        data.complianceReferences,
        data.riskCategory,
        data.sourceRegister,
      )
      ? data.aiLikelihoodSuggestion
      : null;

  const plan = data.aiActionPlanSuggestion;
  const actionPlan =
    plan &&
    plan.basis ===
      actionPlanBasis(data.riskTitle, data.riskDescription, data.riskCategory, data.complianceReferences, data.treatmentStrategy)
      ? { ...plan, used: actionPlanStillUsed(plan, data.actionPlanDescription) }
      : null;

  return { category, likelihood, actionPlan };
}
