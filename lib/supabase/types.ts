/**
 * Supabase database types.
 *
 * PLACEHOLDER until the schema is pushed to a real Supabase project, after
 * which we regenerate the real, fully-typed file with:
 *
 *   npx supabase gen types typescript --project-id <ref> > lib/supabase/types.ts
 *
 * Until then we use a permissive shape so query call-sites compile. The
 * generated file will replace this with exact row/insert/update types for every
 * table in supabase/migrations, at which point the compiler starts enforcing
 * column names and shapes for real.
 *
 * NOTE: this is intentionally loose (`any` row payloads). It is the ONE place
 * we accept `any`, and only because the source of truth is the SQL schema that
 * codegen will read. Do not pattern-match this looseness elsewhere.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type GenericTable = {
  Row: Record<string, any>;
  Insert: Record<string, any>;
  Update: Record<string, any>;
  Relationships: [];
};

type GenericFunction = {
  Args: Record<string, any>;
  Returns: any;
};

export type Database = {
  public: {
    Tables: {
      [table: string]: GenericTable;
    };
    Views: {
      [view: string]: GenericTable;
    };
    Functions: {
      [fn: string]: GenericFunction;
    };
    Enums: {
      [name: string]: string;
    };
    CompositeTypes: {
      [name: string]: Record<string, any>;
    };
  };
};
