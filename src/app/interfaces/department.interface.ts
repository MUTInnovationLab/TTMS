export interface Department {
  id?: string;
  name: string;
  code: string;
  description: string;
  hodId?: string;
  hodName?: string;
  hodEmail?: string;
  location: string;
  phone: string;
  email: string;
  budget?: number;
  establishedYear: number;
  status: 'active' | 'inactive';
  moduleCount?: number;
  lecturerCount?: number;
  studentCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
