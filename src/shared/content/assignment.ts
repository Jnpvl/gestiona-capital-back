import type { AssignmentBlockContent } from "../../types/assignment.types";

export function createEmptyAssignmentContent(): AssignmentBlockContent {
  return { instructions: "", required: true };
}

export function parseAssignmentContent(
  raw: string | null | undefined,
): AssignmentBlockContent {
  if (!raw?.trim()) return createEmptyAssignmentContent();

  try {
    const parsed = JSON.parse(raw) as Partial<AssignmentBlockContent>;
    if (!parsed || typeof parsed !== "object") {
      return { instructions: raw, required: true };
    }

    return {
      instructions:
        typeof parsed.instructions === "string" ? parsed.instructions : raw,
      required: parsed.required !== false,
    };
  } catch {
    return { instructions: raw, required: true };
  }
}

export function serializeAssignmentContent(content: AssignmentBlockContent): string {
  return JSON.stringify({
    instructions: content.instructions ?? "",
    required: content.required !== false,
  });
}

export function isAssignmentBlockRequired(content: string | null | undefined): boolean {
  return parseAssignmentContent(content).required;
}
