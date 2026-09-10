import { z } from "zod";

export const reviewAssignmentSchema = z.object({
  status: z.enum(["approved", "returned"]),
  reviewerComment: z.string().nullable().optional(),
});

export const listAssignmentsQuerySchema = z.object({
  status: z.enum(["pending", "approved", "returned", "all"]).optional().default("all"),
});
