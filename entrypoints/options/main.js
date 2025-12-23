import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { createI18nInstance } from '../../utils/i18n';

import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';

import './style.less';

// 异步初始化应用
async function initApp() {
  const i18n = await createI18nInstance();
  const app = createApp(App);
  app.use(router);
  app.use(ElementPlus);
  app.use(i18n);
  app.mount('#app');
}

initApp();
