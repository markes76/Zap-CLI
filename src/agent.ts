import { CliError } from "./errors.js";
import type { AgentFeedbackSummary, AgentPreference, AgentSuggestionResult, OutputFormat } from "./types.js";

export function emptyAgentFeedbackSummary(): AgentFeedbackSummary {
  return {
    count: 0,
    averageRating: null,
    preferredOutputFormat: null,
    topCommands: []
  };
}

export function validateAgentPreferenceKey(value: string): string {
  const key = value.trim();
  if (!/^[A-Za-z][A-Za-z0-9.-]{0,63}$/.test(key)) {
    throw new CliError("INVALID_ARGUMENTS", `Invalid preference key "${value}".`, "Use a key like preferred.output or budget.maxIls.");
  }
  return key;
}

export function validateAgentPreferenceValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new CliError("INVALID_ARGUMENTS", "Preference value must not be empty.");
  }
  if (trimmed.length > 500) {
    throw new CliError("INVALID_ARGUMENTS", "Preference value must be 500 characters or fewer.");
  }
  return trimmed;
}

export function validateAgentPreferenceForKey(key: string, value: string): string {
  if (key === "preferred.output") {
    validateFeedbackOutputFormat(value);
    return value;
  }
  if (key === "budget.maxIls") {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue <= 0) {
      throw new CliError("INVALID_ARGUMENTS", "budget.maxIls must be a positive number.");
    }
    return value;
  }
  return value;
}

export function validateFeedbackCommand(value: string): string {
  const command = value.trim().replace(/\s+/g, " ");
  if (!command) {
    throw new CliError("INVALID_ARGUMENTS", "Feedback command must not be empty.", "Pass --command \"search local iphone\".");
  }
  if (command.length > 300) {
    throw new CliError("INVALID_ARGUMENTS", "Feedback command must be 300 characters or fewer.");
  }
  return command;
}

export function validateFeedbackRating(value: number | undefined): number | null {
  if (value === undefined) {
    return null;
  }
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new CliError("INVALID_ARGUMENTS", "--rating must be an integer from 1 to 5.");
  }
  return value;
}

export function validateFeedbackNotes(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const notes = value.trim();
  if (notes.length > 1000) {
    throw new CliError("INVALID_ARGUMENTS", "Feedback notes must be 1000 characters or fewer.");
  }
  return notes || null;
}

export function validateFeedbackOutputFormat(value: string | undefined): OutputFormat | null {
  if (value === undefined) {
    return null;
  }
  if (value === "json" || value === "text" || value === "ndjson" || value === "csv") {
    return value;
  }
  throw new CliError("INVALID_ARGUMENTS", `Unsupported feedback output format "${value}".`, "Use json, text, ndjson, or csv.");
}

export function buildAgentSuggestionResult(
  cachePath: string,
  preferences: AgentPreference[],
  feedbackSummary: AgentFeedbackSummary
): AgentSuggestionResult {
  const recommendations = buildRecommendations(preferences, feedbackSummary);
  return {
    cachePath,
    preferences,
    feedbackSummary,
    recommendations,
    skillDraft: buildSkillDraft(preferences, feedbackSummary, recommendations)
  };
}

export function buildSkillDraft(
  preferences: AgentPreference[],
  feedbackSummary: AgentFeedbackSummary,
  recommendations = buildRecommendations(preferences, feedbackSummary)
): string[] {
  const lines = [
    "## User Preference Notes",
    "",
    "Use these notes as a proposed local companion to the ZAP CLI skill. Review before applying.",
    "",
    "Preferences:"
  ];

  if (preferences.length === 0) {
    lines.push("- No explicit preferences recorded yet.");
  } else {
    for (const preference of preferences) {
      lines.push(`- ${preference.key}: ${preference.value}`);
    }
  }

  lines.push("", "Feedback summary:");
  lines.push(`- Feedback records: ${feedbackSummary.count}`);
  lines.push(`- Average rating: ${feedbackSummary.averageRating === null ? "none" : feedbackSummary.averageRating.toFixed(2)}`);
  lines.push(`- Preferred output format: ${feedbackSummary.preferredOutputFormat ?? "none"}`);

  if (feedbackSummary.topCommands.length > 0) {
    lines.push("- Frequent commands:");
    for (const item of feedbackSummary.topCommands) {
      lines.push(`  - ${item.command}: ${item.count}`);
    }
  }

  lines.push("", "Recommended behavior:");
  for (const recommendation of recommendations) {
    lines.push(`- ${recommendation}`);
  }

  return lines;
}

function buildRecommendations(preferences: AgentPreference[], feedbackSummary: AgentFeedbackSummary): string[] {
  const preferenceMap = new Map(preferences.map((preference) => [preference.key, preference.value]));
  const recommendations: string[] = [];

  const outputFormat = preferenceMap.get("preferred.output") ?? feedbackSummary.preferredOutputFormat;
  if (outputFormat) {
    recommendations.push(`Default examples and agent handoffs should prefer --output ${outputFormat}.`);
  }

  const category = preferenceMap.get("preferred.category");
  if (category) {
    recommendations.push(`Start product discovery from category ${category} when the user has not specified a category.`);
  }

  const budget = preferenceMap.get("budget.maxIls");
  if (budget) {
    recommendations.push(`Use ${budget} ILS as the user's default maximum budget unless a task overrides it.`);
  }

  if (feedbackSummary.topCommands.length > 0) {
    const topCommand = feedbackSummary.topCommands[0];
    if (topCommand) {
      recommendations.push(`Surface ${topCommand.command} as a likely next command when relevant.`);
    }
  }

  if (recommendations.length === 0) {
    recommendations.push("Collect explicit preferences with agent profile set and feedback with agent feedback add before changing behavior.");
  }

  recommendations.push("Do not update shared skills or code automatically; propose reviewable diffs or PRs.");
  return recommendations;
}
