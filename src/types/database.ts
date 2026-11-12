export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
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
      billing_events: {
        Row: {
          created_at: string;
          error: string | null;
          event: string;
          id: string;
          org_id: string | null;
          payload: Json;
          processed_at: string | null;
          provider: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          error?: string | null;
          event: string;
          id: string;
          org_id?: string | null;
          payload: Json;
          processed_at?: string | null;
          provider: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          event?: string;
          id?: string;
          org_id?: string | null;
          payload?: Json;
          processed_at?: string | null;
          provider?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_events_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      budget_alerts: {
        Row: {
          created_at: string;
          level: string;
          notified_at: string;
          org_id: string;
          project_id: string;
          stage_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          level: string;
          notified_at?: string;
          org_id: string;
          project_id: string;
          stage_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          level?: string;
          notified_at?: string;
          org_id?: string;
          project_id?: string;
          stage_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budget_alerts_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budget_alerts_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budget_alerts_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "v_project_summary";
            referencedColumns: ["project_id"];
          },
          {
            foreignKeyName: "budget_alerts_stage_id_fkey";
            columns: ["stage_id"];
            isOneToOne: true;
            referencedRelation: "stages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budget_alerts_stage_id_fkey";
            columns: ["stage_id"];
            isOneToOne: true;
            referencedRelation: "v_stage_summary";
            referencedColumns: ["stage_id"];
          },
        ];
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
          confirmed_at: string | null;
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
        Insert: {
          ai_confidence?: number | null;
          amount_cents: number;
          category_id: string;
          confirmed_at?: string | null;
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
          confirmed_at?: string | null;
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
            foreignKeyName: "expenses_payable_fkey";
            columns: ["payable_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "payables";
            referencedColumns: ["id", "project_id"];
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
      invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          label: string | null;
          org_id: string;
          org_role: Database["public"]["Enums"]["org_role"];
          project_id: string | null;
          project_role: Database["public"]["Enums"]["project_role"] | null;
          revoked_at: string | null;
          token_hash: string;
          updated_at: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          label?: string | null;
          org_id: string;
          org_role: Database["public"]["Enums"]["org_role"];
          project_id?: string | null;
          project_role?: Database["public"]["Enums"]["project_role"] | null;
          revoked_at?: string | null;
          token_hash: string;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          label?: string | null;
          org_id?: string;
          org_role?: Database["public"]["Enums"]["org_role"];
          project_id?: string | null;
          project_role?: Database["public"]["Enums"]["project_role"] | null;
          revoked_at?: string | null;
          token_hash?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_accepted_by_fkey";
            columns: ["accepted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_project_id_org_id_fkey";
            columns: ["project_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "org_id"];
          },
          {
            foreignKeyName: "invitations_project_id_org_id_fkey";
            columns: ["project_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "v_project_summary";
            referencedColumns: ["project_id", "org_id"];
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
      payables: {
        Row: {
          amount_cents: number;
          category_id: string;
          created_at: string;
          created_by: string | null;
          description: string;
          due_date: string;
          id: string;
          installment_group_id: string | null;
          installment_number: number | null;
          installment_total: number | null;
          org_id: string;
          paid_expense_id: string | null;
          project_id: string;
          stage_id: string | null;
          status: Database["public"]["Enums"]["payable_status"];
          supplier_id: string | null;
          updated_at: string;
        };
        Insert: {
          amount_cents: number;
          category_id: string;
          created_at?: string;
          created_by?: string | null;
          description: string;
          due_date: string;
          id?: string;
          installment_group_id?: string | null;
          installment_number?: number | null;
          installment_total?: number | null;
          org_id: string;
          paid_expense_id?: string | null;
          project_id: string;
          stage_id?: string | null;
          status?: Database["public"]["Enums"]["payable_status"];
          supplier_id?: string | null;
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          category_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          due_date?: string;
          id?: string;
          installment_group_id?: string | null;
          installment_number?: number | null;
          installment_total?: number | null;
          org_id?: string;
          paid_expense_id?: string | null;
          project_id?: string;
          stage_id?: string | null;
          status?: Database["public"]["Enums"]["payable_status"];
          supplier_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payables_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payables_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "v_project_category_summary";
            referencedColumns: ["category_id"];
          },
          {
            foreignKeyName: "payables_paid_expense_id_project_id_fkey";
            columns: ["paid_expense_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id", "project_id"];
          },
          {
            foreignKeyName: "payables_project_id_org_id_fkey";
            columns: ["project_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "org_id"];
          },
          {
            foreignKeyName: "payables_project_id_org_id_fkey";
            columns: ["project_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "v_project_summary";
            referencedColumns: ["project_id", "org_id"];
          },
          {
            foreignKeyName: "payables_stage_id_project_id_fkey";
            columns: ["stage_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "stages";
            referencedColumns: ["id", "project_id"];
          },
          {
            foreignKeyName: "payables_stage_id_project_id_fkey";
            columns: ["stage_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "v_stage_summary";
            referencedColumns: ["stage_id", "project_id"];
          },
          {
            foreignKeyName: "payables_supplier_id_org_id_fkey";
            columns: ["supplier_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id", "org_id"];
          },
        ];
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
          max_template_messages_month: number;
          max_whatsapp_entries_month: number;
          name: string;
          price_cents_month: number;
          trial_days: number;
          updated_at: string;
          whatsapp_enabled: boolean;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          is_default?: boolean;
          max_ai_calls_month: number;
          max_members: number;
          max_projects: number;
          max_template_messages_month?: number;
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
          max_template_messages_month?: number;
          max_whatsapp_entries_month?: number;
          name?: string;
          price_cents_month?: number;
          trial_days?: number;
          updated_at?: string;
          whatsapp_enabled?: boolean;
        };
        Relationships: [];
      };
      platform_admins: {
        Row: {
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          updated_at?: string;
          user_id?: string;
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
          whatsapp_budget_alerts: boolean;
          whatsapp_linked_at: string | null;
          whatsapp_phone: string | null;
          whatsapp_weekly_report: boolean;
        };
        Insert: {
          created_at?: string;
          default_org_id?: string | null;
          full_name?: string | null;
          id: string;
          onboarded_at?: string | null;
          updated_at?: string;
          whatsapp_budget_alerts?: boolean;
          whatsapp_linked_at?: string | null;
          whatsapp_phone?: string | null;
          whatsapp_weekly_report?: boolean;
        };
        Update: {
          created_at?: string;
          default_org_id?: string | null;
          full_name?: string | null;
          id?: string;
          onboarded_at?: string | null;
          updated_at?: string;
          whatsapp_budget_alerts?: boolean;
          whatsapp_linked_at?: string | null;
          whatsapp_phone?: string | null;
          whatsapp_weekly_report?: boolean;
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
          built_area_m2: number | null;
          city: string | null;
          cost_per_m2_cents: number | null;
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
        Insert: {
          address?: string | null;
          archived_at?: string | null;
          built_area_m2?: number | null;
          city?: string | null;
          cost_per_m2_cents?: number | null;
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
          built_area_m2?: number | null;
          city?: string | null;
          cost_per_m2_cents?: number | null;
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
          provider_plan_code: string | null;
          provider_subscription_id: string | null;
          status: Database["public"]["Enums"]["subscription_status"];
          trial_ends_at: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          org_id: string;
          plan_code: string;
          provider?: string | null;
          provider_customer_id?: string | null;
          provider_plan_code?: string | null;
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
          provider_plan_code?: string | null;
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
            foreignKeyName: "subscriptions_provider_plan_code_fkey";
            columns: ["provider_plan_code"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["code"];
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
      usage_counters: {
        Row: {
          ai_calls: number;
          ai_input_tokens: number;
          ai_output_tokens: number;
          audio_seconds: number;
          created_at: string;
          month: string;
          org_id: string;
          template_messages: number;
          updated_at: string;
          whatsapp_entries: number;
        };
        Insert: {
          ai_calls?: number;
          ai_input_tokens?: number;
          ai_output_tokens?: number;
          audio_seconds?: number;
          created_at?: string;
          month: string;
          org_id: string;
          template_messages?: number;
          updated_at?: string;
          whatsapp_entries?: number;
        };
        Update: {
          ai_calls?: number;
          ai_input_tokens?: number;
          ai_output_tokens?: number;
          audio_seconds?: number;
          created_at?: string;
          month?: string;
          org_id?: string;
          template_messages?: number;
          updated_at?: string;
          whatsapp_entries?: number;
        };
        Relationships: [
          {
            foreignKeyName: "usage_counters_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_conversations: {
        Row: {
          active_org_id: string | null;
          active_project_id: string | null;
          context: Json;
          created_at: string;
          pending_expense_id: string | null;
          state: Database["public"]["Enums"]["whatsapp_conversation_state"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active_org_id?: string | null;
          active_project_id?: string | null;
          context?: Json;
          created_at?: string;
          pending_expense_id?: string | null;
          state?: Database["public"]["Enums"]["whatsapp_conversation_state"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active_org_id?: string | null;
          active_project_id?: string | null;
          context?: Json;
          created_at?: string;
          pending_expense_id?: string | null;
          state?: Database["public"]["Enums"]["whatsapp_conversation_state"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_active_org_id_fkey";
            columns: ["active_org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "whatsapp_conversations_active_project_id_fkey";
            columns: ["active_project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "whatsapp_conversations_active_project_id_fkey";
            columns: ["active_project_id"];
            isOneToOne: false;
            referencedRelation: "v_project_summary";
            referencedColumns: ["project_id"];
          },
          {
            foreignKeyName: "whatsapp_conversations_pending_expense_id_fkey";
            columns: ["pending_expense_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "whatsapp_conversations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_link_codes: {
        Row: {
          code_hash: string;
          created_at: string;
          expires_at: string;
          id: string;
          updated_at: string;
          used_at: string | null;
          user_id: string;
        };
        Insert: {
          code_hash: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          updated_at?: string;
          used_at?: string | null;
          user_id: string;
        };
        Update: {
          code_hash?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          updated_at?: string;
          used_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_link_codes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_messages: {
        Row: {
          created_at: string;
          direction: Database["public"]["Enums"]["whatsapp_direction"];
          error: string | null;
          expense_id: string | null;
          from_phone: string;
          id: string;
          org_id: string | null;
          payload: Json | null;
          processed_at: string | null;
          type: string;
          updated_at: string;
          user_id: string | null;
          wa_message_id: string;
        };
        Insert: {
          created_at?: string;
          direction: Database["public"]["Enums"]["whatsapp_direction"];
          error?: string | null;
          expense_id?: string | null;
          from_phone: string;
          id?: string;
          org_id?: string | null;
          payload?: Json | null;
          processed_at?: string | null;
          type: string;
          updated_at?: string;
          user_id?: string | null;
          wa_message_id: string;
        };
        Update: {
          created_at?: string;
          direction?: Database["public"]["Enums"]["whatsapp_direction"];
          error?: string | null;
          expense_id?: string | null;
          from_phone?: string;
          id?: string;
          org_id?: string | null;
          payload?: Json | null;
          processed_at?: string | null;
          type?: string;
          updated_at?: string;
          user_id?: string | null;
          wa_message_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_expense_id_fkey";
            columns: ["expense_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "whatsapp_messages_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "whatsapp_messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      v_project_category_summary: {
        Row: {
          category_code: string | null;
          category_id: string | null;
          category_name: string | null;
          category_sort_order: number | null;
          expense_count: number | null;
          org_id: string | null;
          project_id: string | null;
          total_cents: number | null;
        };
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
          org_id: string | null;
          project_id: string | null;
        };
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
          org_id: string | null;
          project_id: string | null;
          unclassified_count: number | null;
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
      v_stage_summary: {
        Row: {
          budget_cents: number | null;
          committed_cents: number | null;
          expense_count: number | null;
          name: string | null;
          org_id: string | null;
          progress_percent: number | null;
          project_id: string | null;
          sort_order: number | null;
          spent_cents: number | null;
          stage_id: string | null;
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
    };
    Functions: {
      accept_invitation: {
        Args: { p_token: string };
        Returns: {
          org_slug: string;
          project_id: string;
        }[];
      };
      admin_orgs: {
        Args: { p_month: string };
        Returns: {
          ai_calls: number;
          ai_input_tokens: number;
          ai_output_tokens: number;
          audio_seconds: number;
          created_at: string;
          current_period_end: string;
          expenses_month: number;
          kind: Database["public"]["Enums"]["org_kind"];
          members: number;
          name: string;
          org_id: string;
          owner_email: string;
          plan_code: string;
          plan_name: string;
          projects: number;
          status: Database["public"]["Enums"]["subscription_status"];
          template_messages: number;
          trial_ends_at: string;
          whatsapp_entries: number;
        }[];
      };
      billing_mark_cancelled: {
        Args: { p_org_id: string };
        Returns: undefined;
      };
      billing_set_customer: {
        Args: { p_customer_id: string; p_org_id: string };
        Returns: undefined;
      };
      billing_set_subscription: {
        Args: { p_org_id: string; p_plan_code: string; p_subscription_id: string };
        Returns: undefined;
      };
      delete_my_account: { Args: never; Returns: undefined };
      expire_pending_expenses: {
        Args: { p_older_than?: string };
        Returns: number;
      };
      get_invitation: {
        Args: { p_token: string };
        Returns: {
          inviter_name: string;
          org_name: string;
          org_role: Database["public"]["Enums"]["org_role"];
          project_name: string;
          project_role: Database["public"]["Enums"]["project_role"];
          status: string;
        }[];
      };
      increment_usage: {
        Args: {
          p_ai_calls?: number;
          p_ai_input_tokens?: number;
          p_ai_output_tokens?: number;
          p_audio_seconds?: number;
          p_month: string;
          p_org_id: string;
          p_template_messages?: number;
          p_whatsapp_entries?: number;
        };
        Returns: undefined;
      };
      link_whatsapp: {
        Args: {
          p_code_hash: string;
          p_phone: string;
          p_phone_variants: string[];
        };
        Returns: string;
      };
      org_team: {
        Args: { p_org_id: string };
        Returns: {
          email: string;
          full_name: string;
          joined_at: string;
          projects: Json;
          role: Database["public"]["Enums"]["org_role"];
          user_id: string;
        }[];
      };
      pay_payable: {
        Args: {
          p_amount_cents?: number;
          p_has_invoice?: boolean;
          p_paid_on: string;
          p_payable_id: string;
          p_payment_method?: Database["public"]["Enums"]["payment_method"];
        };
        Returns: string;
      };
      purge_whatsapp_log: { Args: { p_older_than?: string }; Returns: number };
      unlink_whatsapp: { Args: never; Returns: undefined };
      update_stage_plan: {
        Args: { p_items: Json; p_project_id: string };
        Returns: number;
      };
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
      payable_status: "open" | "paid" | "cancelled";
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
      whatsapp_conversation_state:
        | "idle"
        | "awaiting_confirmation"
        | "awaiting_stage"
        | "awaiting_amount"
        | "awaiting_project";
      whatsapp_direction: "in" | "out";
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
      payable_status: ["open", "paid", "cancelled"],
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
      whatsapp_conversation_state: [
        "idle",
        "awaiting_confirmation",
        "awaiting_stage",
        "awaiting_amount",
        "awaiting_project",
      ],
      whatsapp_direction: ["in", "out"],
    },
  },
} as const;
