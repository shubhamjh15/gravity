/**
 * Supabase database types — GENERATED. Do not edit by hand.
 *
 * Regenerate after any migration:
 *   npm run db:types
 *
 * Produced by scripts/gen-types.mjs, which introspects the live catalog over a
 * plain Postgres connection. (The official `supabase gen types` shells out to
 * Docker; this keeps type generation dependency-free.)
 *
 * Generated from 50 tables, 1 views, 61 functions.
 */

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
      about_pages: {
        Row: {
          id: string;
          slug: string;
          content_json: Json;
          gallery: Json;
          company_details: Json;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug?: string;
          content_json?: Json;
          gallery?: Json;
          company_details?: Json;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          content_json?: Json;
          gallery?: Json;
          company_details?: Json;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      admin_sessions: {
        Row: {
          id: string;
          admin_id: string;
          ip: string | null;
          user_agent: string | null;
          expires_at: string;
          last_seen: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_id: string;
          ip?: string | null;
          user_agent?: string | null;
          expires_at: string;
          last_seen?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          admin_id?: string;
          ip?: string | null;
          user_agent?: string | null;
          expires_at?: string;
          last_seen?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      announcements: {
        Row: {
          id: string;
          scope: string;
          scope_id: string | null;
          title: string;
          body: string | null;
          level: string;
          active_from: string;
          active_to: string | null;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
          deleted_at: string | null;
          remarks: string | null;
        };
        Insert: {
          id?: string;
          scope: string;
          scope_id?: string | null;
          title: string;
          body?: string | null;
          level?: string;
          active_from?: string;
          active_to?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
          remarks?: string | null;
        };
        Update: {
          id?: string;
          scope?: string;
          scope_id?: string | null;
          title?: string;
          body?: string | null;
          level?: string;
          active_from?: string;
          active_to?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
          remarks?: string | null;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          key: string;
          value: Json;
          description: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          key: string;
          value: Json;
          description?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          key?: string;
          value?: Json;
          description?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          target_table: string | null;
          target_id: string | null;
          before: Json | null;
          after: Json | null;
          ip: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          target_table?: string | null;
          target_id?: string | null;
          before?: Json | null;
          after?: Json | null;
          ip?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action?: string;
          target_table?: string | null;
          target_id?: string | null;
          before?: Json | null;
          after?: Json | null;
          ip?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      chat_channels: {
        Row: {
          id: string;
          community_id: string | null;
          kind: string;
          name: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          community_id?: string | null;
          kind?: string;
          name?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          community_id?: string | null;
          kind?: string;
          name?: string | null;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      chat_members: {
        Row: {
          id: string;
          channel_id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          channel_id: string;
          user_id: string;
          role?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          channel_id?: string;
          user_id?: string;
          role?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          channel_id: string;
          sender_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          channel_id: string;
          sender_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          channel_id?: string;
          sender_id?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      communities: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          slug: string;
          profile_pic_path: string | null;
          banner_path: string | null;
          about: string | null;
          location: string | null;
          address: string | null;
          rules: string | null;
          visibility: string;
          is_paid: boolean;
          requires_approval: boolean;
          membership_cost_paise: number;
          invite_slug: string | null;
          is_featured: boolean;
          is_restricted: boolean;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          deleted_at: string | null;
          remarks: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          slug: string;
          profile_pic_path?: string | null;
          banner_path?: string | null;
          about?: string | null;
          location?: string | null;
          address?: string | null;
          rules?: string | null;
          visibility?: string;
          is_paid?: boolean;
          requires_approval?: boolean;
          membership_cost_paise?: number;
          invite_slug?: string | null;
          is_featured?: boolean;
          is_restricted?: boolean;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          deleted_at?: string | null;
          remarks?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          slug?: string;
          profile_pic_path?: string | null;
          banner_path?: string | null;
          about?: string | null;
          location?: string | null;
          address?: string | null;
          rules?: string | null;
          visibility?: string;
          is_paid?: boolean;
          requires_approval?: boolean;
          membership_cost_paise?: number;
          invite_slug?: string | null;
          is_featured?: boolean;
          is_restricted?: boolean;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          deleted_at?: string | null;
          remarks?: string | null;
        };
        Relationships: [];
      };
      community_gallery: {
        Row: {
          id: string;
          community_id: string;
          image_path: string;
          caption: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          community_id: string;
          image_path: string;
          caption?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          community_id?: string;
          image_path?: string;
          caption?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      community_members: {
        Row: {
          id: string;
          community_id: string;
          user_id: string;
          status: string;
          role: string;
          joined_via: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          community_id: string;
          user_id: string;
          status?: string;
          role?: string;
          joined_via?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          community_id?: string;
          user_id?: string;
          status?: string;
          role?: string;
          joined_via?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      community_posts: {
        Row: {
          id: string;
          community_id: string;
          author_id: string;
          body: string;
          event_id: string | null;
          pinned: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          community_id: string;
          author_id: string;
          body: string;
          event_id?: string | null;
          pinned?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          community_id?: string;
          author_id?: string;
          body?: string;
          event_id?: string | null;
          pinned?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      elite_applications: {
        Row: {
          id: string;
          community_id: string;
          user_id: string;
          status: string;
          kill_ratio_claimed: number | null;
          note: string | null;
          review_note: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          community_id: string;
          user_id: string;
          status?: string;
          kill_ratio_claimed?: number | null;
          note?: string | null;
          review_note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          community_id?: string;
          user_id?: string;
          status?: string;
          kill_ratio_claimed?: number | null;
          note?: string | null;
          review_note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      elite_policies: {
        Row: {
          id: string;
          community_id: string;
          requires_gov_id: boolean;
          min_kill_ratio: number | null;
          rules: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          community_id: string;
          requires_gov_id?: boolean;
          min_kill_ratio?: number | null;
          rules?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          community_id?: string;
          requires_gov_id?: boolean;
          min_kill_ratio?: number | null;
          rules?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_results: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          rank: number | null;
          kills: number;
          amount_paid_paise: number;
          leaderboard_screenshot_path: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          rank?: number | null;
          kills?: number;
          amount_paid_paise?: number;
          leaderboard_screenshot_path?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          rank?: number | null;
          kills?: number;
          amount_paid_paise?: number;
          leaderboard_screenshot_path?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          organizer_id: string;
          community_id: string | null;
          game_id: string;
          title: string;
          slug: string;
          banner_path: string | null;
          description: string | null;
          dos_and_donts: string | null;
          rules: string | null;
          registration_schema: Json;
          entry_fee_paise: number;
          max_slots: number;
          visibility: string;
          status: string;
          requires_approval: boolean;
          gov_id_required: boolean;
          room_id: string | null;
          room_password: string | null;
          room_released_at: string | null;
          registration_opens_at: string | null;
          registration_closes_at: string | null;
          starts_at: string | null;
          ends_at: string | null;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          deleted_at: string | null;
          remarks: string | null;
        };
        Insert: {
          id?: string;
          organizer_id: string;
          community_id?: string | null;
          game_id: string;
          title: string;
          slug: string;
          banner_path?: string | null;
          description?: string | null;
          dos_and_donts?: string | null;
          rules?: string | null;
          registration_schema?: Json;
          entry_fee_paise?: number;
          max_slots?: number;
          visibility?: string;
          status?: string;
          requires_approval?: boolean;
          gov_id_required?: boolean;
          room_id?: string | null;
          room_password?: string | null;
          room_released_at?: string | null;
          registration_opens_at?: string | null;
          registration_closes_at?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          deleted_at?: string | null;
          remarks?: string | null;
        };
        Update: {
          id?: string;
          organizer_id?: string;
          community_id?: string | null;
          game_id?: string;
          title?: string;
          slug?: string;
          banner_path?: string | null;
          description?: string | null;
          dos_and_donts?: string | null;
          rules?: string | null;
          registration_schema?: Json;
          entry_fee_paise?: number;
          max_slots?: number;
          visibility?: string;
          status?: string;
          requires_approval?: boolean;
          gov_id_required?: boolean;
          room_id?: string | null;
          room_password?: string | null;
          room_released_at?: string | null;
          registration_opens_at?: string | null;
          registration_closes_at?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          deleted_at?: string | null;
          remarks?: string | null;
        };
        Relationships: [];
      };
      featured_placements: {
        Row: {
          id: string;
          kind: string;
          target_id: string;
          reason: string;
          sort_order: number;
          active: boolean;
          created_at: string;
          created_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          kind: string;
          target_id: string;
          reason?: string;
          sort_order?: number;
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          kind?: string;
          target_id?: string;
          reason?: string;
          sort_order?: number;
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      games: {
        Row: {
          id: string;
          slug: string;
          name: string;
          icon_path: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          icon_path?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          icon_path?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      leaderboard_snapshots: {
        Row: {
          id: string;
          metric: string;
          scope: string;
          scope_id: string | null;
          period: string;
          user_id: string;
          value: number;
          rank: number;
          snapshot_at: string;
        };
        Insert: {
          id?: string;
          metric: string;
          scope: string;
          scope_id?: string | null;
          period: string;
          user_id: string;
          value?: number;
          rank: number;
          snapshot_at?: string;
        };
        Update: {
          id?: string;
          metric?: string;
          scope?: string;
          scope_id?: string | null;
          period?: string;
          user_id?: string;
          value?: number;
          rank?: number;
          snapshot_at?: string;
        };
        Relationships: [];
      };
      ledger_entries: {
        Row: {
          id: string;
          entry_type: string;
          source_type: string;
          direction: string;
          amount_paise: number;
          currency: string;
          status: string;
          user_id: string | null;
          community_id: string | null;
          event_id: string | null;
          registration_id: string | null;
          store_order_id: string | null;
          membership_id: string | null;
          sponsor_id: string | null;
          organizer_id: string | null;
          razorpay_payment_id: string | null;
          related_entry_id: string | null;
          fee_rate_applied_bps: number | null;
          meta: Json;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          entry_type: string;
          source_type: string;
          direction: string;
          amount_paise: number;
          currency?: string;
          status?: string;
          user_id?: string | null;
          community_id?: string | null;
          event_id?: string | null;
          registration_id?: string | null;
          store_order_id?: string | null;
          membership_id?: string | null;
          sponsor_id?: string | null;
          organizer_id?: string | null;
          razorpay_payment_id?: string | null;
          related_entry_id?: string | null;
          fee_rate_applied_bps?: number | null;
          meta?: Json;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          entry_type?: string;
          source_type?: string;
          direction?: string;
          amount_paise?: number;
          currency?: string;
          status?: string;
          user_id?: string | null;
          community_id?: string | null;
          event_id?: string | null;
          registration_id?: string | null;
          store_order_id?: string | null;
          membership_id?: string | null;
          sponsor_id?: string | null;
          organizer_id?: string | null;
          razorpay_payment_id?: string | null;
          related_entry_id?: string | null;
          fee_rate_applied_bps?: number | null;
          meta?: Json;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      match_invites: {
        Row: {
          id: string;
          from_user: string;
          to_user: string;
          game_id: string | null;
          status: string;
          message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          from_user: string;
          to_user: string;
          game_id?: string | null;
          status?: string;
          message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          from_user?: string;
          to_user?: string;
          game_id?: string | null;
          status?: string;
          message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          community_id: string;
          user_id: string;
          amount_paise: number;
          status: string;
          razorpay_order_id: string | null;
          ledger_entry_id: string | null;
          period_start: string | null;
          period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          community_id: string;
          user_id: string;
          amount_paise: number;
          status?: string;
          razorpay_order_id?: string | null;
          ledger_entry_id?: string | null;
          period_start?: string | null;
          period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          community_id?: string;
          user_id?: string;
          amount_paise?: number;
          status?: string;
          razorpay_order_id?: string | null;
          ledger_entry_id?: string | null;
          period_start?: string | null;
          period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          kind: string;
          title: string;
          body: string | null;
          link: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: string;
          title: string;
          body?: string | null;
          link?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          kind?: string;
          title?: string;
          body?: string | null;
          link?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      payouts: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          upi_id: string | null;
          amount_paise: number;
          status: string;
          utr: string | null;
          approved_by: string | null;
          ledger_entry_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          upi_id?: string | null;
          amount_paise: number;
          status?: string;
          utr?: string | null;
          approved_by?: string | null;
          ledger_entry_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          upi_id?: string | null;
          amount_paise?: number;
          status?: string;
          utr?: string | null;
          approved_by?: string | null;
          ledger_entry_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_admins: {
        Row: {
          id: string;
          user_id: string;
          totp_secret: string | null;
          ip_allowlist: string[];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          totp_secret?: string | null;
          ip_allowlist?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          totp_secret?: string | null;
          ip_allowlist?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      player_documents: {
        Row: {
          id: string;
          user_id: string;
          doc_type: string;
          file_path: string;
          review_status: string;
          reviewed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          doc_type: string;
          file_path: string;
          review_status?: string;
          reviewed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          doc_type?: string;
          file_path?: string;
          review_status?: string;
          reviewed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      player_game_profiles: {
        Row: {
          id: string;
          user_id: string;
          game_id: string;
          in_game_id: string | null;
          ign: string | null;
          ranking: string | null;
          kill_ratio: number | null;
          win_ratio: number | null;
          skill_proof_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          game_id: string;
          in_game_id?: string | null;
          ign?: string | null;
          ranking?: string | null;
          kill_ratio?: number | null;
          win_ratio?: number | null;
          skill_proof_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          game_id?: string;
          in_game_id?: string | null;
          ign?: string | null;
          ranking?: string | null;
          kill_ratio?: number | null;
          win_ratio?: number | null;
          skill_proof_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      player_stats: {
        Row: {
          user_id: string;
          total_kills: number;
          total_wins: number;
          total_matches: number;
          net_earnings_paise: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          total_kills?: number;
          total_wins?: number;
          total_matches?: number;
          net_earnings_paise?: number;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          total_kills?: number;
          total_wins?: number;
          total_matches?: number;
          net_earnings_paise?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      prize_structures: {
        Row: {
          id: string;
          event_id: string;
          entry_fee_paise: number;
          rank_prizes_paise: Json;
          per_kill_paise: number;
          kill_budget_cap_paise: number;
          admin_cut_paise: number;
          organizer_profit_paise: number;
          fill_policy: string;
          kill_surplus_policy: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          entry_fee_paise?: number;
          rank_prizes_paise?: Json;
          per_kill_paise?: number;
          kill_budget_cap_paise?: number;
          admin_cut_paise?: number;
          organizer_profit_paise?: number;
          fill_policy?: string;
          kill_surplus_policy?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          entry_fee_paise?: number;
          rank_prizes_paise?: Json;
          per_kill_paise?: number;
          kill_budget_cap_paise?: number;
          admin_cut_paise?: number;
          organizer_profit_paise?: number;
          fill_policy?: string;
          kill_surplus_policy?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_path: string | null;
          banner_path: string | null;
          age: number | null;
          gender: string | null;
          email: string | null;
          profile_completion_pct: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          status: string;
          remarks: string | null;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_path?: string | null;
          banner_path?: string | null;
          age?: number | null;
          gender?: string | null;
          email?: string | null;
          profile_completion_pct?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          status?: string;
          remarks?: string | null;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_path?: string | null;
          banner_path?: string | null;
          age?: number | null;
          gender?: string | null;
          email?: string | null;
          profile_completion_pct?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          status?: string;
          remarks?: string | null;
        };
        Relationships: [];
      };
      profiles_private: {
        Row: {
          user_id: string;
          upi_id: string | null;
          phone: string | null;
          gov_id_type: string | null;
          gov_id_doc_path: string | null;
          kyc_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          upi_id?: string | null;
          phone?: string | null;
          gov_id_type?: string | null;
          gov_id_doc_path?: string | null;
          kyc_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          upi_id?: string | null;
          phone?: string | null;
          gov_id_type?: string | null;
          gov_id_doc_path?: string | null;
          kyc_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      referral_codes: {
        Row: {
          id: string;
          code: string;
          kind: string;
          scope: string;
          scope_id: string | null;
          discount_kind: string;
          discount_value: number;
          max_uses: number | null;
          used_count: number;
          per_user_limit: number;
          valid_from: string | null;
          valid_to: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          kind?: string;
          scope?: string;
          scope_id?: string | null;
          discount_kind?: string;
          discount_value?: number;
          max_uses?: number | null;
          used_count?: number;
          per_user_limit?: number;
          valid_from?: string | null;
          valid_to?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          kind?: string;
          scope?: string;
          scope_id?: string | null;
          discount_kind?: string;
          discount_value?: number;
          max_uses?: number | null;
          used_count?: number;
          per_user_limit?: number;
          valid_from?: string | null;
          valid_to?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      referral_redemptions: {
        Row: {
          id: string;
          code_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          code_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          code_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      registrations: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          status: string;
          slot_held_until: string | null;
          form_data: Json;
          razorpay_order_id: string | null;
          ledger_entry_id: string | null;
          approved_by: string | null;
          created_at: string;
          updated_at: string;
          referral_code_id: string | null;
          discount_paise: number;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          status?: string;
          slot_held_until?: string | null;
          form_data?: Json;
          razorpay_order_id?: string | null;
          ledger_entry_id?: string | null;
          approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
          referral_code_id?: string | null;
          discount_paise?: number;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          status?: string;
          slot_held_until?: string | null;
          form_data?: Json;
          razorpay_order_id?: string | null;
          ledger_entry_id?: string | null;
          approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
          referral_code_id?: string | null;
          discount_paise?: number;
        };
        Relationships: [];
      };
      sponsors: {
        Row: {
          id: string;
          name: string;
          logo_path: string | null;
          website: string | null;
          details: string | null;
          community_id: string | null;
          published_by: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          logo_path?: string | null;
          website?: string | null;
          details?: string | null;
          community_id?: string | null;
          published_by?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          logo_path?: string | null;
          website?: string | null;
          details?: string | null;
          community_id?: string | null;
          published_by?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sponsorship_requests: {
        Row: {
          id: string;
          sponsor_name: string;
          contact_email: string;
          contact_phone: string | null;
          details: string | null;
          budget_paise: number | null;
          target_community_id: string | null;
          status: string;
          routed_to: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sponsor_name: string;
          contact_email: string;
          contact_phone?: string | null;
          details?: string | null;
          budget_paise?: number | null;
          target_community_id?: string | null;
          status?: string;
          routed_to?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sponsor_name?: string;
          contact_email?: string;
          contact_phone?: string | null;
          details?: string | null;
          budget_paise?: number | null;
          target_community_id?: string | null;
          status?: string;
          routed_to?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_cart_items: {
        Row: {
          id: string;
          cart_id: string;
          variant_id: string;
          qty: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          cart_id: string;
          variant_id: string;
          qty?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          cart_id?: string;
          variant_id?: string;
          qty?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      store_carts: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          parent_id: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          parent_id?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          parent_id?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      store_inventory: {
        Row: {
          id: string;
          variant_id: string;
          stock: number;
          low_stock_threshold: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          variant_id: string;
          stock?: number;
          low_stock_threshold?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          variant_id?: string;
          stock?: number;
          low_stock_threshold?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_order_items: {
        Row: {
          id: string;
          order_id: string;
          variant_id: string;
          qty: number;
          unit_price_paise: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          variant_id: string;
          qty: number;
          unit_price_paise: number;
        };
        Update: {
          id?: string;
          order_id?: string;
          variant_id?: string;
          qty?: number;
          unit_price_paise?: number;
        };
        Relationships: [];
      };
      store_orders: {
        Row: {
          id: string;
          user_id: string;
          status: string;
          delivery_status: string;
          total_paise: number;
          amount_paid_paise: number;
          is_partial: boolean;
          shipping_address: Json | null;
          created_at: string;
          updated_at: string;
          inventory_committed_at: string | null;
          referral_code_id: string | null;
          discount_paise: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: string;
          delivery_status?: string;
          total_paise: number;
          amount_paid_paise?: number;
          is_partial?: boolean;
          shipping_address?: Json | null;
          created_at?: string;
          updated_at?: string;
          inventory_committed_at?: string | null;
          referral_code_id?: string | null;
          discount_paise?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          status?: string;
          delivery_status?: string;
          total_paise?: number;
          amount_paid_paise?: number;
          is_partial?: boolean;
          shipping_address?: Json | null;
          created_at?: string;
          updated_at?: string;
          inventory_committed_at?: string | null;
          referral_code_id?: string | null;
          discount_paise?: number;
        };
        Relationships: [];
      };
      store_payment_schedule: {
        Row: {
          id: string;
          order_id: string;
          due_paise: number;
          due_at: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          due_paise: number;
          due_at?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          due_paise?: number;
          due_at?: string | null;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      store_payments: {
        Row: {
          id: string;
          order_id: string;
          schedule_id: string | null;
          razorpay_payment_id: string | null;
          amount_paise: number;
          status: string;
          ledger_entry_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          schedule_id?: string | null;
          razorpay_payment_id?: string | null;
          amount_paise: number;
          status?: string;
          ledger_entry_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          schedule_id?: string | null;
          razorpay_payment_id?: string | null;
          amount_paise?: number;
          status?: string;
          ledger_entry_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      store_product_images: {
        Row: {
          id: string;
          product_id: string;
          image_path: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          product_id: string;
          image_path: string;
          sort_order?: number;
        };
        Update: {
          id?: string;
          product_id?: string;
          image_path?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      store_products: {
        Row: {
          id: string;
          category_id: string | null;
          name: string;
          slug: string;
          description: string | null;
          mrp_paise: number;
          sale_price_paise: number;
          is_active: boolean;
          allow_partial: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          category_id?: string | null;
          name: string;
          slug: string;
          description?: string | null;
          mrp_paise?: number;
          sale_price_paise?: number;
          is_active?: boolean;
          allow_partial?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          category_id?: string | null;
          name?: string;
          slug?: string;
          description?: string | null;
          mrp_paise?: number;
          sale_price_paise?: number;
          is_active?: boolean;
          allow_partial?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      store_reviews: {
        Row: {
          id: string;
          product_id: string;
          user_id: string;
          rating: number;
          body: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          user_id: string;
          rating: number;
          body?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          user_id?: string;
          rating?: number;
          body?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      store_variants: {
        Row: {
          id: string;
          product_id: string;
          sku: string;
          name: string;
          price_paise: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          sku: string;
          name: string;
          price_paise: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          sku?: string;
          name?: string;
          price_paise?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: string;
          granted_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: string;
          granted_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: string;
          granted_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      webhook_events: {
        Row: {
          id: string;
          provider: string;
          razorpay_event_id: string | null;
          event_type: string | null;
          payload: Json;
          signature_valid: boolean;
          processing_status: string;
          error_detail: string | null;
          received_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          provider?: string;
          razorpay_event_id?: string | null;
          event_type?: string | null;
          payload: Json;
          signature_valid?: boolean;
          processing_status?: string;
          error_detail?: string | null;
          received_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          provider?: string;
          razorpay_event_id?: string | null;
          event_type?: string | null;
          payload?: Json;
          signature_valid?: boolean;
          processing_status?: string;
          error_detail?: string | null;
          received_at?: string;
          processed_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      public_events: {
        Row: {
          id: string | null;
          organizer_id: string | null;
          community_id: string | null;
          game_id: string | null;
          title: string | null;
          slug: string | null;
          banner_path: string | null;
          description: string | null;
          dos_and_donts: string | null;
          rules: string | null;
          registration_schema: Json | null;
          entry_fee_paise: number | null;
          max_slots: number | null;
          visibility: string | null;
          status: string | null;
          requires_approval: boolean | null;
          gov_id_required: boolean | null;
          room_released_at: string | null;
          registration_opens_at: string | null;
          registration_closes_at: string | null;
          starts_at: string | null;
          ends_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string | null;
          organizer_id?: string | null;
          community_id?: string | null;
          game_id?: string | null;
          title?: string | null;
          slug?: string | null;
          banner_path?: string | null;
          description?: string | null;
          dos_and_donts?: string | null;
          rules?: string | null;
          registration_schema?: Json | null;
          entry_fee_paise?: number | null;
          max_slots?: number | null;
          visibility?: string | null;
          status?: string | null;
          requires_approval?: boolean | null;
          gov_id_required?: boolean | null;
          room_released_at?: string | null;
          registration_opens_at?: string | null;
          registration_closes_at?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string | null;
          organizer_id?: string | null;
          community_id?: string | null;
          game_id?: string | null;
          title?: string | null;
          slug?: string | null;
          banner_path?: string | null;
          description?: string | null;
          dos_and_donts?: string | null;
          rules?: string | null;
          registration_schema?: Json | null;
          entry_fee_paise?: number | null;
          max_slots?: number | null;
          visibility?: string | null;
          status?: string | null;
          requires_approval?: boolean | null;
          gov_id_required?: boolean | null;
          room_released_at?: string | null;
          registration_opens_at?: string | null;
          registration_closes_at?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      citext: {
        Args: {
          [key: string]: never;
        };
        Returns: string;
      };
      citext_cmp: {
        Args: {
          [key: string]: never;
        };
        Returns: number;
      };
      citext_eq: {
        Args: {
          [key: string]: never;
        };
        Returns: boolean;
      };
      citext_ge: {
        Args: {
          [key: string]: never;
        };
        Returns: boolean;
      };
      citext_gt: {
        Args: {
          [key: string]: never;
        };
        Returns: boolean;
      };
      citext_hash: {
        Args: {
          [key: string]: never;
        };
        Returns: number;
      };
      citext_hash_extended: {
        Args: {
          [key: string]: never;
        };
        Returns: number;
      };
      citext_larger: {
        Args: {
          [key: string]: never;
        };
        Returns: string;
      };
      citext_le: {
        Args: {
          [key: string]: never;
        };
        Returns: boolean;
      };
      citext_lt: {
        Args: {
          [key: string]: never;
        };
        Returns: boolean;
      };
      citext_ne: {
        Args: {
          [key: string]: never;
        };
        Returns: boolean;
      };
      citext_pattern_cmp: {
        Args: {
          [key: string]: never;
        };
        Returns: number;
      };
      citext_pattern_ge: {
        Args: {
          [key: string]: never;
        };
        Returns: boolean;
      };
      citext_pattern_gt: {
        Args: {
          [key: string]: never;
        };
        Returns: boolean;
      };
      citext_pattern_le: {
        Args: {
          [key: string]: never;
        };
        Returns: boolean;
      };
      citext_pattern_lt: {
        Args: {
          [key: string]: never;
        };
        Returns: boolean;
      };
      citext_smaller: {
        Args: {
          [key: string]: never;
        };
        Returns: string;
      };
      citextin: {
        Args: {
          [key: string]: never;
        };
        Returns: string;
      };
      citextout: {
        Args: {
          [key: string]: never;
        };
        Returns: unknown;
      };
      citextrecv: {
        Args: {
          [key: string]: never;
        };
        Returns: string;
      };
      citextsend: {
        Args: {
          [key: string]: never;
        };
        Returns: string;
      };
      compute_profile_completion: {
        Args: {
          p_user_id: string;
        };
        Returns: number;
      };
      get_event_contact_phones: {
        Args: {
          p_event_id: string;
        };
        Returns: { user_id: string; phone: string }[];
      };
      get_payout_upi: {
        Args: {
          p_payout_id: string;
        };
        Returns: string;
      };
      get_room_credentials: {
        Args: {
          p_event_id: string;
        };
        Returns: { room_id: string; room_password: string; room_released_at: string }[];
      };
      has_role: {
        Args: {
          uid: string;
          role_name: string;
        };
        Returns: boolean;
      };
      is_channel_member: {
        Args: {
          p_channel_id: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      is_community_member: {
        Args: {
          p_community_id: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      is_event_participant: {
        Args: {
          p_event_id: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      is_organizer: {
        Args: {
          uid: string;
        };
        Returns: boolean;
      };
      is_superadmin: {
        Args: {
          uid: string;
        };
        Returns: boolean;
      };
      owns_community: {
        Args: {
          p_community_id: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      owns_event: {
        Args: {
          p_event_id: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      preview_code: {
        Args: {
          p_code: string;
          p_base_paise: number;
          p_scope?: string;
          p_scope_id?: string;
        };
        Returns: { discount_paise: number; code_id: string; reason: string }[];
      };
      recompute_player_stats: {
        Args: {
          p_user_id: string;
        };
        Returns: undefined;
      };
      redeem_code: {
        Args: {
          p_code: string;
          p_base_paise: number;
        };
        Returns: { discount_paise: number; code_id: string }[];
      };
      redeem_code_for_user: {
        Args: {
          p_code_id: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      refresh_leaderboard: {
        Args: {
          [key: string]: never;
        };
        Returns: undefined;
      };
      refresh_profile_completion: {
        Args: {
          p_user_id: string;
        };
        Returns: undefined;
      };
      regexp_match: {
        Args: {
          [key: string]: never;
        };
        Returns: string[];
      };
      regexp_matches: {
        Args: {
          [key: string]: never;
        };
        Returns: string[][];
      };
      regexp_replace: {
        Args: {
          [key: string]: never;
        };
        Returns: string;
      };
      regexp_split_to_array: {
        Args: {
          [key: string]: never;
        };
        Returns: string[];
      };
      regexp_split_to_table: {
        Args: {
          [key: string]: never;
        };
        Returns: string[];
      };
      replace: {
        Args: {
          [key: string]: never;
        };
        Returns: string;
      };
      reserve_slot: {
        Args: {
          p_event_id: string;
          p_form_data?: Json;
          p_ttl_seconds?: number;
        };
        Returns: string;
      };
      reveal_player_pii: {
        Args: {
          p_user_id: string;
          p_reason?: string;
        };
        Returns: { user_id: string; upi_id: string; phone: string; gov_id_type: string; kyc_status: string }[];
      };
      review_elite_application: {
        Args: {
          p_application_id: string;
          p_approve: boolean;
          p_review_note?: string;
        };
        Returns: string;
      };
      rls_auto_enable: {
        Args: {
          [key: string]: never;
        };
        Returns: unknown;
      };
      settle_event_split: {
        Args: {
          p_event_id: string;
          p_admin_cut_paise: number;
          p_organizer_profit_paise: number;
        };
        Returns: undefined;
      };
      settle_store_payment: {
        Args: {
          p_order_id: string;
          p_razorpay_payment_id: string;
          p_amount_paise: number;
          p_ledger_entry_id?: string;
          p_schedule_id?: string;
        };
        Returns: string;
      };
      split_part: {
        Args: {
          [key: string]: never;
        };
        Returns: string;
      };
      strpos: {
        Args: {
          [key: string]: never;
        };
        Returns: number;
      };
      sweep_expired_slots: {
        Args: {
          [key: string]: never;
        };
        Returns: number;
      };
      texticlike: {
        Args: {
          [key: string]: never;
        };
        Returns: boolean;
      };
      texticnlike: {
        Args: {
          [key: string]: never;
        };
        Returns: boolean;
      };
      texticregexeq: {
        Args: {
          [key: string]: never;
        };
        Returns: boolean;
      };
      texticregexne: {
        Args: {
          [key: string]: never;
        };
        Returns: boolean;
      };
      translate: {
        Args: {
          [key: string]: never;
        };
        Returns: string;
      };
      write_audit_log: {
        Args: {
          p_action: string;
          p_target_table?: string;
          p_target_id?: string;
          p_before?: Json;
          p_after?: Json;
          p_ip?: string;
        };
        Returns: string;
      };
      write_ledger_entry: {
        Args: {
          p_entry_type: string;
          p_source_type: string;
          p_direction: string;
          p_amount_paise: number;
          p_status?: string;
          p_currency?: string;
          p_user_id?: string;
          p_community_id?: string;
          p_event_id?: string;
          p_registration_id?: string;
          p_store_order_id?: string;
          p_membership_id?: string;
          p_sponsor_id?: string;
          p_organizer_id?: string;
          p_razorpay_payment_id?: string;
          p_related_entry_id?: string;
          p_fee_rate_applied_bps?: number;
          p_meta?: Json;
        };
        Returns: string;
      };
    };
    Enums: {
      [key: string]: never;
    };
    CompositeTypes: {
      [key: string]: never;
    };
  };
};
