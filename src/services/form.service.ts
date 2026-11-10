import { AppError } from "../errors/app-error";
import { findCompanyById } from "../repositories/company.repository";
import { findStudentById } from "../repositories/student.repository";
import {
  findCompanyDemographics,
  countCompanyEmployees,
  createAssignment,
  currentEvaluationYear,
  findAssignmentsByCompany,
  findCompanyAssignedFormKeys,
  findCompanyCompletedResponses,
  findCompanyActiveEmployeeIds,
  findCompanyEmployeesBasic,
  findCompanyEmployeesFormsSummary,
  findCompanyEvaluationYears,
  findCompanyGuideProgress,
  findCompanyGuidesInUse,
  findCompanyAssignedFormKeys as findAssignedKeys,
  findGuideSampling,
  unassignCompanyGuide,
  findEmployeeFormAnswers,
  findLatestResponseForEdit,
  saveEmployeeGuia5,
  saveFormResponse,
  updateFormResponseScore,
  setCompanyGuideMode,
  findStudentPendingForms,
  type FormMode,
  type GuideSamplingMeta,
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
import { buildCensusMeta, buildSampleMeta } from "../shared/forms/sampling";
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

  async getCompanyForms(companyId: string, evaluationYear?: number) {
    const company = await findCompanyById(companyId);
    if (!company) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    const year = evaluationYear ?? currentEvaluationYear();
    const employees = await countCompanyEmployees(companyId);
    const workersCount = company.workersCount ?? null;
    const evaluationYears = await findCompanyEvaluationYears(companyId);
    return {
      evaluationYear: year,
      evaluationYears,
      workersCount,
      employeesLinked: employees,
      suggestedFormKeys: suggestFormKeys(workersCount ?? (employees || null)),
      suggestionBasis: workersCount != null ? "workersCount" : "employeesLinked",
      forms: ASSIGNABLE_FORM_KEYS.map(summarize),
      assignments: await findAssignmentsByCompany(companyId, year),
      guideProgress: await findCompanyGuideProgress(companyId, year),
      assignedFormKeys: await findAssignedKeys(companyId, year),
      guidesInUse: await findCompanyGuidesInUse(companyId, year),
    };
  }

  async employeesFormsSummary(companyId: string, studentIds?: string[], evaluationYear?: number) {
    const company = await findCompanyById(companyId);
    if (!company) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    const year = evaluationYear ?? currentEvaluationYear();
    const raw = await findCompanyEmployeesFormsSummary(companyId, studentIds, year);
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
  async companyResults(companyId: string, evaluationYear?: number) {
    const company = await findCompanyById(companyId);
    if (!company) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    const year = evaluationYear ?? currentEvaluationYear();
    const [employees, assigned, statuses, completed, demographics, evaluationYears, guia3Sampling] =
      await Promise.all([
        findCompanyEmployeesBasic(companyId),
        findCompanyAssignedFormKeys(companyId, year),
        findCompanyEmployeesFormsSummary(companyId, undefined, year),
        findCompanyCompletedResponses(companyId, year),
        findCompanyDemographics(companyId, year),
        findCompanyEvaluationYears(companyId),
        findGuideSampling(companyId, "nom035_guia3", year),
      ]);
    const sampleSelected =
      guia3Sampling?.mode === "sample"
        ? new Set(guia3Sampling.selectedStudentIds)
        : null;
    const resultBy = new Map<string, ReturnType<typeof buildResult>>();
    function buildResult(row: (typeof completed)[number], form: (typeof FORM_DEFINITIONS)[FormKey], s: FormScoreResult) {
      const summary = summarizeScore(s);
      return {
        total: summary?.total ?? null,
        level: summary?.level ?? null,
        levelLabel: summary?.level ? RISK_LEVEL_LABEL[summary.level] : null,
        requiresClinicalAssessment: summary?.requiresClinicalAssessment ?? null,
        traumaticEventReported: summary?.traumaticEventReported ?? null,
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
      if (!isCurrentScore(score) || (row.formKey === "nom035_guia1" && typeof (score as FormScoreResult)?.traumaticEventReported !== "boolean")) {
        // Respuestas previas sin calificación o con formato anterior: se recalcula y guarda.
        score = scoreForm(form, row.answers);
        await updateFormResponseScore(row.responseId, score);
      }
      resultBy.set(`${row.studentId}:${row.formKey}`, buildResult(row, form, score as FormScoreResult));
    }
    const employeeIds = new Set(employees.map(e => e.id));
    // En muestreo, demografía del dashboard = solo seleccionados (Guía V de no seleccionados queda en BD).
    const profiles = demographics.filter(
      (row) => employeeIds.has(row.student_id) && (!sampleSelected || sampleSelected.has(row.student_id)),
    );
    const genderByStudent = new Map(
      demographics
        .filter((row) => employeeIds.has(row.student_id))
        .map((row) => [row.student_id, row.answers.sexo?.trim() || ""] as const),
    );
    const riskGuides = (["nom035_guia2", "nom035_guia3"] as const).filter(key => assigned.includes(key));
    const demographicUniverse = sampleSelected
      ? employees.filter((e) => sampleSelected.has(e.id)).length
      : employees.length;
    const demographicSummary = {
      riskGuides,
      total: demographicUniverse,
      completed: profiles.filter(row => row.completed).length,
      partial: profiles.filter(row => !row.completed && Object.keys(row.answers).length > 0).length,
      fields: FORM_DEFINITIONS.nom035_guia5.sections.flatMap(section => section.questions.map(question => {
        type RiskCounts = Record<string, number>;
        const counts = new Map<string, { count: number; studentIds: string[]; risks: Record<string, RiskCounts> }>();
        for (const profile of profiles) {
          const raw = profile.answers[question.id]?.trim();
          if (!raw) continue;
          const label = question.options?.find(option => option.value === raw)?.label ?? raw;
          const group = counts.get(label) ?? { count: 0, studentIds: [] as string[], risks: Object.fromEntries(riskGuides.map(key => [key, { nulo: 0, bajo: 0, medio: 0, alto: 0, muy_alto: 0, sin_resultado: 0 }])) };
          group.count++;
          group.studentIds.push(profile.student_id);
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

    /** Conteos de "Sí" por pregunta de Guía I, segmentados por sexo (Guía V). */
    const guide1Completed = completed.filter((row) => row.formKey === "nom035_guia1");
    const employeeNameById = new Map(employees.map((employee) => [employee.id, employee.name]));
    type Guide1Person = { studentId: string; name: string };
    const emptyGenderBucket = () => ({
      men: [] as Guide1Person[],
      women: [] as Guide1Person[],
      other: [] as Guide1Person[],
      unspecified: [] as Guide1Person[],
      all: [] as Guide1Person[],
    });
    function pushGender(bucket: ReturnType<typeof emptyGenderBucket>, studentId: string) {
      const person = {
        studentId,
        name: employeeNameById.get(studentId) ?? "—",
      };
      const sexo = genderByStudent.get(studentId) ?? "";
      if (sexo === "Masculino") bucket.men.push(person);
      else if (sexo === "Femenino") bucket.women.push(person);
      else if (sexo) bucket.other.push(person);
      else bucket.unspecified.push(person);
      bucket.all.push(person);
    }
    const guide1ResponseSummary = assigned.includes("nom035_guia1")
      ? {
          evaluated: guide1Completed.length,
          sections: FORM_DEFINITIONS.nom035_guia1.sections.map((section) => {
            const questions = section.questions.map((question) => {
              const people = emptyGenderBucket();
              for (const row of guide1Completed) {
                if (row.answers[question.id] === "si") pushGender(people, row.studentId);
              }
              return {
                id: question.id,
                text: question.resultQuestion ?? question.text,
                men: people.men.length,
                women: people.women.length,
                other: people.other.length,
                unspecified: people.unspecified.length,
                total: people.all.length,
                people,
              };
            });
            return {
              id: section.id,
              title: section.title,
              instructions: section.instructions ?? null,
              totalYes: questions.reduce((sum, question) => sum + question.total, 0),
              questions,
            };
          }),
        }
      : null;

    const guides = ["nom035_guia1", "nom035_guia2", "nom035_guia3"] as const;
    return {
      evaluationYear: year,
      evaluationYears,
      assignedFormKeys: assigned,
      sampling: {
        nom035_guia3: guia3Sampling,
      },
      demographics: demographicSummary,
      guide1ResponseSummary,
      employees: employees.map((e) => {
        const list = statuses[e.id] ?? [];
        const statusOf = (k: string) => list.find((f) => f.formKey === k)?.status ?? "not_applied";
        const forms: Record<string, unknown> = {};
        for (const k of guides) {
          if (!assigned.includes(k)) {
            forms[k] = { status: "not_assigned", result: null };
            continue;
          }
          let status = statusOf(k);
          if (
            k === "nom035_guia3" &&
            sampleSelected &&
            !sampleSelected.has(e.id) &&
            status !== "completed" &&
            status !== "partial"
          ) {
            status = "not_selected";
          }
          forms[k] = {
            status,
            result: status === "not_selected" ? null : resultBy.get(`${e.id}:${k}`) ?? null,
          };
        }
        forms.nom035_guia5 = { status: statusOf("nom035_guia5"), result: null };
        return { studentId: e.id, employeeName: e.name, forms };
      }),
    };
  }

  async employeeFormDetail(companyId: string, studentId: string, formKey: string, evaluationYear?: number) {
    if (!isFormKey(formKey)) throw new AppError(404, "Formulario no encontrado", "FORM_NOT_FOUND");
    const company = await findCompanyById(companyId);
    if (!company) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    const year = evaluationYear ?? currentEvaluationYear();
    if (formKey === "nom035_guia3") {
      const sampling = await findGuideSampling(companyId, "nom035_guia3", year);
      if (
        sampling?.mode === "sample" &&
        !sampling.selectedStudentIds.includes(studentId)
      ) {
        return {
          formKey,
          answers: {} as Record<string, string>,
          status: "not_selected" as const,
          updatedAt: null,
        };
      }
    }
    const data = await findEmployeeFormAnswers(companyId, studentId, formKey, year);
    if (!data) {
      // Sin datos aún: se puede aplicar (Guía V siempre; I/II/III si hay asignación).
      const applicable =
        formKey === "nom035_guia5" ||
        (await findLatestResponseForEdit(companyId, studentId, formKey, year)) != null;
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
    opts: {
      asStudent?: boolean;
      finalize?: boolean;
      onlyIfEmpty?: boolean;
      evaluationYear?: number;
    } = {},
  ) {
    if (!isFormKey(formKey)) throw new AppError(404, "Formulario no encontrado", "FORM_NOT_FOUND");
    const company = await findCompanyById(companyId);
    if (!company) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    const student = await findStudentById(studentId);
    if (!student || student.companyId !== companyId) {
      throw new AppError(404, "El empleado no pertenece a esta empresa", "EMPLOYEE_NOT_FOUND");
    }
    const evaluationYear = opts.evaluationYear ?? currentEvaluationYear();
    if (formKey === "nom035_guia3") {
      const sampling = await findGuideSampling(companyId, "nom035_guia3", evaluationYear);
      if (
        sampling?.mode === "sample" &&
        !sampling.selectedStudentIds.includes(studentId)
      ) {
        throw new AppError(
          409,
          "Guía III: el empleado no fue seleccionado para el muestreo",
          "NOT_IN_SAMPLE",
        );
      }
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
      const current = await findEmployeeFormAnswers(companyId, studentId, formKey, evaluationYear);
      const answers = merge(current?.answers ?? {});
      await saveEmployeeGuia5({
        companyId,
        studentId,
        answers,
        completed: isComplete(answers),
        staffId,
        evaluationYear,
      });
    } else {
      const target = await findLatestResponseForEdit(companyId, studentId, formKey, evaluationYear);
      if (!target) {
        throw new AppError(
          409,
          `${form.title}: la empresa no tiene una asignación de este formulario para ${evaluationYear}. Asígnalo primero en la pestaña Formularios`,
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
      const saved = await saveFormResponse({
        onlyIfEmpty: opts.onlyIfEmpty,
        assignmentId: target.assignmentId,
        studentId,
        formKey,
        answers,
        status: completes ? "completed" : Object.keys(answers).length > 0 ? "in_progress" : "pending",
        score: completes ? scoreForm(form, answers) : null,
      });
      if (opts.onlyIfEmpty && !saved) throw new AppError(409, "La evaluación ya tiene respuestas; no se sobrescribió", "RESPONSE_EXISTS");
      if (opts.asStudent) {
        return { formKey, answers, status: completes ? "completed" : "in_progress", updatedAt: null };
      }
    }
    return this.employeeFormDetail(companyId, studentId, formKey, evaluationYear);
  }

  async assign(
    companyId: string,
    input: {
      formKeys: FormKey[];
      modes?: Partial<Record<FormKey, FormMode>>;
      guia3SamplingMode?: "census" | "sample";
      evaluationYear?: number;
      dueAt?: Date | null;
    },
    createdByStaffId: string | null,
  ) {
    const company = await findCompanyById(companyId);
    if (!company) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    const year = input.evaluationYear ?? currentEvaluationYear();
    // No se duplican guías ya asignadas a la empresa en el mismo año.
    const already = await findAssignedKeys(companyId, year);
    const newKeys = input.formKeys.filter((k) => !already.includes(k));
    if (newKeys.length === 0) {
      throw new AppError(
        400,
        `Formularios: las guías seleccionadas ya están asignadas para ${year}`,
        "FORMS_ALREADY_ASSIGNED",
        [{ field: "formKeys", label: "Formularios", message: `las guías seleccionadas ya están asignadas para ${year}` }],
      );
    }

    const sampling: Record<string, GuideSamplingMeta> = {};
    if (newKeys.includes("nom035_guia3")) {
      const mode = input.guia3SamplingMode ?? "census";
      const [activeIds, demographics] = await Promise.all([
        findCompanyActiveEmployeeIds(companyId),
        findCompanyDemographics(companyId, year),
      ]);
      if (activeIds.length === 0) {
        throw new AppError(
          400,
          "Guía III: no hay empleados activos para asignar",
          "NO_ACTIVE_EMPLOYEES",
          [{ field: "formKeys", label: "Guía III", message: "no hay empleados activos para asignar" }],
        );
      }
      const sexoById = new Map(
        demographics.map((d) => [d.student_id, d.answers.sexo?.trim() || ""] as const),
      );
      if (mode === "sample") {
        const missingSexo = activeIds.filter((id) => !sexoById.get(id));
        if (missingSexo.length > 0) {
          throw new AppError(
            400,
            `Guía III (muestreo): falta sexo en Guía V de ${missingSexo.length} ${missingSexo.length === 1 ? "empleado" : "empleados"}. Carga la Guía V completa antes de armar la muestra.`,
            "SAMPLE_REQUIRES_GUIA5",
            [{
              field: "guia3SamplingMode",
              label: "Muestreo Guía III",
              message: `falta sexo en Guía V de ${missingSexo.length} empleado(s)`,
            }],
          );
        }
        sampling.nom035_guia3 = buildSampleMeta(activeIds, (id) => sexoById.get(id) || "Sin dato");
      } else {
        sampling.nom035_guia3 = buildCensusMeta(activeIds);
      }
    }

    const assignment = await createAssignment({
      companyId,
      formKeys: newKeys,
      formModes: Object.fromEntries(newKeys.map((k) => [k, input.modes?.[k] ?? "admin_applied"])),
      evaluationYear: year,
      dueAt: input.dueAt ?? null,
      createdByStaffId,
      sampling,
    });
    // TODO(formularios): enviar a cada empleado el enlace para responder (correo/WhatsApp).
    // Hook pendiente: notifyFormAssignment(assignment.id). No se envía nada por ahora.
    return { assignment, sampling: sampling.nom035_guia3 ?? null };
  }

  async setMode(companyId: string, formKey: string, mode: FormMode, evaluationYear?: number) {
    if (!isFormKey(formKey) || formKey === "nom035_guia5") {
      throw new AppError(404, "Formulario no encontrado", "FORM_NOT_FOUND");
    }
    const company = await findCompanyById(companyId);
    if (!company) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    const year = evaluationYear ?? currentEvaluationYear();
    const title = FORM_DEFINITIONS[formKey].title;
    const { inUse, updated } = await setCompanyGuideMode(companyId, formKey, mode, year);
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

  async unassign(companyId: string, formKey: string, evaluationYear?: number) {
    if (!isFormKey(formKey) || formKey === "nom035_guia5") {
      throw new AppError(404, "Formulario no encontrado", "FORM_NOT_FOUND");
    }
    const company = await findCompanyById(companyId);
    if (!company) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    const year = evaluationYear ?? currentEvaluationYear();
    const title = FORM_DEFINITIONS[formKey].title;
    const { inUse, removed } = await unassignCompanyGuide(companyId, formKey, year);
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
