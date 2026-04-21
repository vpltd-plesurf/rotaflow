export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};

export type DayHours = {
  open: string;       // "HH:MM"
  close: string;      // "HH:MM"
  closed: boolean;
  lunch_mins: number;
};

export type WeeklyHours = Record<DayKey, DayHours>;

export type UserRole = "admin" | "manager" | "barber";
export type EmployeeStatus = "active" | "inactive";
export type ShiftStatus = "scheduled" | "leave_block" | "swap_pending" | "cancelled";
export type LeaveStatus = "pending" | "approved" | "denied";
export type SwapStatus = "pending" | "approved" | "denied";
export type DocType = "contract" | "insurance" | "id" | "other";
export type OrgStatus = "active" | "suspended" | "trial";

export type Organisation = {
  id: string;
  slug: string;
  name: string;
  status: OrgStatus;
};

export type OrgContext = {
  userId: string;
  role: UserRole;
  isSuperuser: boolean;
  org: Organisation;
};

export interface Database {
  public: {
    Tables: {
      locations: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          weekly_hours: WeeklyHours;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          weekly_hours?: WeeklyHours;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string | null;
          weekly_hours?: WeeklyHours;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          role: UserRole;
          location_id: string | null;
          hourly_rate: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          phone?: string | null;
          role: UserRole;
          location_id?: string | null;
          hourly_rate?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string | null;
          role?: UserRole;
          location_id?: string | null;
          hourly_rate?: number | null;
          updated_at?: string;
        };
      };
      employee_details: {
        Row: {
          id: string;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          notes: string | null;
          status: EmployeeStatus;
        };
        Insert: {
          id: string;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          notes?: string | null;
          status?: EmployeeStatus;
        };
        Update: {
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          notes?: string | null;
          status?: EmployeeStatus;
        };
      };
      rotas: {
        Row: {
          id: string;
          location_id: string;
          week_start: string;
          published: boolean;
          published_at: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          week_start: string;
          published?: boolean;
          published_at?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          location_id?: string;
          week_start?: string;
          published?: boolean;
          published_at?: string | null;
        };
      };
      shifts: {
        Row: {
          id: string;
          rota_id: string;
          employee_id: string;
          date: string;
          start_time: string;
          end_time: string;
          role_label: string | null;
          notes: string | null;
          status: ShiftStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          rota_id: string;
          employee_id: string;
          date: string;
          start_time: string;
          end_time: string;
          role_label?: string | null;
          notes?: string | null;
          status?: ShiftStatus;
          created_at?: string;
        };
        Update: {
          rota_id?: string;
          employee_id?: string;
          date?: string;
          start_time?: string;
          end_time?: string;
          role_label?: string | null;
          notes?: string | null;
          status?: ShiftStatus;
        };
      };
      leave_requests: {
        Row: {
          id: string;
          employee_id: string;
          start_date: string;
          end_date: string;
          reason: string | null;
          status: LeaveStatus;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          start_date: string;
          end_date: string;
          reason?: string | null;
          status?: LeaveStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          start_date?: string;
          end_date?: string;
          reason?: string | null;
          status?: LeaveStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        };
      };
      shift_swaps: {
        Row: {
          id: string;
          requester_id: string;
          target_id: string | null;
          shift_id: string;
          target_shift_id: string | null;
          message: string | null;
          status: SwapStatus;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          target_id?: string | null;
          shift_id: string;
          target_shift_id?: string | null;
          message?: string | null;
          status?: SwapStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          target_id?: string | null;
          target_shift_id?: string | null;
          message?: string | null;
          status?: SwapStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        };
      };
      documents: {
        Row: {
          id: string;
          employee_id: string;
          file_path: string;
          file_name: string;
          file_size: number | null;
          doc_type: DocType;
          uploaded_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          file_path: string;
          file_name: string;
          file_size?: number | null;
          doc_type: DocType;
          uploaded_by: string;
          created_at?: string;
        };
        Update: {
          file_name?: string;
          doc_type?: DocType;
        };
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          type: string;
          message: string;
          link: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          type: string;
          message: string;
          link?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          read?: boolean;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: UserRole;
      employee_status: EmployeeStatus;
      shift_status: ShiftStatus;
      leave_status: LeaveStatus;
      swap_status: SwapStatus;
      doc_type: DocType;
    };
  };
}

// Convenience types
export type Location = Database["public"]["Tables"]["locations"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type EmployeeDetail = Database["public"]["Tables"]["employee_details"]["Row"];
export type Rota = Database["public"]["Tables"]["rotas"]["Row"];
export type Shift = Database["public"]["Tables"]["shifts"]["Row"];
export type LeaveRequest = Database["public"]["Tables"]["leave_requests"]["Row"];
export type ShiftSwap = Database["public"]["Tables"]["shift_swaps"]["Row"];
export type Document = Database["public"]["Tables"]["documents"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];

// Joined types used in the UI
export type ProfileWithLocation = Profile & {
  location: Location | null;
};

export type ShiftWithEmployee = Shift & {
  employee: Profile;
};

export type LeaveRequestWithEmployee = LeaveRequest & {
  employee: Profile;
  reviewer: Profile | null;
};

export type LeaveRange = {
  employee_id: string;
  start_date: string;
  end_date: string;
};
