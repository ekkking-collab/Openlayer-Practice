import { createApp } from 'vue'
import App from './App.vue'
import 'ol/ol.css'
import './style.css'

// 1. 引入 Element Plus 及其全局 CSS 样式
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

const app = createApp(App)

// 2. 注册 Element Plus
app.use(ElementPlus)

app.mount('#app')
