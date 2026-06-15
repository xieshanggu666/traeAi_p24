import { createRouter, createWebHashHistory } from 'vue-router';
import { getToken } from '../utils/storage';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { title: '登录', requiresAuth: false }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/Register.vue'),
    meta: { title: '注册', requiresAuth: false }
  },
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: { title: '漂流瓶', requiresAuth: true }
  },
  {
    path: '/throw',
    name: 'Throw',
    component: () => import('../views/Throw.vue'),
    meta: { title: '扔瓶子', requiresAuth: true }
  },
  {
    path: '/pick',
    name: 'Pick',
    component: () => import('../views/Pick.vue'),
    meta: { title: '捞瓶子', requiresAuth: true }
  },
  {
    path: '/messages',
    name: 'Messages',
    component: () => import('../views/Messages.vue'),
    meta: { title: '消息', requiresAuth: true }
  },
  {
    path: '/chat/:bottleId',
    name: 'Chat',
    component: () => import('../views/Chat.vue'),
    meta: { title: '聊天', requiresAuth: true }
  },
  {
    path: '/my',
    name: 'My',
    component: () => import('../views/My.vue'),
    meta: { title: '我的瓶子', requiresAuth: true }
  },
  {
    path: '/edit-profile',
    name: 'EditProfile',
    component: () => import('../views/EditProfile.vue'),
    meta: { title: '编辑资料', requiresAuth: true }
  },
  {
    path: '/welfare',
    name: 'Welfare',
    component: () => import('../views/Welfare.vue'),
    meta: { title: '福利', requiresAuth: true }
  },
  {
    path: '/shop',
    name: 'Shop',
    component: () => import('../views/Shop.vue'),
    meta: { title: '商城', requiresAuth: true }
  },
  {
    path: '/backpack',
    name: 'Backpack',
    component: () => import('../views/Backpack.vue'),
    meta: { title: '我的背包', requiresAuth: true }
  },
  {
    path: '/gifts',
    name: 'Gifts',
    component: () => import('../views/Gifts.vue'),
    meta: { title: '我的礼物', requiresAuth: true }
  },
  {
    path: '/friends',
    name: 'Friends',
    component: () => import('../views/Friends.vue'),
    meta: { title: '好友', requiresAuth: true }
  },
  {
    path: '/blacklist',
    name: 'Blacklist',
    component: () => import('../views/Blacklist.vue'),
    meta: { title: '黑名单', requiresAuth: true }
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

router.beforeEach((to, from, next) => {
  document.title = to.meta.title || '漂流瓶';
  
  const token = getToken();
  const requiresAuth = to.meta.requiresAuth;
  
  if (requiresAuth && !token) {
    next('/login');
  } else if ((to.path === '/login' || to.path === '/register') && token) {
    next('/');
  } else {
    next();
  }
});

export default router;
