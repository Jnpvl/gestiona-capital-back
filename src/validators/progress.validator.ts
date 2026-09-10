import { z } from "zod";

export const saveCourseProgressSchema = z.object({
  lastLessonId: z.string().uuid().optional(),
  lessonUpdates: z
    .array(
      z.object({
        lessonId: z.string().uuid(),
        completed: z.boolean().optional(),
        accessed: z.boolean().optional(),
      }),
    )
    .optional(),
  blockUpdates: z
    .array(
      z.object({
        blockId: z.string().uuid(),
        answers: z.record(z.string(), z.number()).optional(),
        verified: z.boolean().optional(),
        passed: z.boolean().optional(),
        score: z.number().int().min(0).optional(),
        totalQuestions: z.number().int().min(0).optional(),
      }),
    )
    .optional(),
});
