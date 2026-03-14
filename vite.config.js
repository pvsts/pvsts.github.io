import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  
  // 强制使用相对路径，确保部署到 GitHub Pages 后路径正确
  base: './', 
  
  build: {
    // 确保打包产物存放文件夹
    outDir: 'dist',
    assetsDir: 'assets',
    
    // 强制缓存刷新策略：给文件名加上哈希值
    rollupOptions: {
      output: {
        // 这会让每次打包后的文件名都带一串随机字符（Hash），强制浏览器下载最新版而非读取旧缓存
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`,
      },
    },
  },
})