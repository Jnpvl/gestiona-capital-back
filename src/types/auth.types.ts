import type { StaffRole } from "./staff.types";
import type { StudentPublic } from "./student.types";

export type AccountType = "staff" | "student";

export interface AuthTokenPayload {
  sub: string;
  email: string;
  accountType: AccountType;
  role?: StaffRole;
}

export interface StaffLoginInput {
  email: string;
  password: string;
}

export interface StaffLoginResult {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: StaffRole;
    active: boolean;
    createdAt: string;
  };
}

export interface StudentLoginInput {
  email: string;
  password: string;
}

export interface StudentLoginResult {
  token: string;
  user: StudentPublic;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

export {};
