import { Router } from "express";
import { individualReport } from "../controllers/individual-report.controller";
import { companyPortalController as c } from "../controllers/company-portal.controller";
import { authenticate, requireCompany } from "../middleware/auth.middleware";

/** Portal de empresa: token de empresa; companyId sale del token. */
export const companyPortalRoutes = Router();
companyPortalRoutes.use(authenticate, requireCompany());

companyPortalRoutes.get("/employees/:studentId/report", individualReport);

companyPortalRoutes.get("/profile", (req, res, next) => c.profile(req, res, next));
companyPortalRoutes.get("/employees", (req, res, next) => c.employees(req, res, next));
companyPortalRoutes.get("/employees/forms-summary", (req, res, next) => c.formsSummary(req, res, next));
companyPortalRoutes.get("/employees/:studentId", (req, res, next) => c.employeeDetail(req, res, next));
companyPortalRoutes.get("/employees/:studentId/forms/:formKey", (req, res, next) =>
  c.employeeForm(req, res, next),
);
companyPortalRoutes.get("/employees/:studentId/referral", (req, res, next) =>
  c.getEmployeeReferral(req, res, next),
);
companyPortalRoutes.put("/employees/:studentId/referral", (req, res, next) =>
  c.saveEmployeeReferral(req, res, next),
);
companyPortalRoutes.get("/forms/results", (req, res, next) => c.results(req, res, next));
companyPortalRoutes.get("/forms/:key", (req, res, next) => c.formDefinition(req, res, next));
companyPortalRoutes.get("/courses", (req, res, next) => c.courses(req, res, next));
companyPortalRoutes.get("/courses/:courseId", (req, res, next) => c.courseDetail(req, res, next));
companyPortalRoutes.get("/psychologists", (req, res, next) => c.listPsychologists(req, res, next));
companyPortalRoutes.post("/psychologists", (req, res, next) => c.createPsychologist(req, res, next));
companyPortalRoutes.put("/psychologists/:psychologistId", (req, res, next) =>
  c.updatePsychologist(req, res, next),
);
companyPortalRoutes.delete("/psychologists/:psychologistId", (req, res, next) =>
  c.deletePsychologist(req, res, next),
);
