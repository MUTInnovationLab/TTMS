export interface User {
  id: string;
  title: string;
  name: string;
  staffId?: number;
  sex?: string;
  department: string;
  roomName?: string;
  role: string;
  schedulable?: boolean;
  contact: {
    email: string;
    mobile?: string;
    officeTel?: string;
    homeTel?: string;
    fax?: string;
    website?: string;
  };
  address?: {
    line1?: string;
    line2?: string;
    line3?: string;
    line4?: string;
    postcode?: string;
  };
  accessibility?: {
    deafLoop: boolean;
    wheelchairAccess: boolean;
  };
  weeklyTarget?: number;
  totalTarget?: number;
  allowanceWeek?: number;
  allowanceTotal?: number;
  profile?: string;
  tags?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}
