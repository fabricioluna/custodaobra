export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      attachments: {
        Row: {
          created_at: string;
          expense_id: string;
          id: string;
          mime_type: string;
          org_id: string;
          size_bytes: number;
          storage_path: string;
          updated_at: string;
          uploaded_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          expense_id: string;
          id?: string;
          mime_type: string;
          org_id: string;
          size_bytes: number;
          storage_path: string;
          updated_at?: string;
          uploaded_by?: string | null;
        };
        Update: {
          created_at?: string;
          expense_id?: string;
          id?: string;
          mime_type?: string;
          org_id?: string;
          size_bytes?: number;
          storage_path?: string;
          updated_at?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "attachments_expense_id_fkey";
            columns: ["expense_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attachments_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          created_at: string;
          diff: Json | null;
          entity: string;
          entity_id: string;
          id: string;
          org_id: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          created_at?: string;
          diff?: Json | null;
          entity: string;
          entity_id: string;
          id?: string;
          org_id: string;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          diff?: Json | null;
          entity?: string;
          entity_id?: string;
          id?: string;
          org_id?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          code: string;
          created_at: string;
          icon: string | null;
          id: string;
          name: string;
          org_id: string | null;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          icon?: string | null;
          id?: string;
          name: string;
          org_id?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          icon?: string | null;
          id?: string;
          name?: string;
          org_id?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      expense_items: {
        Row: {
          created_at: string;
          description: string;
          expense_id: string;
          id: string;
          org_id: string;
          quantity: number | null;
          total_cents: number;
          unit: string | null;
          unit_price_cents: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description: string;
          expense_id: string;
          id?: string;
          org_id: string;
          quantity?: number | null;
          total_cents: number;
          unit?: string | null;
          unit_price_cents?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          expense_id?: string;
          id?: string;
          org_id?: string;
          quantity?: number | null;
          total_cents?: number;
          unit?: string | null;
          unit_price_cents?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expense_items_expense_id_fkey";
            columns: ["expense_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expense_items_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          ai_confidence: number | null;
          amount_cents: number;
          category_id: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string;
          has_invoice: boolean;
          id: string;
          invoice_number: string | null;
          nfe_access_key: string | null;
          org_id: string;
          payable_id: string | null;
          payment_method: Database["public"]["Enums"]["payment_method"] | null;
          project_id: string;
          quantity: number | null;
          raw_input: string | null;
          source: Database["public"]["Enums"]["expense_source"];
          spent_on: string;
          stage_id: string | null;
          status: Database["public"]["Enums"]["expense_status"];
          supplier_id: string | null;
          unit: string | null;
          unit_price_cents: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          ai_confidence?: number | null;
          amount_cents: number;
          category_id: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description: string;
          has_invoice?: boolean;
          id?: string;
          invoice_number?: string | null;
          nfe_access_key?: string | null;
          org_id: string;
          payable_id?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          project_id: string;
          quantity?: number | null;
          raw_input?: string | null;
          source?: Database["public"]["Enums"]["expense_source"];
          spent_on: string;
          stage_id?: string | null;
          status: Database["public"]["Enums"]["expense_status"];
          supplier_id?: string | null;
          unit?: string | null;
          unit_price_cents?: number | null;
          updated_at?: string;
        };
        Update: {
          ai_confidence?: number | null;
          amount_cents?: number;
          category_id?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string;
          has_invoice?: boolean;
          id?: string;
          invoice_number?: string | null;
          nfe_access_key?: string | null;
          org_id?: string;
          payable_id?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          project_id?: string;
          quantity?: number | null;
          raw_input?: string | null;
          source?: Database["public"]["Enums"]["expense_source"];
          spent_on?: string;
          stage_id?: string | null;
          status?: Database["public"]["Enums"]["expense_status"];
          supplier_id?: string | null;
          unit?: string | null;
          unit_price_cents?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "v_project_category_summary";
            referencedColumns: ["category_id"];
          },
          {
            foreignKeyName: "expenses_project_id_org_id_fkey";
            columns: ["project_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "org_id"];
          },
          {
            foreignKeyName: "expenses_project_id_org_id_fkey";
            columns: ["project_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "v_project_summary";
            referencedColumns: ["project_id", "org_id"];
          },
          {
            foreignKeyName: "expenses_stage_id_project_id_fkey";
            columns: ["stage_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "stages";
            referencedColumns: ["id", "project_id"];
          },
          {
            foreignKeyName: "expenses_stage_id_project_id_fkey";
            columns: ["stage_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "v_stage_summary";
            referencedColumns: ["stage_id", "project_id"];
          },
          {
            foreignKeyName: "expenses_supplier_id_org_id_fkey";
            columns: ["supplier_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id", "org_id"];
          },
        ];
      };
      organization_members: {
        Row: {
          created_at: string;
          org_id: string;
          role: Database["public"]["Enums"]["org_role"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          org_id: string;
          role?: Database["public"]["Enums"]["org_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          org_id?: string;
          role?: Database["public"]["Enums"]["org_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          kind: Database["public"]["Enums"]["org_kind"];
          name: string;
          slug: string;
          timezone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["org_kind"];
          name: string;
          slug: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["org_kind"];
          name?: string;
          slug?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      plans: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          is_default: boolean;
          max_ai_calls_month: number;
          max_members: number;
          max_projects: number;
          max_whatsapp_entries_month: number;
          name: string;
          price_cents_month: number;
          trial_days: number;
          updated_at: string;
          whatsapp_enabled: boolean;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          is_default?: boolean;
          max_ai_calls_month: number;
          max_members: number;
          max_projects: number;
          max_whatsapp_entries_month: number;
          name: string;
          price_cents_month?: number;
          trial_days?: number;
          updated_at?: string;
          whatsapp_enabled?: boolean;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          is_default?: boolean;
          max_ai_calls_month?: number;
          max_members?: number;
          max_projects?: number;
          max_whatsapp_entries_month?: number;
          name?: string;
          price_cents_month?: number;
          trial_days?: number;
          updated_at?: string;
          whatsapp_enabled?: boolean;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          default_org_id: string | null;
          full_name: string | null;
          id: string;
          onboarded_at: string | null;
          updated_at: string;
          whatsapp_linked_at: string | null;
          whatsapp_phone: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          default_org_id?: string | null;
          full_name?: string | null;
          id: string;
          onboarded_at?: string | null;
          updated_at?: string;
          whatsapp_linked_at?: string | null;
          whatsapp_phone?: string | null;
        };
        Update: {
          created_at?: string;
          default_org_id?: string | null;
          full_name?: string | null;
          id?: string;
          onboarded_at?: string | null;
          updated_at?: string;
          whatsapp_linked_at?: string | null;
          whatsapp_phone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_default_org_id_fkey";
            columns: ["default_org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      project_members: {
        Row: {
          created_at: string;
          org_id: string;
          project_id: string;
          role: Database["public"]["Enums"]["project_role"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          org_id: string;
          project_id: string;
          role?: Database["public"]["Enums"]["project_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          org_id?: string;
          project_id?: string;
          role?: Database["public"]["Enums"]["project_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_members_org_id_user_id_fkey";
            columns: ["org_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "organization_members";
            referencedColumns: ["org_id", "user_id"];
          },
          {
            foreignKeyName: "project_members_project_id_org_id_fkey";
            columns: ["project_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "org_id"];
          },
          {
            foreignKeyName: "project_members_project_id_org_id_fkey";
            columns: ["project_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "v_project_summary";
            referencedColumns: ["project_id", "org_id"];
          },
          {
            foreignKeyName: "project_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          address: string | null;
          archived_at: string | null;
          budget_total_cents: number | null;
          built_area_m2: number | null;
          city: string | null;
          created_at: string;
          created_by: string | null;
          expected_end_date: string | null;
          id: string;
          name: string;
          org_id: string;
          standard: Database["public"]["Enums"]["project_standard"] | null;
          start_date: string | null;
          state: string | null;
          status: Database["public"]["Enums"]["project_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          archived_at?: string | null;
          budget_total_cents?: number | null;
          built_area_m2?: number | null;
          city?: string | null;
          created_at?: string;
          created_by?: string | null;
          expected_end_date?: string | null;
          id?: string;
          name: string;
          org_id: string;
          standard?: Database["public"]["Enums"]["project_standard"] | null;
          start_date?: string | null;
          state?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          archived_at?: string | null;
          budget_total_cents?: number | null;
          built_area_m2?: number | null;
          city?: string | null;
          created_at?: string;
          created_by?: string | null;
          expected_end_date?: string | null;
          id?: string;
          name?: string;
          org_id?: string;
          standard?: Database["public"]["Enums"]["project_standard"] | null;
          start_date?: string | null;
          state?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      stage_templates: {
        Row: {
          created_at: string;
          default_percent: number;
          id: string;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          default_percent: number;
          id?: string;
          name: string;
          sort_order: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          default_percent?: number;
          id?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      stages: {
        Row: {
          budget_cents: number | null;
          created_at: string;
          default_percent: number | null;
          id: string;
          name: string;
          org_id: string;
          progress_percent: number;
          project_id: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          budget_cents?: number | null;
          created_at?: string;
          default_percent?: number | null;
          id?: string;
          name: string;
          org_id: string;
          progress_percent?: number;
          project_id: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          budget_cents?: number | null;
          created_at?: string;
          default_percent?: number | null;
          id?: string;
          name?: string;
          org_id?: string;
          progress_percent?: number;
          project_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stages_project_id_org_id_fkey";
            columns: ["project_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "org_id"];
          },
          {
            foreignKeyName: "stages_project_id_org_id_fkey";
            columns: ["project_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "v_project_summary";
            referencedColumns: ["project_id", "org_id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          created_at: string;
          current_period_end: string | null;
          id: string;
          org_id: string;
          plan_code: string;
          provider: string | null;
          provider_customer_id: string | null;
          provider_subscription_id: string | null;
          status: Database["public"]["Enums"]["subscription_status"];
          trial_ends_at: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          org_id: string;
          plan_code: string;
          provider?: string | null;
          provider_customer_id?: string | null;
          provider_subscription_id?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          org_id?: string;
          plan_code?: string;
          provider?: string | null;
          provider_customer_id?: string | null;
          provider_subscription_id?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_plan_code_fkey";
            columns: ["plan_code"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["code"];
          },
        ];
      };
      suppliers: {
        Row: {
          created_at: string;
          document: string | null;
          id: string;
          kind: Database["public"]["Enums"]["supplier_kind"];
          name: string;
          org_id: string;
          phone: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          document?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["supplier_kind"];
          name: string;
          org_id: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          document?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["supplier_kind"];
          name?: string;
          org_id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "suppliers_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      v_project_category_summary: {
        Row: {
          category_code: string;
          category_id: string;
          category_name: string;
          category_sort_order: number;
          expense_count: number | null;
          org_id: string;
          project_id: string;
          total_cents: number | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "expenses_project_id_org_id_fkey";
            columns: ["project_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "org_id"];
          },
          {
            foreignKeyName: "expenses_project_id_org_id_fkey";
            columns: ["project_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "v_project_summary";
            referencedColumns: ["project_id", "org_id"];
          },
        ];
      };
      v_project_month_summary: {
        Row: {
          construction_cents: number | null;
          land_cents: number | null;
          month: string | null;
          org_id: string;
          project_id: string;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "expenses_project_id_org_id_fkey";
            columns: ["project_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "org_id"];
          },
          {
            foreignKeyName: "expenses_project_id_org_id_fkey";
            columns: ["project_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "v_project_summary";
            referencedColumns: ["project_id", "org_id"];
          },
        ];
      };
      v_project_summary: {
        Row: {
          construction_cents: number | null;
          expense_count: number | null;
          land_cents: number | null;
          last_spent_on: string | null;
          org_id: string;
          project_id: string;
          unclassified_count: number | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "projects_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      v_stage_summary: {
        Row: {
          budget_cents: number | null;
          committed_cents: number | null;
          expense_count: number | null;
          name: string;
          org_id: string;
          progress_percent: number;
          project_id: string;
          sort_order: number;
          spent_cents: number | null;
          stage_id: string;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "stages_project_id_org_id_fkey";
            columns: ["project_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "org_id"];
          },
          {
            foreignKeyName: "stages_project_id_org_id_fkey";
            columns: ["project_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "v_project_summary";
            referencedColumns: ["project_id", "org_id"];
          },
        ];
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      expense_source:
        | "app"
        | "whatsapp_text"
        | "whatsapp_audio"
        | "whatsapp_image"
        | "import";
      expense_status: "pending" | "confirmed" | "cancelled";
      org_kind: "personal" | "business";
      org_role: "owner" | "admin" | "member";
      payment_method:
        | "pix"
        | "dinheiro"
        | "cartao_credito"
        | "cartao_debito"
        | "boleto"
        | "transferencia"
        | "outro";
      project_role: "editor" | "viewer";
      project_standard: "economico" | "normal" | "alto";
      project_status: "planejamento" | "em_andamento" | "pausada" | "concluida";
      subscription_status: "trialing" | "active" | "past_due" | "cancelled";
      supplier_kind: "loja" | "profissional" | "empresa" | "outro";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      expense_source: [
        "app",
        "whatsapp_text",
        "whatsapp_audio",
        "whatsapp_image",
        "import",
      ],
      expense_status: ["pending", "confirmed", "cancelled"],
      org_kind: ["personal", "business"],
      org_role: ["owner", "admin", "member"],
      payment_method: [
        "pix",
        "dinheiro",
        "cartao_credito",
        "cartao_debito",
        "boleto",
        "transferencia",
        "outro",
      ],
      project_role: ["editor", "viewer"],
      project_standard: ["economico", "normal", "alto"],
      project_status: ["planejamento", "em_andamento", "pausada", "concluida"],
      subscription_status: ["trialing", "active", "past_due", "cancelled"],
      supplier_kind: ["loja", "profissional", "empresa", "outro"],
    },
  },
} as const;
