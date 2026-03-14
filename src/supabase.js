import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 确保在没有 Key 的情况下不会执行 createClient
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

if (!supabase) {
  console.error("致命错误：Supabase 密钥未注入，请检查 GitHub Secrets！")
}
