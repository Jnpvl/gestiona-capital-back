export type EnrollmentStatus = "active" | "revoked" | "expired";
export type EnrollmentDeliveryMode = "online" | "presencial";
export type AlumnoType = "estudiante" | "particular" | "trabajador";

export type {
  AlumnoGender,
  EducationLevel,
  JobType,
} from "./alumno-profile.types";

import type { AlumnoGender, EducationLevel, JobType } from "./alumno-profile.types";

export interface StudentRecord {
  id: string;
  name: string;
  paternal_last_name: string | null;
  maternal_last_name: string | null;
  first_names: string | null;
  email: string;
  password_hash: string;
  phone: string | null;
  notes: string | null;
  company_id: string | null;
  curp: string | null;
  gender: AlumnoGender | null;
  age: number | null;
  residence_location: string | null;
  education_level: EducationLevel | null;
  profession_area: string | null;
  education_institution: string | null;
  currently_employed: boolean | null;
  job_type: JobType | null;
  current_position: string | null;
  industry_sector: string | null;
  years_experience: number | null;
  time_in_current_position: string | null;
  stps_occupation_code: string | null;
  stps_thematic_area_code: string | null;
  alumno_type: AlumnoType;
  active: boolean;
  privacy_accepted_at: Date | null;
  created_by_staff_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export type StudentRecordRow = StudentRecord & {
  company_name?: string | null;
  company_rfc?: string | null;
  stps_occupation_name?: string | null;
  stps_thematic_area_name?: string | null;
};

export interface StudentListItem {
  id: string;
  name: string;
  paternalLastName: string;
  maternalLastName: string | null;
  firstNames: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  alumnoType: AlumnoType;
  active: boolean;
  coursesCount: number;
  createdAt: string;
}

export interface StudentDetail {
  id: string;
  name: string;
  paternalLastName: string;
  maternalLastName: string | null;
  firstNames: string;
  email: string;
  phone: string | null;
  notes: string | null;
  curp: string | null;
  gender: AlumnoGender | null;
  age: number | null;
  residenceLocation: string | null;
  educationLevel: EducationLevel | null;
  professionArea: string | null;
  educationInstitution: string | null;
  currentlyEmployed: boolean | null;
  jobType: JobType | null;
  currentPosition: string | null;
  industrySector: string | null;
  yearsExperience: number | null;
  timeInCurrentPosition: string | null;
  stpsOccupationCode: string | null;
  stpsOccupationName: string | null;
  stpsThematicAreaCode: string | null;
  stpsThematicAreaName: string | null;
  alumnoType: AlumnoType;
  companyId: string | null;
  companyName: string | null;
  companyRfc: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudentPublic {
  id: string;
  name: string;
  email: string;
  active: boolean;
  privacyAccepted: boolean;
  createdAt: string;
}

export interface StudentCourseListItem {
  enrollmentId: string;
  courseId: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  coverImage: string | null;
  modality: string | null;
  lessonsCount: number;
  completedLessons: number;
  progressPercent: number;
  canDownloadCertificate: boolean;
  canDownloadDc3: boolean;
  deliveryMode: EnrollmentDeliveryMode;
  completed: boolean;
  enrolledAt: string;
}

export interface StudentEnrollment {
  id: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  expiresAt: string | null;
  enrolledViaCompany: boolean;
  deliveryMode: EnrollmentDeliveryMode;
  completedAt: string | null;
  completed: boolean;
  canDownloadCertificate: boolean;
  canDownloadDc3: boolean;
}

export interface CourseEnrollmentListItem {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  courseSlug: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  enrolledViaCompany: boolean;
  deliveryMode: EnrollmentDeliveryMode;
  completedAt: string | null;
  completed: boolean;
  progressPercent: number;
  canDownloadCertificate: boolean;
  canDownloadDc3: boolean;
  certificateNumber: string | null;
  periodLabel: string;
}

export interface CreateStudentInput {
  paternalLastName: string;
  maternalLastName?: string | null;
  firstNames: string;
  email: string;
  password: string;
  phone: string;
  notes?: string | null;
  alumnoType: AlumnoType;
  curp: string;
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
  stpsOccupationCode?: string | null;
  stpsThematicAreaCode?: string | null;
  companyId?: string | null;
  active?: boolean;
  createdByStaffId?: string | null;
}

export interface UpdateStudentInput {
  paternalLastName?: string;
  maternalLastName?: string | null;
  firstNames?: string;
  email?: string;
  phone?: string | null;
  notes?: string | null;
  alumnoType?: AlumnoType;
  curp?: string | null;
  gender?: AlumnoGender | null;
  age?: number | null;
  residenceLocation?: string | null;
  educationLevel?: EducationLevel | null;
  professionArea?: string | null;
  educationInstitution?: string | null;
  currentlyEmployed?: boolean | null;
  jobType?: JobType | null;
  currentPosition?: string | null;
  industrySector?: string | null;
  yearsExperience?: number | null;
  timeInCurrentPosition?: string | null;
  stpsOccupationCode?: string | null;
  stpsThematicAreaCode?: string | null;
  companyId?: string | null;
  active?: boolean;
  password?: string;
  /** If true with password, email welcome/access credentials after update. */
  sendAccessEmail?: boolean;
}

export interface ListStudentsFilters {
  search?: string;
  active?: boolean;
  alumnoType?: AlumnoType;
  /** When set, only students created by or enrolled in this instructor's courses. */
  instructorId?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedStudentsResult {
  students: StudentListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
