export type AlumnoGender = "masculino" | "femenino" | "otro";

export type EducationLevel =
  | "sin_formacion"
  | "primaria"
  | "secundaria"
  | "preparatoria"
  | "tecnico_superior"
  | "licenciatura"
  | "maestria"
  | "doctorado";

export type JobType =
  | "operativo"
  | "profesional_tecnico"
  | "supervisor"
  | "gerente"
  | "otro";

export interface AlumnoProfileFields {
  gender: AlumnoGender;
  age: number;
  residenceLocation: string;
  educationLevel?: EducationLevel | null;
  professionArea?: string | null;
  educationInstitution?: string | null;
  currentlyEmployed?: boolean | null;
  jobType?: JobType | null;
  currentPosition?: string | null;
  industrySector?: string | null;
  yearsExperience?: number | null;
  timeInCurrentPosition?: string | null;
}

export interface AlumnoStpsFields {
  companyId?: string | null;
  stpsOccupationCode?: string | null;
  stpsThematicAreaCode?: string | null;
}
