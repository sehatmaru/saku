import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function createRouteSupabaseClient(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Layanan akun belum siap.");
  }

  const authorization = request.headers.get("authorization");

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: authorization ? { Authorization: authorization } : {}
    }
  });
}

export async function getRouteUser(request: NextRequest) {
  let client: ReturnType<typeof createRouteSupabaseClient>;

  try {
    client = createRouteSupabaseClient(request);
  } catch (error) {
    return {
      client: null,
      user: null,
      error: error instanceof Error ? error.message : "Layanan akun belum siap."
    };
  }

  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    return { client, user: null, error: "Silakan login ulang." };
  }

  return { client, user: data.user, error: null };
}
