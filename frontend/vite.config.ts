import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  resolve: {
    // Monaco 0.57 收紧了 package exports；y-monaco 仍引用旧的深层入口。
    alias: {
      'monaco-editor/esm/vs/editor/editor.api.js': 'monaco-editor',
    },
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rolldownOptions: {
      output: {
        // 手动分包策略
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // 把 monaco-editor 单独拆成一个包
            if (id.includes('monaco-editor')) {
              return 'monaco-vendor';
            }
            // 把 react 和 react-dom 单独拆成一个包
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            // 其他的第三方依赖放一起
            return 'vendor';
          }
        }
      }
    }
  }
})
