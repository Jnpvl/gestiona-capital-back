import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { pool } from "../config/database";
import { AppError } from "../errors/app-error";
import { findStudentById, findStudentEnrollments, findStudentsPaginated } from "../repositories/student.repository";
import { companyService } from "../services/company.service";
import { formService } from "../services/form.service";
import { parseEvaluationYearQuery } from "../validators/form.validator";

/**
 * Portal de empresa: SOLO LECTURA. El companyId siempre sale del token de empresa
 * (req.auth.sub), nunca de la URL ni del body.
 */
function companyIdOf(req: Request): string {
  if (!req.auth || req.auth.accountType !== "company") {
    throw new AppError(403, "Acceso denegado", "FORBIDDEN");
  }
  return req.auth.sub;
}

function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? v[0] : v;
}

const listQuery = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

export class CompanyPortalController {
  async profile(req: Request, res: Response, next: NextFunction) {
    try {
      const { company } = await companyService.getById(companyIdOf(req));
      // Sin datos de acceso: la empresa solo ve sus datos generales.
      const { accessEmail: _a, hasAccess: _h, lastLoginAt: _l, ...publicData } = company;
      res.json({ company: publicData });
    } catch (error) {
      next(error);
    }
  }

  async employees(req: Request, res: Response, next: NextFunction) {
    try {
      const q = listQuery.parse(req.query);
      const result = await findStudentsPaginated({ ...q, companyId: companyIdOf(req) });
      // La empresa no ve el estado de acceso (Activo/Inactivo) ni datos de envío de accesos.
      const students = result.students.map(
        ({ active: _a, accessEmailSentAt: _s, ...rest }) => rest,
      );
      res.json({ ...result, students });
    } catch (error) {
      next(error);
    }
  }

  async employeeDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = companyIdOf(req);
      const parsed = z.uuid().safeParse(param(req, "studentId"));
      const student = parsed.success ? await findStudentById(parsed.data) : null;
      if (!student || student.companyId !== companyId) {
        throw new AppError(404, "Empleado no encontrado", "EMPLOYEE_NOT_FOUND");
      }
      // Lista explícita: nunca expone notas internas ni información de acceso.
      const employee = {
        id: student.id,
        name: student.name,
        paternalLastName: student.paternalLastName,
        maternalLastName: student.maternalLastName,
        firstNames: student.firstNames,
        email: student.email,
        phone: student.phone,
        curp: student.curp,
        gender: student.gender,
        age: student.age,
        residenceLocation: student.residenceLocation,
        educationLevel: student.educationLevel,
        professionArea: student.professionArea,
        educationInstitution: student.educationInstitution,
        currentlyEmployed: student.currentlyEmployed,
        jobType: student.jobType,
        currentPosition: student.currentPosition,
        industrySector: student.industrySector,
        yearsExperience: student.yearsExperience,
        timeInCurrentPosition: student.timeInCurrentPosition,
        stpsOccupationCode: student.stpsOccupationCode,
        stpsOccupationName: student.stpsOccupationName,
        stpsThematicAreaCode: student.stpsThematicAreaCode,
        stpsThematicAreaName: student.stpsThematicAreaName,
        companyId: student.companyId,
        companyName: student.companyName,
        companyRfc: student.companyRfc,
      };
      const enrollments = await findStudentEnrollments(student.id);
      res.json({ student: employee, enrollments });
    } catch (error) {
      next(error);
    }
  }

  async formsSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const raw = typeof req.query.studentIds === "string" ? req.query.studentIds : "";
      const uuid = /^[0-9a-f-]{36}$/i;
      const ids = raw.split(",").map((s) => s.trim()).filter((s) => uuid.test(s));
      const companyId = companyIdOf(req);
      // Solo IDs de empleados de esta empresa; los ajenos se descartan.
      const { rows } = ids.length
        ? await pool.query<{ id: string }>(
            "SELECT id FROM students WHERE company_id = $1 AND id = ANY($2::uuid[])",
            [companyId, ids],
          )
        : { rows: [] as { id: string }[] };
      if (rows.length === 0) {
        res.json({ employees: {} });
        return;
      }
      res.json(await formService.employeesFormsSummary(companyId, rows.map((r) => r.id), parseEvaluationYearQuery(req.query.year)));
    } catch (error) {
      next(error);
    }
  }

  async employeeForm(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = companyIdOf(req);
      const studentId = param(req, "studentId");
      const student = await findStudentById(studentId).catch(() => null);
      if (!student || student.companyId !== companyId) {
        throw new AppError(404, "Empleado no encontrado", "EMPLOYEE_NOT_FOUND");
      }
      res.json(await formService.employeeFormDetail(companyId, studentId, param(req, "formKey"), parseEvaluationYearQuery(req.query.year)));
    } catch (error) {
      next(error);
    }
  }

  formDefinition(req: Request, res: Response, next: NextFunction) {
    try {
      companyIdOf(req);
      res.json(formService.getDefinition(param(req, "key")));
    } catch (error) {
      next(error);
    }
  }

  async results(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(
        await formService.companyResults(companyIdOf(req), parseEvaluationYearQuery(req.query.year)),
      );
    } catch (error) {
      next(error);
    }
  }
}

export const companyPortalController = new CompanyPortalController();
