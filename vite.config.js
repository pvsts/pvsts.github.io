import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  // 强制使用相对路径，这样无论部署在根目录还是子目录都能找到资源
  base: './', 
  build: {
    // 确保打包产物结构清晰
    outDir: 'dist',
    assetsDir: 'assets',
  }
})