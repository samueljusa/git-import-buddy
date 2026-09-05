export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          id: string
          promo_enabled: boolean
          promo_prices: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          promo_enabled?: boolean
          promo_prices?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          promo_enabled?: boolean
          promo_prices?: Json
          updated_at?: string
        }
        Relationships: []
      }
      community_gallery: {
        Row: {
          created_at: string
          generation_id: string | null
          id: string
          media_type: string
          media_url: string | null
          moderated_at: string | null
          prompt: string
          rejection_reason: string | null
          status: string
          storage_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          generation_id?: string | null
          id?: string
          media_type?: string
          media_url?: string | null
          moderated_at?: string | null
          prompt: string
          rejection_reason?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          generation_id?: string | null
          id?: string
          media_type?: string
          media_url?: string | null
          moderated_at?: string | null
          prompt?: string
          rejection_reason?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_gallery_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_usage: {
        Row: {
          created_at: string
          id: string
          images_used: number
          seconds_used: number
          tier: string
          updated_at: string
          usage_date: string
          user_id: string
          video_pause_until: string | null
          videos_used: number
        }
        Insert: {
          created_at?: string
          id?: string
          images_used?: number
          seconds_used?: number
          tier?: string
          updated_at?: string
          usage_date?: string
          user_id: string
          video_pause_until?: string | null
          videos_used?: number
        }
        Update: {
          created_at?: string
          id?: string
          images_used?: number
          seconds_used?: number
          tier?: string
          updated_at?: string
          usage_date?: string
          user_id?: string
          video_pause_until?: string | null
          videos_used?: number
        }
        Relationships: []
      }
      generations: {
        Row: {
          approved: boolean
          aspect_ratio: string | null
          created_at: string
          duration: string | null
          duration_seconds: number
          error_message: string | null
          id: string
          media_type: string
          media_url: string | null
          moderated_at: string | null
          moderation_status: string
          prompt: string
          rejection_reason: string | null
          resolution: string | null
          status: string
          storage_path: string | null
          submitted_public: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          aspect_ratio?: string | null
          created_at?: string
          duration?: string | null
          duration_seconds?: number
          error_message?: string | null
          id?: string
          media_type?: string
          media_url?: string | null
          moderated_at?: string | null
          moderation_status?: string
          prompt: string
          rejection_reason?: string | null
          resolution?: string | null
          status?: string
          storage_path?: string | null
          submitted_public?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          approved?: boolean
          aspect_ratio?: string | null
          created_at?: string
          duration?: string | null
          duration_seconds?: number
          error_message?: string | null
          id?: string
          media_type?: string
          media_url?: string | null
          moderated_at?: string | null
          moderation_status?: string
          prompt?: string
          rejection_reason?: string | null
          resolution?: string | null
          status?: string
          storage_path?: string | null
          submitted_public?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount_eur: number
          amount_local: number
          country_code: string
          created_at: string
          currency: string
          customer_email: string
          customer_name: string
          error_message: string | null
          exchange_rate: number
          id: string
          last_checked_at: string | null
          mobile: string
          payment_link: string | null
          payment_method: string
          period: string
          product_id: string
          provider_message: string | null
          provider_response: Json | null
          provider_transaction_id: string | null
          status: string
          tier: string
          transaction_id: string
          updated_at: string
          user_id: string | null
          webhook_payload: Json | null
        }
        Insert: {
          amount_eur: number
          amount_local: number
          country_code: string
          created_at?: string
          currency: string
          customer_email: string
          customer_name: string
          error_message?: string | null
          exchange_rate: number
          id?: string
          last_checked_at?: string | null
          mobile: string
          payment_link?: string | null
          payment_method: string
          period?: string
          product_id: string
          provider_message?: string | null
          provider_response?: Json | null
          provider_transaction_id?: string | null
          status?: string
          tier: string
          transaction_id: string
          updated_at?: string
          user_id?: string | null
          webhook_payload?: Json | null
        }
        Update: {
          amount_eur?: number
          amount_local?: number
          country_code?: string
          created_at?: string
          currency?: string
          customer_email?: string
          customer_name?: string
          error_message?: string | null
          exchange_rate?: number
          id?: string
          last_checked_at?: string | null
          mobile?: string
          payment_link?: string | null
          payment_method?: string
          period?: string
          product_id?: string
          provider_message?: string | null
          provider_response?: Json | null
          provider_transaction_id?: string | null
          status?: string
          tier?: string
          transaction_id?: string
          updated_at?: string
          user_id?: string | null
          webhook_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_prices"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_attempts: {
        Row: {
          amount: number
          checkout_url: string | null
          created_at: string
          currency: string
          error_message: string | null
          id: string
          last_webhook_at: string | null
          last_webhook_payload: Json | null
          last_webhook_status: string | null
          provider: string
          reference: string
          status: string
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          checkout_url?: string | null
          created_at?: string
          currency?: string
          error_message?: string | null
          id?: string
          last_webhook_at?: string | null
          last_webhook_payload?: Json | null
          last_webhook_status?: string | null
          provider?: string
          reference: string
          status?: string
          tier: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          checkout_url?: string | null
          created_at?: string
          currency?: string
          error_message?: string | null
          id?: string
          last_webhook_at?: string | null
          last_webhook_payload?: Json | null
          last_webhook_status?: string | null
          provider?: string
          reference?: string
          status?: string
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_prices: {
        Row: {
          active: boolean
          amount_eur: number
          amount_eur_yearly: number | null
          created_at: string
          id: string
          label: string
          sort_order: number
          tier: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_eur: number
          amount_eur_yearly?: number | null
          created_at?: string
          id: string
          label: string
          sort_order?: number
          tier: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_eur?: number
          amount_eur_yearly?: number | null
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          credits_balance: number
          email: string | null
          full_name: string | null
          id: string
          preferences: Json
          promo_claimed_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          credits_balance?: number
          email?: string | null
          full_name?: string | null
          id: string
          preferences?: Json
          promo_claimed_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          credits_balance?: number
          email?: string | null
          full_name?: string | null
          id?: string
          preferences?: Json
          promo_claimed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          auto_renew: boolean
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          plan_type: string | null
          started_at: string
          status: string
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_renew?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          plan_type?: string | null
          started_at?: string
          status?: string
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_renew?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          plan_type?: string | null
          started_at?: string
          status?: string
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          body: string
          created_at: string
          email: string | null
          id: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          email?: string | null
          id?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          email?: string | null
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_replies: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_staff: boolean
          message_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_staff?: boolean
          message_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_staff?: boolean
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_replies_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      user_quotas: {
        Row: {
          created_at: string
          daily_video_limit_seconds: number
          daily_video_remaining_seconds: number
          daily_video_used_seconds: number
          quota_period_end: string
          quota_period_start: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_video_limit_seconds?: number
          daily_video_remaining_seconds?: number
          daily_video_used_seconds?: number
          quota_period_end?: string
          quota_period_start?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_video_limit_seconds?: number
          daily_video_remaining_seconds?: number
          daily_video_used_seconds?: number
          quota_period_end?: string
          quota_period_start?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_tier: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      plan_video_seconds: { Args: { _plan: string }; Returns: number }
      refund_media_quota: {
        Args: { _media_type: string; _user_id: string }
        Returns: undefined
      }
      refund_quota: {
        Args: { _seconds: number; _user_id: string }
        Returns: undefined
      }
      refund_video_seconds: {
        Args: { _seconds: number; _user_id: string }
        Returns: undefined
      }
      reserve_media_quota: {
        Args: { _media_type: string; _user_id: string }
        Returns: {
          allowed: boolean
          images_used: number
          reason: string
          retry_at: string
          videos_used: number
        }[]
      }
      reserve_quota: {
        Args: { _seconds: number; _user_id: string }
        Returns: {
          allowed: boolean
          seconds_limit: number
          seconds_used: number
          tier: string
        }[]
      }
      reserve_video_seconds: {
        Args: { _seconds: number; _user_id: string }
        Returns: {
          allowed: boolean
          expires_at: string
          limit_seconds: number
          period_end: string
          plan_type: string
          reason: string
          remaining_seconds: number
          used_seconds: number
        }[]
      }
      tier_daily_seconds: { Args: { _tier: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "support" | "finance"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user", "support", "finance"],
    },
  },
} as const
