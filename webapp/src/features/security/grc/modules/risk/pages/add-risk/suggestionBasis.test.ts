import { describe, expect, it } from "vitest";
import {
  actionPlanBasis,
  actionPlanStillUsed,
  categoryBasis,
  likelihoodBasis,
  suggestionsToSend,
} from "./suggestionBasis";
import type { AddRiskFormValues } from "./types";

function form(over: Partial<AddRiskFormValues> = {}): AddRiskFormValues {
  const base = {
    riskTitle: "Title",
    riskDescription: "Description",
    impactDescription: "Impact",
    complianceReferences: [2, 1],
    riskCategory: 7,
    sourceRegister: 3,
    treatmentStrategy: "MITIGATE",
    actionPlanDescription: "Patch the host",
    aiCategorySuggestion: null,
    aiLikelihoodSuggestion: null,
    aiActionPlanSuggestion: null,
  };
  return { ...base, ...over } as unknown as AddRiskFormValues;
}

const category = (basis: string) => ({ categoryId: 7, reason: "r", confidence: "high" as const, basis });
const likelihood = (basis: string) => ({ score: 2 as const, reason: "r", confidence: "high" as const, basis });
const plan = (basis: string, used: boolean) => ({
  description: "Patch the host",
  reason: "r",
  confidence: "high" as const,
  used,
  basis,
});

const catBasis = categoryBasis("Title", "Description", [1, 2]);
const likBasis = likelihoodBasis("Title", "Description", "Impact", [1, 2], 7, 3);
const planBasis = actionPlanBasis("Title", "Description", 7, [1, 2], "MITIGATE");

describe("suggestionsToSend", () => {
  it("keeps suggestions whose inputs are unchanged, ignoring reference order and padding", () => {
    const out = suggestionsToSend(
      form({
        riskTitle: "  Title ",
        aiCategorySuggestion: category(catBasis),
        aiLikelihoodSuggestion: likelihood(likBasis),
        aiActionPlanSuggestion: plan(planBasis, true),
      }),
    );
    expect(out.category).not.toBeNull();
    expect(out.likelihood).not.toBeNull();
    expect(out.actionPlan?.used).toBe(true);
  });

  it("drops every suggestion when the title or description changed", () => {
    const out = suggestionsToSend(
      form({
        riskDescription: "Edited after suggesting",
        aiCategorySuggestion: category(catBasis),
        aiLikelihoodSuggestion: likelihood(likBasis),
        aiActionPlanSuggestion: plan(planBasis, true),
      }),
    );
    expect(out).toEqual({ category: null, likelihood: null, actionPlan: null });
  });

  it("drops the likelihood suggestion when the category or impact changed", () => {
    expect(suggestionsToSend(form({ riskCategory: 8, aiLikelihoodSuggestion: likelihood(likBasis) })).likelihood).toBeNull();
    expect(
      suggestionsToSend(form({ impactDescription: "Other", aiLikelihoodSuggestion: likelihood(likBasis) })).likelihood,
    ).toBeNull();
  });

  it("drops the plan suggestion when the treatment strategy changed", () => {
    expect(
      suggestionsToSend(form({ treatmentStrategy: "ACCEPT", aiActionPlanSuggestion: plan(planBasis, false) })).actionPlan,
    ).toBeNull();
  });

  it("marks the plan as not used once the saved description no longer matches", () => {
    const edited = suggestionsToSend(
      form({ actionPlanDescription: "Something else", aiActionPlanSuggestion: plan(planBasis, true) }),
    );
    expect(edited.actionPlan?.used).toBe(false);
    const cleared = suggestionsToSend(form({ actionPlanDescription: "", aiActionPlanSuggestion: plan(planBasis, true) }));
    expect(cleared.actionPlan?.used).toBe(false);
  });

  it("never reports used when the button was not clicked, even if the text matches", () => {
    expect(suggestionsToSend(form({ aiActionPlanSuggestion: plan(planBasis, false) })).actionPlan?.used).toBe(false);
  });
});

describe("actionPlanStillUsed", () => {
  it("compares trimmed text", () => {
    expect(actionPlanStillUsed({ description: "A b", used: true }, "  A b ")).toBe(true);
    expect(actionPlanStillUsed({ description: "A b", used: true }, "A c")).toBe(false);
  });
});
