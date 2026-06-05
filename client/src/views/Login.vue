<template>
  <div class="login-page">
    <div class="login-bg"></div>
    <div class="login-content">
      <div class="login-header">
        <div class="logo">🍾</div>
        <h1 class="title">漂流瓶</h1>
        <p class="subtitle">将心事放入瓶中，与陌生人相遇</p>
      </div>

      <div class="login-form">
        <div class="form-item">
          <van-field
            v-model="username"
            label="用户名"
            placeholder="请输入用户名"
            :border="false"
            clearable
            left-icon="user-o"
          />
        </div>
        <div class="form-item">
          <van-field
            v-model="password"
            type="password"
            label="密码"
            placeholder="请输入密码"
            :border="false"
            clearable
            left-icon="lock"
          />
        </div>

        <van-button
          type="primary"
          block
          size="large"
          class="login-btn"
          :disabled="!canLogin || isLogging"
          :loading="isLogging"
          loading-text="登录中..."
          @click="handleLogin"
        >
          登录
        </van-button>

        <div class="login-footer">
          <span>还没有账号？</span>
          <span class="register-link" @click="goToRegister">立即注册</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { login } from '../api';
import { setToken, setUser } from '../utils/storage';

const router = useRouter();
const username = ref('');
const password = ref('');
const isLogging = ref(false);

const canLogin = computed(() => {
  return username.value.trim().length > 0 && password.value.length > 0;
});

async function handleLogin() {
  if (!canLogin.value) {
    showToast('请输入用户名和密码');
    return;
  }

  isLogging.value = true;

  try {
    const result = await login(username.value.trim(), password.value);
    setToken(result.token);
    setUser(result.user);
    showToast(result._message || '操作成功');
    router.replace('/');
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '出现异常');
  } finally {
    isLogging.value = false;
  }
}

function goToRegister() {
  router.push('/register');
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
}

.login-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-bg::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 300px;
  background: linear-gradient(180deg, transparent 0%, rgba(255, 255, 255, 0.1) 100%);
}

.login-content {
  position: relative;
  z-index: 1;
  padding: 60px 30px 30px;
}

.login-header {
  text-align: center;
  margin-bottom: 50px;
}

.logo {
  font-size: 80px;
  margin-bottom: 20px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0) rotate(-5deg);
  }
  50% {
    transform: translateY(-15px) rotate(5deg);
  }
}

.title {
  color: #fff;
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 10px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
}

.subtitle {
  color: rgba(255, 255, 255, 0.85);
  font-size: 14px;
}

.login-form {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  padding: 30px 20px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.form-item {
  border-bottom: 1px solid #eee;
  margin-bottom: 10px;
}

.form-item:last-of-type {
  border-bottom: none;
  margin-bottom: 30px;
}

.login-btn {
  border-radius: 25px;
  height: 50px;
  font-size: 17px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
}

.login-btn:disabled {
  background: #ccc;
}

.login-footer {
  text-align: center;
  margin-top: 25px;
  font-size: 14px;
  color: #666;
}

.register-link {
  color: #667eea;
  font-weight: bold;
  margin-left: 5px;
  cursor: pointer;
}
</style>
