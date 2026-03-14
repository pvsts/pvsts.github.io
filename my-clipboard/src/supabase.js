import { createClient } from '@supabase/supabase-js'

// 注意：变量名必须以 VITE_ 开头，且在根目录的 .env 文件中定义
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 简单的防御性检查
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("错误：Supabase 环境变量未加载！请检查根目录下的 .env 文件。")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)