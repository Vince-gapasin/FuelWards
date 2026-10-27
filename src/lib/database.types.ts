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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_actions: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          detail: Json | null
          id: number
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: never
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: never
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_actions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_deliveries: {
        Row: {
          alert_id: string
          created_at: string
          fuel_type: string
          id: number
          price: number
          pushed_at: string | null
          read_at: string | null
          report_id: string
          station_id: string
          user_id: string
        }
        Insert: {
          alert_id: string
          created_at?: string
          fuel_type: string
          id?: never
          price: number
          pushed_at?: string | null
          read_at?: string | null
          report_id: string
          station_id: string
          user_id: string
        }
        Update: {
          alert_id?: string
          created_at?: string
          fuel_type?: string
          id?: never
          price?: number
          pushed_at?: string | null
          read_at?: string | null
          report_id?: string
          station_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_deliveries_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "price_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_deliveries_fuel_type_fkey"
            columns: ["fuel_type"]
            isOneToOne: false
            referencedRelation: "fuel_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "alert_deliveries_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "price_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_deliveries_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          description: string | null
          key: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          value?: Json
        }
        Relationships: []
      }
      brands: {
        Row: {
          color: string
          id: number
          name: string
          slug: string
        }
        Insert: {
          color?: string
          id?: never
          name: string
          slug: string
        }
        Update: {
          color?: string
          id?: never
          name?: string
          slug?: string
        }
        Relationships: []
      }
      doe_bulletins: {
        Row: {
          change_max: number
          change_min: number
          created_at: string
          effective_date: string
          fuel_type: string
          id: string
          region: string
          source_url: string | null
        }
        Insert: {
          change_max: number
          change_min: number
          created_at?: string
          effective_date: string
          fuel_type: string
          id?: string
          region?: string
          source_url?: string | null
        }
        Update: {
          change_max?: number
          change_min?: number
          created_at?: string
          effective_date?: string
          fuel_type?: string
          id?: string
          region?: string
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doe_bulletins_fuel_type_fkey"
            columns: ["fuel_type"]
            isOneToOne: false
            referencedRelation: "fuel_types"
            referencedColumns: ["code"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          station_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          station_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          station_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_types: {
        Row: {
          code: string
          label: string
          short_label: string
          sort: number
        }
        Insert: {
          code: string
          label: string
          short_label: string
          sort?: number
        }
        Update: {
          code?: string
          label?: string
          short_label?: string
          sort?: number
        }
        Relationships: []
      }
      points_ledger: {
        Row: {
          created_at: string
          delta: number
          id: number
          reason: string
          ref_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: never
          reason: string
          ref_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: never
          reason?: string
          ref_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      price_alerts: {
        Row: {
          center: unknown
          created_at: string
          fuel_type: string
          id: string
          is_active: boolean
          max_price: number
          radius_m: number
          station_id: string | null
          user_id: string
        }
        Insert: {
          center?: unknown
          created_at?: string
          fuel_type: string
          id?: string
          is_active?: boolean
          max_price: number
          radius_m?: number
          station_id?: string | null
          user_id?: string
        }
        Update: {
          center?: unknown
          created_at?: string
          fuel_type?: string
          id?: string
          is_active?: boolean
          max_price?: number
          radius_m?: number
          station_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_alerts_fuel_type_fkey"
            columns: ["fuel_type"]
            isOneToOne: false
            referencedRelation: "fuel_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "price_alerts_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      price_reports: {
        Row: {
          distance_m: number | null
          flag_reason: string | null
          flagged: boolean
          fuel_type: string
          id: string
          photo_path: string | null
          price: number
          reported_at: string
          reporter_location: unknown
          station_id: string
          status: Database["public"]["Enums"]["report_status"]
          user_id: string | null
          verified_at: string | null
        }
        Insert: {
          distance_m?: number | null
          flag_reason?: string | null
          flagged?: boolean
          fuel_type: string
          id?: string
          photo_path?: string | null
          price: number
          reported_at?: string
          reporter_location?: unknown
          station_id: string
          status?: Database["public"]["Enums"]["report_status"]
          user_id?: string | null
          verified_at?: string | null
        }
        Update: {
          distance_m?: number | null
          flag_reason?: string | null
          flagged?: boolean
          fuel_type?: string
          id?: string
          photo_path?: string | null
          price?: number
          reported_at?: string
          reporter_location?: unknown
          station_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          user_id?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_reports_fuel_type_fkey"
            columns: ["fuel_type"]
            isOneToOne: false
            referencedRelation: "fuel_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "price_reports_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          ban_reason: string | null
          banned_at: string | null
          created_at: string
          display_name: string | null
          id: string
          notify_doe: boolean
          privacy_accepted_at: string | null
          role: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          notify_doe?: boolean
          privacy_accepted_at?: string | null
          role?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          notify_doe?: boolean
          privacy_accepted_at?: string | null
          role?: string
          username?: string
        }
        Relationships: []
      }
      push_outbox: {
        Row: {
          body: string
          created_at: string
          data: Json
          id: number
          pushed_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json
          id?: never
          pushed_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json
          id?: never
          pushed_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_outbox_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          platform: string
          token: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      redemptions: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          points_spent: number
          reward_id: string
          status: Database["public"]["Enums"]["redemption_status"]
          used_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          points_spent: number
          reward_id: string
          status?: Database["public"]["Enums"]["redemption_status"]
          used_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          points_spent?: number
          reward_id?: string
          status?: Database["public"]["Enums"]["redemption_status"]
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_votes: {
        Row: {
          created_at: string
          report_id: string
          user_id: string
          vote: Database["public"]["Enums"]["vote_kind"]
        }
        Insert: {
          created_at?: string
          report_id: string
          user_id: string
          vote: Database["public"]["Enums"]["vote_kind"]
        }
        Update: {
          created_at?: string
          report_id?: string
          user_id?: string
          vote?: Database["public"]["Enums"]["vote_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "report_votes_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "price_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          cost_points: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          partner: string | null
          stock: number | null
          title: string
        }
        Insert: {
          cost_points: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          partner?: string | null
          stock?: number | null
          title: string
        }
        Update: {
          cost_points?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          partner?: string | null
          stock?: number | null
          title?: string
        }
        Relationships: []
      }
      stations: {
        Row: {
          address: string | null
          brand_id: number | null
          city: string | null
          created_at: string
          id: string
          is_active: boolean
          location: unknown
          name: string
          osm_id: number | null
        }
        Insert: {
          address?: string | null
          brand_id?: number | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          location: unknown
          name: string
          osm_id?: number | null
        }
        Update: {
          address?: string | null
          brand_id?: number | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          location?: unknown
          name?: string
          osm_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_price_announcements: {
        Row: {
          body: string
          created_at: string
          recipients: number
          week_start: string
        }
        Insert: {
          body: string
          created_at?: string
          recipients: number
          week_start: string
        }
        Update: {
          body?: string
          created_at?: string
          recipients?: number
          week_start?: string
        }
        Relationships: []
      }
      weekly_price_summaries: {
        Row: {
          fuel_type: string
          median_price: number
          prev_median: number | null
          prev_station_count: number
          station_count: number
          updated_at: string
          week_start: string
        }
        Insert: {
          fuel_type: string
          median_price: number
          prev_median?: number | null
          prev_station_count?: number
          station_count: number
          updated_at?: string
          week_start: string
        }
        Update: {
          fuel_type?: string
          median_price?: number
          prev_median?: number | null
          prev_station_count?: number
          station_count?: number
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_price_summaries_fuel_type_fkey"
            columns: ["fuel_type"]
            isOneToOne: false
            referencedRelation: "fuel_types"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Views: {
      station_latest_prices: {
        Row: {
          fuel_type: string | null
          price: number | null
          reported_at: string | null
          station_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_reports_fuel_type_fkey"
            columns: ["fuel_type"]
            isOneToOne: false
            referencedRelation: "fuel_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "price_reports_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_points: {
        Row: {
          balance: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_announce_bulletin: { Args: { p_date: string }; Returns: number }
      admin_decide_report: {
        Args: {
          p_outcome: Database["public"]["Enums"]["report_status"]
          p_report_id: string
        }
        Returns: undefined
      }
      admin_overview: { Args: never; Returns: Json }
      admin_recent_actions: {
        Args: never
        Returns: {
          action: string
          admin_username: string
          created_at: string
          detail: Json
          id: number
          target_id: string
          target_table: string
        }[]
      }
      admin_report_queue: {
        Args: { p_filter?: string }
        Returns: {
          confirms: number
          disputes: number
          distance_m: number
          flag_reason: string
          flagged: boolean
          fuel_type: string
          id: string
          price: number
          reported_at: string
          reporter_banned: boolean
          reporter_id: string
          reporter_rejected: number
          reporter_username: string
          reporter_verified: number
          station_id: string
          station_name: string
          status: Database["public"]["Enums"]["report_status"]
        }[]
      }
      admin_set_ban: {
        Args: { p_banned: boolean; p_reason?: string; p_user_id: string }
        Returns: undefined
      }
      admin_users: {
        Args: { p_search?: string }
        Returns: {
          balance: number
          ban_reason: string
          banned_at: string
          created_at: string
          display_name: string
          id: string
          pending_reports: number
          rejected_reports: number
          role: string
          username: string
          verified_reports: number
        }[]
      }
      announce_weekly_prices: { Args: { p_now?: string }; Returns: number }
      config_number: { Args: { config_key: string }; Returns: number }
      create_price_alert: {
        Args: {
          p_fuel_type: string
          p_lat?: number
          p_lng?: number
          p_max_price: number
          p_radius_m?: number
          p_station_id?: string
        }
        Returns: string
      }
      current_doe_bulletin: {
        Args: { p_region?: string }
        Returns: {
          change_max: number
          change_min: number
          effective_date: string
          fuel_type: string
          source_url: string
        }[]
      }
      current_weekly_prices: {
        Args: { p_now?: string }
        Returns: {
          change: number
          fuel_type: string
          median_price: number
          station_count: number
          week_start: string
        }[]
      }
      decide_report: {
        Args: {
          p_outcome: Database["public"]["Enums"]["report_status"]
          p_report_id: string
        }
        Returns: undefined
      }
      delete_my_account: { Args: never; Returns: undefined }
      favorite_stations: {
        Args: { lat: number; lng: number }
        Returns: {
          address: string
          brand: string
          brand_color: string
          distance_m: number
          id: string
          latitude: number
          longitude: number
          name: string
          pending_count: number
          prices: Json
        }[]
      }
      format_peso_change: { Args: { n: number }; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      leaderboard: {
        Args: { p_period?: string }
        Returns: {
          display_name: string
          is_me: boolean
          points: number
          rank: number
          tier: string
          username: string
        }[]
      }
      log_admin_action: {
        Args: {
          p_action: string
          p_detail?: Json
          p_table: string
          p_target: string
        }
        Returns: undefined
      }
      manila_week_start: { Args: { p_at: string }; Returns: string }
      my_badges: { Args: never; Returns: Json }
      my_data_export: { Args: never; Returns: Json }
      my_points: {
        Args: never
        Returns: {
          balance: number
          pending: number
        }[]
      }
      my_price_alerts: {
        Args: never
        Returns: {
          created_at: string
          fuel_type: string
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          max_price: number
          radius_m: number
          station_id: string
          station_name: string
        }[]
      }
      my_settings: { Args: never; Returns: Json }
      my_stats: {
        Args: never
        Returns: {
          balance: number
          lifetime: number
          next_tier: string
          next_tier_at: number
          pending: number
          tier: string
          verified_reports: number
          votes: number
        }[]
      }
      nearby_stations: {
        Args: { lat: number; lng: number; radius_m?: number }
        Returns: {
          address: string
          brand: string
          brand_color: string
          distance_m: number
          id: string
          latitude: number
          longitude: number
          name: string
          pending_count: number
          prices: Json
        }[]
      }
      price_broadcast_payload: {
        Args: { r: Database["public"]["Tables"]["price_reports"]["Row"] }
        Returns: Json
      }
      process_pending_reports: { Args: never; Returns: number }
      purge_old_report_locations: { Args: never; Returns: number }
      redeem_reward: { Args: { p_reward_id: string }; Returns: Json }
      refresh_weekly_price_summary: {
        Args: { p_now?: string }
        Returns: number
      }
      require_admin: { Args: never; Returns: undefined }
      run_weekly_price_summary: { Args: never; Returns: undefined }
      search_stations: {
        Args: { lat: number; lng: number; query: string }
        Returns: {
          address: string
          brand: string
          brand_color: string
          distance_m: number
          id: string
          latitude: number
          longitude: number
          name: string
          pending_count: number
          prices: Json
        }[]
      }
      send_pushes: { Args: never; Returns: number }
      set_notify_doe: { Args: { p_on: boolean }; Returns: undefined }
      station_details: {
        Args: { p_station_id: string }
        Returns: {
          address: string
          brand: string
          id: string
          latitude: number
          longitude: number
          name: string
        }[]
      }
      station_pending_reports: {
        Args: { p_station_id: string }
        Returns: {
          confirms: number
          disputes: number
          flagged: boolean
          fuel_type: string
          id: string
          is_mine: boolean
          my_vote: Database["public"]["Enums"]["vote_kind"]
          needed: number
          price: number
          reported_at: string
        }[]
      }
      station_price_history: {
        Args: { p_days?: number; p_station_id: string }
        Returns: {
          day: string
          fuel_type: string
          price: number
        }[]
      }
      submit_price_report: {
        Args: {
          p_lat: number
          p_lng: number
          p_prices: Json
          p_station_id: string
        }
        Returns: Json
      }
      tier_for: {
        Args: { p_points: number }
        Returns: {
          next_tier: string
          next_tier_at: number
          tier: string
        }[]
      }
      username_available: { Args: { name: string }; Returns: boolean }
      vote_on_report: {
        Args: {
          p_lat: number
          p_lng: number
          p_report_id: string
          p_vote: Database["public"]["Enums"]["vote_kind"]
        }
        Returns: Json
      }
    }
    Enums: {
      redemption_status: "issued" | "used" | "expired" | "cancelled"
      report_status: "pending" | "verified" | "rejected"
      vote_kind: "confirm" | "dispute"
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
      redemption_status: ["issued", "used", "expired", "cancelled"],
      report_status: ["pending", "verified", "rejected"],
      vote_kind: ["confirm", "dispute"],
    },
  },
} as const
