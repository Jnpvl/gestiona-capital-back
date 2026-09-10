import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { AuthTokenPayload } from "../types/auth.types";
import type { StaffRole } from "../types/staff.types";

export class TokenService {
  signStaffToken(payload: { id: string; email: string; role: StaffRole }): string {
    const tokenPayload: AuthTokenPayload = {
      sub: payload.id,
      email: payload.email,
      accountType: "staff",
      role: payload.role,
    };

    return jwt.sign(tokenPayload, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"],
    });
  }

  signStudentToken(payload: { id: string; email: string }): string {
    const tokenPayload: AuthTokenPayload = {
      sub: payload.id,
      email: payload.email,
      accountType: "student",
    };

    return jwt.sign(tokenPayload, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"],
    });
  }

  verifyToken(token: string): AuthTokenPayload {
    return jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
  }
}

export const tokenService = new TokenService();
