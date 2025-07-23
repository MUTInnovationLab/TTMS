export interface Group {
  id: number;
  name: string;
  program: string;
  year: number;
  semester: number;
  studentCount: number;
  createdAt: Date;
  updatedAt: Date;
  size: number; // Made required since it's used in the form
  groupType?: string; // Added groupType property as optional
}
