export type AssignmentSubmissionStatus = "pending" | "approved" | "returned";

export interface AssignmentBlockContent {
  instructions: string;
  required: boolean;
}

export interface AssignmentProgressItem {
  blockId: string;
  submissionId: string | null;
  status: AssignmentSubmissionStatus | "none";
  attemptNumber: number;
  fileUrl: string | null;
  fileName: string | null;
  studentComment: string | null;
  reviewerComment: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
}

export interface AssignmentSubmissionListItem {
  id: string;
  enrollmentId: string;
  blockId: string;
  attemptNumber: number;
  fileUrl: string;
  fileName: string | null;
  studentComment: string | null;
  status: AssignmentSubmissionStatus;
  reviewerComment: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  submittedAt: string;
  studentName: string;
  studentEmail: string;
  assignmentTitle: string | null;
  lessonTitle: string;
  sectionTitle: string;
}

export interface ReviewAssignmentInput {
  status: "approved" | "returned";
  reviewerComment?: string | null;
}

export interface SubmitAssignmentInput {
  studentComment?: string | null;
}
