import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { Toast, Dialog } from 'vant';
import 'vant/lib/index.css';
import './assets/global.css';

const app = createApp(App);
app.use(router);
app.use(Toast);
app.use(Dialog);
app.mount('#app');
