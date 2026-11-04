import { AppError } from "../errors/app-error";
import { findCompanyById } from "../repositories/company.repository";
import { findStudentById } from "../repositories/student.repository";
import {
  findCompanyDemographics,
  countCompanyEmployees,
  createAssignment,
  findAssignmentsByCompany,
  findCompanyAssignedFormKeys,
  findCompanyCompletedResponses,
  findCompanyEmployeesBasic,
  findCompanyEmployeesFormsSummary,
  findCompanyGuideProgress,
  findCompanyGuidesInUse,
  findCompanyAssignedFormKeys as findAssignedKeys,
  unassignCompanyGuide,
  findEmployeeFormAnswers,
  findLatestResponseForEdit,
  saveEmployeeGuia5,
  saveFormResponse,
  updateFormResponseScore,
  setCompanyGuideMode,
  findStudentPendingForms,
  type FormMode,
} from "../repositories/form.repository";
import {
  ASSIGNABLE_FORM_KEYS,
  FORM_DEFINITIONS,
  FORM_KEYS,
  isFormKey,
  isSectionVisible,
  scoreForm,
  summarizeScore,
  RISK_LEVEL_LABEL,
  FREQUENCY_OPTIONS,
  YES_NO_OPTIONS, suggestFormKeys } from "../shared/forms";
import type { FormKey, FormScoreResult } from "../shared/forms";

/** La calificación guardada es válida si ya tiene el formato actual. */
function isCurrentScore(score: unknown): score is FormScoreResult {
  if (!score || typeof score !== "object") return false;
  const s = score as FormScoreResult;
  return typeof s.resultText === "string" || typeof s.final?.action === "string";
}

function summarize(key: FormKey) {
  const def = FORM_DEFINITIONS[key];
  const questions = def.sections.reduce((acc, s) => acc + s.questions.length, 0);
  const items = def.sections.reduce(
    (acc, s) => acc + s.questions.filter((q) => q.number != null).length,
    0,
  );
  return {
    key: def.key,
    norm: def.norm,
    title: def.title,
    subtitle: def.subtitle,
    description: def.description,
    questions,
    items,
  };
}

export class FormService {
  listDefinitions() {
    return { forms: FORM_KEYS.map(summarize) };
  }

  getDefinition(key: string) {
    if (!isFormKey(key)) throw new AppError(404, "Formulario no encontrado", "FORM_NOT_FOUND");
    return { form: FORM_DEFINITIONS[key] };
  }

  async getCompanyForms(companyId: string) {
    const company = await findCompanyById(companyId);
    if (!company) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    const employees = await countCompanyEmployees(companyId);
    const workersCount = company.workersCount ?? null;
    return {
      workersCount,
      employeesLinked: employees,
      suggestedFormKeys: suggestFormKeys(workersCount ?? (employees || null)),
      suggestionBasis: workersCount != null ? "workersCount" : "employeesLinked",
      forms: ASSIGNABLE_FORM_KEYS.map(summarize),
      assignments: await findAssignmentsByCompany(companyId),
      guideProgress: await findCompanyGuideProgress(companyId),
      assignedFormKeys: await findAssignedKeys(companyId),
      guidesInUse: await findCompanyGuidesInUse(companyId),
    };
  }

  async employeesFormsSummary(companyId: string, studentIds?: string[]) {
    const company = await findCompanyById(companyId);
    if (!company) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    const raw = await findCompanyEmployeesFormsSummary(companyId, studentIds);
    const employees: Record<string, unknown[]> = {};
    for (const [studentId, list] of Object.entries(raw)) {
      employees[studentId] = list.map(({ answers, ...state }) => {
        if (!answers || !isFormKey(state.formKey) || state.status !== "completed") return state;
        return { ...state, result: summarizeScore(scoreForm(FORM_DEFINITIONS[state.formKey], answers)) };
      });
    }
    return { employees };
  }

  /**
   * Dashboard: todos los empleados con el estado/resultado de Guías I, II, III y V.
   * I/II/III: not_assigned si la empresa no la tiene asignada; si no, estado + resultado (si está completa).
   */
  async companyResults(companyId: string) {
    const company = await findCompanyById(companyId);
    if (!company) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    const [employees, assigned, statuses, completed, demographics] = await Promise.all([
      findCompanyEmployeesBasic(companyId),
      findCompanyAssignedFormKeys(companyId),
      findCompanyEmployeesFormsSummary(companyId),
      findCompanyCompletedResponses(companyId),
      findCompanyDemographics(companyId),
    ]);
    const resultBy = new Map<string, ReturnType<typeof buildResult>>();
    function buildResult(row: (typeof completed)[number], form: (typeof FORM_DEFINITIONS)[FormKey], s: FormScoreResult) {
      const summary = summarizeScore(s);
      return {
        total: summary?.total ?? null,
        level: summary?.level ?? null,
        levelLabel: summary?.level ? RISK_LEVEL_LABEL[summary.level] : null,
        requiresClinicalAssessment: summary?.requiresClinicalAssessment ?? null,
        resultText: summary?.resultText ?? null,
        action: summary?.action ?? "",
        categories: s.categories ?? [],
        domains: s.domains ?? [],
        completedAt: row.completedAt,
        updatedAt: row.updatedAt,
        formTitle: form.title,
      };
    }
    for (const row of completed) {
      if (!isFormKey(row.formKey)) continue;
      const form = FORM_DEFINITIONS[row.formKey];
      let score = row.score;
      if (!isCurrentScore(score)) {
        // Respuestas previas sin calificación o con formato anterior: se recalcula y guarda.
        score = scoreForm(form, row.answers);
        await updateFormResponseScore(row.responseId, score);
      }
      resultBy.set(`${row.studentId}:${row.formKey}`, buildResult(row, form, score as FormScoreResult));
    }
    const employeeIds = new Set(employees.map(e => e.id));
    const profiles = demographics.filter(row => employeeIds.has(row.student_id));
    const riskGuides = (["nom035_guia2", "nom035_guia3"] as const).filter(key => assigned.includes(key));
    const demographicSummary = {
      riskGuides,
      total: employees.length,
      completed: profiles.filter(row => row.completed).length,
      partial: profiles.filter(row => !row.completed && Object.keys(row.answers).length > 0).length,
      fields: FORM_DEFINITIONS.nom035_guia5.sections.flatMap(section => section.questions.map(question => {
        type RiskCounts = Record<string, number>;
        const counts = new Map<string, { count: number; risks: Record<string, RiskCounts> }>();
        for (const profile of profiles) {
          const raw = profile.answers[question.id]?.trim();
          if (!raw) continue;
          const label = question.options?.find(option => option.value === raw)?.label ?? raw;
          const group = counts.get(label) ?? { count: 0, risks: Object.fromEntries(riskGuides.map(key => [key, { nulo: 0, bajo: 0, medio: 0, alto: 0, muy_alto: 0, sin_resultado: 0 }])) };
          group.count++;
          for (const key of riskGuides) {
            const result = resultBy.get(`${profile.student_id}:${key}`);
            const status = statuses[profile.student_id]?.find(form => form.formKey === key)?.status;
            const level = status === "completed" ? result?.level : null;
            group.risks[key][level ?? "sin_resultado"]++;
          }
          counts.set(label, group);
        }
        const answered = [...counts.values()].reduce((sum, group) => sum + group.count, 0);
        return {
          key: question.id, name: question.text.replace(/:$/, ""), answered,
          groups: [...counts.entries()].map(([name, group]) => ({ name, ...group }))
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es")),
        };
      })),
    };
    const guides = ["nom035_guia1", "nom035_guia2", "nom035_guia3"] as const;
    return {
      assignedFormKeys: assigned,
      demographics: demographicSummary,
      employees: employees.map((e) => {
        const list = statuses[e.id] ?? [];
        const statusOf = (k: string) => list.find((f) => f.formKey === k)?.status ?? "not_applied";
        const forms: Record<string, unknown> = {};
        for (const k of guides) {
          forms[k] = assigned.includes(k)
            ? { status: statusOf(k), result: resultBy.get(`${e.id}:${k}`) ?? null }
            : { status: "not_assigned", result: null };
        }
        forms.nom035_guia5 = { status: statusOf("nom035_guia5"), result: null };
        return { studentId: e.id, employeeName: e.name, forms };
      }),
    };
  }

  async employeeFormDetail(companyId: string, studentId: string, formKey: string) {
    if (!isFormKey(formKey)) throw new AppError(404, "Formulario no encontrado", "FORM_NOT_FOUND");
    const company = await findCompanyById(companyId);
    if (!company) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    const data = await findEmployeeFormAnswers(companyId, studentId, formKey);
    if (!data) {
      // Sin datos aún: se puede aplicar (Guía V siempre; I/II/III si hay asignación).
      const applicable =
        formKey === "nom035_guia5" ||
        (await findLatestResponseForEdit(companyId, studentId, formKey)) != null;
      if (applicable) {
        return {
          formKey,
          answers: {} as Record<string, string>,
          status: "not_applied" as const,
          updatedAt: null,
        };
      }
      throw new AppError(404, "El empleado no tiene datos de este formulario", "FORM_DATA_NOT_FOUND");
    }
    return { formKey, ...data };
  }

  async updateEmployeeForm(
    companyId: string,
    studentId: string,
    formKey: string,
    patch: Record<string, unknown>,
    staffId: string | null,
    /**
     * asStudent: lo contesta el propio empleado (solo guías "self", no completadas).
     * finalize: el empleado envía; exige todas las preguntas visibles contestadas.
     */
    opts: { asStudent?: boolean; finalize?: boolean } = {},
  ) {
    if (!isFormKey(formKey)) throw new AppError(404, "Formulario no encontrado", "FORM_NOT_FOUND");
    const company = await findCompanyById(companyId);
    if (!company) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    const student = await findStudentById(studentId);
    if (!student || student.companyId !== companyId) {
      throw new AppError(404, "El empleado no pertenece a esta empresa", "EMPLOYEE_NOT_FOUND");
    }
    const form = FORM_DEFINITIONS[formKey];
    const questions = new Map(
      form.sections.flatMap((s) => s.questions.map((q) => [q.id, q] as const)),
    );

    // Validación contra la definición, con error por campo.
    const fields: { field: string; label: string; message: string }[] = [];
    const clean: Record<string, string> = {};
    for (const [id, raw] of Object.entries(patch ?? {})) {
      const q = questions.get(id);
      const label = q
        ? `${q.number != null ? `${q.number}. ` : ""}${q.text.replace(/:$/, "")}`
        : id;
      if (!q) {
        fields.push({ field: `answers.${id}`, label, message: "no es una pregunta de este formulario" });
        continue;
      }
      if (raw == null || raw === "") {
        clean[id] = "";
        continue;
      }
      if (typeof raw !== "string") {
        fields.push({ field: `answers.${id}`, label, message: "debe ser texto" });
        continue;
      }
      const value = raw.trim();
      const kind = q.kind ?? (form.scale === "yesno" ? "yesno" : form.scale === "frequency" ? "choice" : "text");
      if (kind === "text") {
        if (value.length > 200) fields.push({ field: `answers.${id}`, label, message: "máximo 200 caracteres" });
        else clean[id] = value;
        continue;
      }
      const options: readonly { value: string }[] =
        q.options ?? (kind === "yesno" || form.scale === "yesno" ? YES_NO_OPTIONS : FREQUENCY_OPTIONS);
      if (!options.some((o) => o.value === value)) {
        fields.push({ field: `answers.${id}`, label, message: `"${value}" no es una opción válida` });
      } else {
        clean[id] = value;
      }
    }
    if (fields.length > 0) {
      throw new AppError(
        400,
        fields.map((f) => `${f.label}: ${f.message}`).join("; "),
        "VALIDATION_ERROR",
        fields,
      );
    }

    const merge = (base: Record<string, string>) => {
      const out: Record<string, string> = { ...base };
      for (const [k, v] of Object.entries(clean)) {
        if (v) out[k] = v;
        else delete out[k];
      }
      return out;
    };
    const isComplete = (answers: Record<string, string>) =>
      form.sections
        .filter((s) => isSectionVisible(s, answers, form))
        .every((s) => s.questions.every((q) => !!answers[q.id]));

    if (opts.asStudent && formKey === "nom035_guia5") {
      throw new AppError(404, "Formulario no disponible", "FORM_NOT_AVAILABLE");
    }
    if (formKey === "nom035_guia5") {
      const current = await findEmployeeFormAnswers(companyId, studentId, formKey);
      const answers = merge(current?.answers ?? {});
      await saveEmployeeGuia5({
        companyId,
        studentId,
        answers,
        completed: isComplete(answers),
        staffId,
      });
    } else {
      const target = await findLatestResponseForEdit(companyId, studentId, formKey);
      if (!target) {
        throw new AppError(
          409,
          `${form.title}: la empresa no tiene una asignación de este formulario. Asígnalo primero en la pestaña Formularios`,
          "FORM_NOT_ASSIGNED",
        );
      }
      if (opts.asStudent) {
        if (target.mode !== "self") {
          throw new AppError(404, "Formulario no disponible", "FORM_NOT_AVAILABLE");
        }
        if (target.status === "completed") {
          throw new AppError(409, "Este formulario ya fue enviado y no se puede modificar", "FORM_ALREADY_COMPLETED");
        }
      }
      // Solo se conservan respuestas de secciones visibles.
      const merged = merge(target.answers);
      const answers: Record<string, string> = {};
      for (const s of form.sections) {
        if (!isSectionVisible(s, merged, form)) continue;
        for (const q of s.questions) if (merged[q.id]) answers[q.id] = merged[q.id];
      }
      const complete = isComplete(answers);
      if (opts.asStudent && opts.finalize && !complete) {
        throw new AppError(400, "Contesta todas las preguntas antes de enviar", "FORM_INCOMPLETE");
      }
      // El empleado solo completa al enviar; el admin completa en cuanto están todas.
      const completes = opts.asStudent ? !!opts.finalize && complete : complete;
      await saveFormResponse({
        assignmentId: target.assignmentId,
        studentId,
        formKey,
        answers,
        status: completes ? "completed" : Object.keys(answers).length > 0 ? "in_progress" : "pending",
        score: completes ? scoreForm(form, answers) : null,
      });
      if (opts.asStudent) {
        return { formKey, answers, status: completes ? "completed" : "in_progress", updatedAt: null };
      }
    }
    return this.employeeFormDetail(companyId, studentId, formKey);
  }

  async assign(
    companyId: string,
    input: { formKeys: FormKey[]; modes?: Partial<Record<FormKey, FormMode>>; dueAt?: Date | null },
    createdByStaffId: string | null,
  ) {
    const company = await findCompanyById(companyId);
    if (!company) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    // No se duplican guías ya asignadas a la empresa.
    const already = await findAssignedKeys(companyId);
    const newKeys = input.formKeys.filter((k) => !already.includes(k));
    if (newKeys.length === 0) {
      throw new AppError(
        400,
        "Formularios: las guías seleccionadas ya están asignadas a esta empresa",
        "FORMS_ALREADY_ASSIGNED",
        [{ field: "formKeys", label: "Formularios", message: "las guías seleccionadas ya están asignadas a esta empresa" }],
      );
    }
    const assignment = await createAssignment({
      companyId,
      formKeys: newKeys,
      formModes: Object.fromEntries(newKeys.map((k) => [k, input.modes?.[k] ?? "admin_applied"])),
      dueAt: input.dueAt ?? null,
      createdByStaffId,
    });
    // TODO(formularios): enviar a cada empleado el enlace para responder (correo/WhatsApp).
    // Hook pendiente: notifyFormAssignment(assignment.id). No se envía nada por ahora.
    return { assignment };
  }

  async setMode(companyId: string, formKey: string, mode: FormMode) {
    if (!isFormKey(formKey) || formKey === "nom035_guia5") {
      throw new AppError(404, "Formulario no encontrado", "FORM_NOT_FOUND");
    }
    const company = await findCompanyById(companyId);
    if (!company) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    const title = FORM_DEFINITIONS[formKey].title;
    const { inUse, updated } = await setCompanyGuideMode(companyId, formKey, mode);
    if (inUse > 0) {
      const msg = `no se puede cambiar el modo: ${inUse} ${inUse === 1 ? "empleado ya la empezó" : "empleados ya la empezaron"}`;
      throw new AppError(409, `${title}: ${msg}`, "FORM_IN_USE", [{ field: "mode", label: title, message: msg }]);
    }
    if (updated === 0) {
      throw new AppError(404, `${title}: no está asignada a esta empresa`, "FORM_NOT_ASSIGNED");
    }
    return { formKey, mode };
  }

  // ---- Portal del empleado (alumno). studentId siempre del token. ----

  private async studentCompany(studentId: string): Promise<string> {
    const student = await findStudentById(studentId);
    if (!student?.companyId) throw new AppError(404, "Formulario no disponible", "FORM_NOT_AVAILABLE");
    return student.companyId;
  }

  async studentPendingForms(studentId: string) {
    const student = await findStudentById(studentId);
    if (!student?.companyId) return { forms: [] };
    const pending = await findStudentPendingForms(student.companyId, studentId);
    return {
      forms: pending
        .filter((p) => isFormKey(p.formKey))
        .map((p) => {
          const def = FORM_DEFINITIONS[p.formKey as FormKey];
          return { ...p, title: def.title, subtitle: def.subtitle, description: def.description };
        }),
    };
  }

  /** Definición + respuestas guardadas. Solo guías self no completadas de su empresa. Sin resultados. */
  async studentForm(studentId: string, formKey: string) {
    if (!isFormKey(formKey) || formKey === "nom035_guia5") {
      throw new AppError(404, "Formulario no disponible", "FORM_NOT_AVAILABLE");
    }
    const companyId = await this.studentCompany(studentId);
    const target = await findLatestResponseForEdit(companyId, studentId, formKey);
    if (!target || target.mode !== "self" || target.status === "completed") {
      throw new AppError(404, "Formulario no disponible", "FORM_NOT_AVAILABLE");
    }
    return { form: FORM_DEFINITIONS[formKey], answers: target.answers, status: target.status ?? "pending" };
  }

  async studentSave(studentId: string, formKey: string, answers: Record<string, unknown>, finalize: boolean) {
    const companyId = await this.studentCompany(studentId);
    const saved = (await this.updateEmployeeForm(companyId, studentId, formKey, answers, null, {
      asStudent: true,
      finalize,
    })) as { status: string };
    return { formKey, status: saved.status };
  }

  async unassign(companyId: string, formKey: string) {
    if (!isFormKey(formKey) || formKey === "nom035_guia5") {
      throw new AppError(404, "Formulario no encontrado", "FORM_NOT_FOUND");
    }
    const company = await findCompanyById(companyId);
    if (!company) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    const title = FORM_DEFINITIONS[formKey].title;
    const { inUse, removed } = await unassignCompanyGuide(companyId, formKey);
    if (inUse > 0) {
      const msg = `no se puede desasignar: ${inUse} ${inUse === 1 ? "empleado ya la empezó" : "empleados ya la empezaron"}`;
      throw new AppError(409, `${title}: ${msg}`, "FORM_IN_USE", [
        { field: "formKey", label: title, message: msg },
      ]);
    }
    if (removed === 0) {
      throw new AppError(404, `${title}: no está asignada a esta empresa`, "FORM_NOT_ASSIGNED", [
        { field: "formKey", label: title, message: "no está asignada a esta empresa" },
      ]);
    }
    return { formKey, unassigned: true };
  }
}

export const formService = new FormService();
