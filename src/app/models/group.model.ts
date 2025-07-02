export interface Group {
  id: number;
  name: string;
  program: string;
  year: number;
  semester: number;
  studentCount: number;
  createdAt: Date;
  updatedAt: Date;
  size?: number; // Added size property as optional
  groupType?: string; // Added groupType property as optional
}
