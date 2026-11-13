import { Router } from "express";
import { companyPortalController as c } from "../controllers/company-portal.controller";
import { authenticate, requireCompany } from "../middleware/auth.middleware";

/** Portal de empresa: solo GET, solo con token de empresa. */
export const companyPortalRoutes = Router();
companyPortalRoutes.use(authenticate, requireCompany());

companyPortalRoutes.get("/profile", (req, res, next) => c.profile(req, res, next));
companyPortalRoutes.get("/employees", (req, res, next) => c.employees(req, res, next));
companyPortalRoutes.get("/employees/forms-summary", (req, res, next) => c.formsSummary(req, res, next));
companyPortalRoutes.get("/employees/:studentId", (req, res, next) => c.employeeDetail(req, res, next));
companyPortalRoutes.get("/employees/:studentId/forms/:formKey", (req, res, next) =>
  c.employeeForm(req, res, next),
);
companyPortalRoutes.get("/forms/results", (req, res, next) => c.results(req, res, next));
companyPortalRoutes.get("/forms/:key", (req, res, next) => c.formDefinition(req, res, next));
companyPortalRoutes.get("/courses", (req, res, next) => c.courses(req, res, next));
companyPortalRoutes.get("/courses/:courseId", (req, res, next) => c.courseDetail(req, res, next));
