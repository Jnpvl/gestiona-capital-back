export type StaffRole = "super_admin" | "admin" | "teacher";
export type StaffGender = "male" | "female" | "other";

export interface StaffRecord {
  id: string;
  name: string;
  paternal_last_name: string | null;
  maternal_last_name: string | null;
  first_names: string | null;
  email: string;
  password_hash: string;
  role: StaffRole;
  age: number | null;
  gender: StaffGender | null;
  ace_stps_registration: string | null;
  renap_conocer: string | null;
  professional_license: string | null;
  photo_url: string | null;
  logo_url: string | null;
  signature_url: string | null;
  career: string | null;
  professional_area: string | null;
  professional_bio: string | null;
  active: boolean;
  privacy_accepted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface StaffProfile {
  id: string;
  name: string;
  paternalLastName: string;
  maternalLastName: string | null;
  firstNames: string;
  email: string;
  role: StaffRole;
  age: number | null;
  gender: StaffGender | null;
  aceStpsRegistration: string | null;
  renapConocer: string | null;
  professionalLicense: string | null;
  photoUrl: string | null;
  logoUrl: string | null;
  signatureUrl: string | null;
  career: string | null;
  professionalArea: string | null;
  professionalBio: string | null;
  active: boolean;
  privacyAccepted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StaffPublic {
  id: string;
  name: string;
  paternalLastName: string;
  maternalLastName: string | null;
  firstNames: string;
  email: string;
  role: StaffRole;
  age: number | null;
  gender: StaffGender | null;
  aceStpsRegistration: string | null;
  photoUrl: string | null;
  logoUrl: string | null;
  signatureUrl: string | null;
  career: string | null;
  professionalArea: string | null;
  active: boolean;
  privacyAccepted: boolean;
  createdAt: string;
}

export interface CreateStaffInput {
  paternalLastName: string;
  maternalLastName?: string | null;
  firstNames: string;
  email: string;
  password: string;
  role: StaffRole;
  age?: number | null;
  gender?: StaffGender | null;
  aceStpsRegistration?: string | null;
  renapConocer?: string | null;
  professionalLicense?: string | null;
  photoUrl?: string | null;
  logoUrl?: string | null;
  signatureUrl?: string | null;
  career?: string | null;
  professionalArea?: string | null;
  professionalBio?: string | null;
  active?: boolean;
}

export interface UpdateStaffInput {
  paternalLastName?: string;
  maternalLastName?: string | null;
  firstNames?: string;
  email?: string;
  password?: string;
  /** If true with password, email panel access credentials after update. */
  sendAccessEmail?: boolean;
  role?: StaffRole;
  age?: number | null;
  gender?: StaffGender | null;
  aceStpsRegistration?: string | null;
  renapConocer?: string | null;
  professionalLicense?: string | null;
  photoUrl?: string | null;
  logoUrl?: string | null;
  signatureUrl?: string | null;
  career?: string | null;
  professionalArea?: string | null;
  professionalBio?: string | null;
  active?: boolean;
}

export interface ListStaffFilters {
  search?: string;
  active?: boolean;
  role?: StaffRole;
  /** When true, hide super_admin accounts from results. */
  excludeSuperAdmin?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedStaffResult {
  staff: StaffPublic[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
