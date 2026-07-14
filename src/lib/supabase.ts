import { createClient, type SupabaseClient } from "@supabase/supabase-js";

////////////////////////////////////////////////////
// 服务进程内复用一个 Supabase 客户端，避免每次 API 请求重复创建连接配置
////////////////////////////////////////////////////
let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) {
    return client;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error("Supabase 环境变量未配置");
  }

  ////////////////////////////////////////////////////
  // 应用只使用 Publishable Key 和受限 RPC，不创建用户会话，也不持久化认证状态
  ////////////////////////////////////////////////////
  client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
