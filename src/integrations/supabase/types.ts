export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      comments: {
        Row: {
          anchor: string;
          assignee_id: string | null;
          author_id: string;
          body: string;
          created_at: string;
          device: string;
          id: string;
          opened_on: string;
          position: Json | null;
          resolved_at: string | null;
          resolved_by: string | null;
          thread_id: string | null;
          updated_at: string;
        };
        Insert: {
          anchor: string;
          assignee_id?: string | null;
          author_id: string;
          body: string;
          created_at?: string;
          device?: string;
          id?: string;
          opened_on: string;
          position?: Json | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          thread_id?: string | null;
          updated_at?: string;
        };
        Update: {
          anchor?: string;
          assignee_id?: string | null;
          author_id?: string;
          body?: string;
          created_at?: string;
          device?: string;
          id?: string;
          opened_on?: string;
          position?: Json | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          thread_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_assignee_id_fkey";
            columns: ["assignee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
        ];
      };
      hotspots: {
        Row: {
          body: string;
          id: string;
          items: Json;
          label: string;
          link_url: string;
          sort: number;
          x: number;
          y: number;
        };
        Insert: {
          body?: string;
          id?: string;
          items?: Json;
          label: string;
          link_url?: string;
          sort?: number;
          x?: number;
          y?: number;
        };
        Update: {
          body?: string;
          id?: string;
          items?: Json;
          label?: string;
          link_url?: string;
          sort?: number;
          x?: number;
          y?: number;
        };
        Relationships: [];
      };
      investments: {
        Row: {
          description: string;
          id: string;
          is_placeholder: boolean;
          logo_url: string;
          name: string;
          sector: string;
          stage: string;
          website_url: string;
        };
        Insert: {
          description?: string;
          id?: string;
          is_placeholder?: boolean;
          logo_url?: string;
          name?: string;
          sector?: string;
          stage?: string;
          website_url?: string;
        };
        Update: {
          description?: string;
          id?: string;
          is_placeholder?: boolean;
          logo_url?: string;
          name?: string;
          sector?: string;
          stage?: string;
          website_url?: string;
        };
        Relationships: [];
      };
      partners: {
        Row: {
          id: string;
          logo_url: string;
          name: string;
          sort: number;
          url: string;
        };
        Insert: {
          id?: string;
          logo_url?: string;
          name: string;
          sort?: number;
          url?: string;
        };
        Update: {
          id?: string;
          logo_url?: string;
          name?: string;
          sort?: number;
          url?: string;
        };
        Relationships: [];
      };
      pillars: {
        Row: {
          accordions: Json;
          body: string;
          id: string;
          image_url: string;
          sort: number;
          tagline: string;
          title: string;
        };
        Insert: {
          accordions?: Json;
          body?: string;
          id?: string;
          image_url?: string;
          sort?: number;
          tagline?: string;
          title: string;
        };
        Update: {
          accordions?: Json;
          body?: string;
          id?: string;
          image_url?: string;
          sort?: number;
          tagline?: string;
          title?: string;
        };
        Relationships: [];
      };
      posts: {
        Row: {
          author: string;
          body: string;
          cover_url: string;
          created_at: string;
          draft: Json | null;
          excerpt: string;
          id: string;
          modules: Json;
          published: boolean;
          published_at: string | null;
          seo: Json | null;
          slug: string;
          title: string;
        };
        Insert: {
          author?: string;
          body?: string;
          cover_url?: string;
          created_at?: string;
          draft?: Json | null;
          excerpt?: string;
          id?: string;
          modules?: Json;
          published?: boolean;
          published_at?: string | null;
          seo?: Json | null;
          slug: string;
          title: string;
        };
        Update: {
          author?: string;
          body?: string;
          cover_url?: string;
          created_at?: string;
          draft?: Json | null;
          excerpt?: string;
          id?: string;
          modules?: Json;
          published?: boolean;
          published_at?: string | null;
          seo?: Json | null;
          slug?: string;
          title?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          first_name: string;
          id: string;
          last_name: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          first_name?: string;
          id: string;
          last_name?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          first_name?: string;
          id?: string;
          last_name?: string;
        };
        Relationships: [];
      };
      publications: {
        Row: {
          coauthors: string | null;
          featured: boolean;
          id: string;
          is_placeholder: boolean;
          kind: string;
          month: string | null;
          outlet: string | null;
          pdf: string | null;
          sort: number;
          summary: string;
          title: string;
          url: string;
          year: string;
        };
        Insert: {
          coauthors?: string | null;
          featured?: boolean;
          id?: string;
          is_placeholder?: boolean;
          kind?: string;
          month?: string | null;
          outlet?: string | null;
          pdf?: string | null;
          sort?: number;
          summary?: string;
          title?: string;
          url?: string;
          year?: string;
        };
        Update: {
          coauthors?: string | null;
          featured?: boolean;
          id?: string;
          is_placeholder?: boolean;
          kind?: string;
          month?: string | null;
          outlet?: string | null;
          pdf?: string | null;
          sort?: number;
          summary?: string;
          title?: string;
          url?: string;
          year?: string;
        };
        Relationships: [];
      };
      site_content: {
        Row: {
          content: Json;
          draft: Json | null;
          key: string;
          updated_at: string;
        };
        Insert: {
          content?: Json;
          draft?: Json | null;
          key: string;
          updated_at?: string;
        };
        Update: {
          content?: Json;
          draft?: Json | null;
          key?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stack_cards: {
        Row: {
          body: string;
          id: string;
          image_url: string;
          sort: number;
          title: string;
        };
        Insert: {
          body?: string;
          id?: string;
          image_url?: string;
          sort?: number;
          title: string;
        };
        Update: {
          body?: string;
          id?: string;
          image_url?: string;
          sort?: number;
          title?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_post_drafts: {
        Args: never;
        Returns: {
          draft: Json;
          id: string;
        }[];
      };
      admin_site_drafts: {
        Args: never;
        Returns: {
          draft: Json;
          key: string;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "user";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
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
      app_role: ["admin", "user"],
    },
  },
} as const;
