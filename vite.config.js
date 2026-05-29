import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // 自动导入 Vue 相关函数 (如: ref, reactive)
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    // 自动导入 Element Plus 组件及样式
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
})
