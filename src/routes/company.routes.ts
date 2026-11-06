import { Router } from "express";
import { sendEmployeeAccess } from "../controllers/company.controller";
import { companyController } from "../controllers/company.controller";
import { formController } from "../controllers/form.controller";
import { uploadMiddleware } from "../controllers/upload.controller";
import { authenticate, requireStaff } from "../middleware/auth.middleware";

const staffAuth = [authenticate, requireStaff()];

export const companyRoutes = Router();

companyRoutes.get("/autocomplete", ...staffAuth, (req, res, next) =>
  companyController.autocomplete(req, res, next),
);

companyRoutes.get("/", ...staffAuth, (req, res, next) =>
  companyController.list(req, res, next),
);

companyRoutes.get("/:id", ...staffAuth, (req, res, next) =>
  companyController.getById(req, res, next),
);

companyRoutes.post("/", ...staffAuth, (req, res, next) =>
  companyController.create(req, res, next),
);

companyRoutes.put("/:id/access", ...staffAuth, (req, res, next) =>
  companyController.updateAccess(req, res, next),
);

companyRoutes.patch("/:id", ...staffAuth, (req, res, next) =>
  companyController.update(req, res, next),
);

companyRoutes.get("/:id/employees/template", ...staffAuth, (req, res, next) =>
  companyController.downloadEmployeesTemplate(req, res, next),
);

// Correo de accesos (genera contraseña nueva). Solo admin; no existe en el portal de empresa.
companyRoutes.post("/:id/employees/send-access", ...staffAuth, (req, res, next) =>
  sendEmployeeAccess(req, res, next),
);

companyRoutes.get("/:id/employees/forms-summary", ...staffAuth, (req, res, next) =>
  formController.employeesFormsSummary(req, res, next),
);

companyRoutes.get("/:id/employees/:studentId/forms/:formKey", ...staffAuth, (req, res, next) =>
  formController.employeeFormDetail(req, res, next),
);

companyRoutes.put("/:id/employees/:studentId/forms/:formKey", ...staffAuth, (req, res, next) =>
  formController.updateEmployeeForm(req, res, next),
);

companyRoutes.post("/:id/employees/import", ...staffAuth, uploadMiddleware, (req, res, next) =>
  companyController.importEmployees(req, res, next),
);

companyRoutes.get("/:id/courses", ...staffAuth, (req, res, next) =>
  companyController.listCourses(req, res, next),
);

companyRoutes.post("/:id/courses/assignments", ...staffAuth, (req, res, next) =>
  companyController.assignCourse(req, res, next),
);

companyRoutes.get("/:id/forms/results", ...staffAuth, (req, res, next) =>
  formController.companyResults(req, res, next),
);

companyRoutes.get("/:id/forms", ...staffAuth, (req, res, next) =>
  formController.companyForms(req, res, next),
);

companyRoutes.put("/:id/forms/assignments/:formKey/mode", ...staffAuth, (req, res, next) =>
  formController.setMode(req, res, next),
);

companyRoutes.delete("/:id/forms/assignments/:formKey", ...staffAuth, (req, res, next) =>
  formController.unassign(req, res, next),
);

companyRoutes.post("/:id/forms/assignments", ...staffAuth, (req, res, next) =>
  formController.assign(req, res, next),
);

companyRoutes.get("/:id/forms/:formKey/template", authenticate, requireStaff("admin"), (req, res, next) => formController.downloadTemplate(req, res, next));
companyRoutes.post("/:id/forms/:formKey/import", authenticate, requireStaff("admin"), uploadMiddleware, (req, res, next) => formController.importExcel(req, res, next));
