export const QUIZ_PASSING_PERCENT = 80;

export function getRequiredQuizScore(totalQuestions: number): number {
  if (totalQuestions <= 0) return 1;
  return Math.max(1, Math.ceil((totalQuestions * QUIZ_PASSING_PERCENT) / 100));
}

export function isQuizScorePassing(score: number, totalQuestions: number): boolean {
  return score >= getRequiredQuizScore(totalQuestions);
}
