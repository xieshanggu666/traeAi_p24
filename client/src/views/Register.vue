<template>
  <div class="register-page">
    <div class="register-bg"></div>
    <div class="register-content">
      <div class="register-header">
        <van-icon name="arrow-left" size="24" color="#fff" @click="goBack" />
        <h1 class="title">注册账号</h1>
        <div style="width: 24px;"></div>
      </div>

      <div class="register-form">
        <div class="form-tip">
          <span class="tip-icon">💡</span>
          <span class="tip-text">注册后将自动生成匿名昵称和头像</span>
        </div>

        <div class="form-item">
          <van-field
            v-model="username"
            label="用户名"
            placeholder="3-20个字符"
            :border="false"
            clearable
            left-icon="user-o"
            maxlength="20"
          />
        </div>
        <div class="form-item">
          <van-field
            v-model="password"
            type="password"
            label="密码"
            placeholder="至少6位"
            :border="false"
            clearable
            left-icon="lock"
          />
        </div>
        <div class="form-item">
          <van-field
            v-model="confirmPassword"
            type="password"
            label="确认密码"
            placeholder="再次输入密码"
            :border="false"
            clearable
            left-icon="lock"
          />
        </div>

        <van-button
          type="primary"
          block
          size="large"
          class="register-btn"
          :disabled="!canRegister || isRegistering"
          :loading="isRegistering"
          loading-text="注册中..."
          @click="handleRegister"
        >
          注册
        </van-button>

        <div class="register-footer">
          <span>已有账号？</span>
          <span class="login-link" @click="goToLogin">立即登录</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { register } from '../api';
import { setToken, setUser } from '../utils/storage';

const router = useRouter();
const username = ref('');
const password = ref('');
const confirmPassword = ref('');
const isRegistering = ref(false);

const canRegister = computed(() => {
  return (
    username.value.trim().length >= 3 &&
    password.value.length >= 6 &&
    confirmPassword.value === password.value
  );
});

async function handleRegister() {
  if (username.value.trim().length < 3) {
    showToast('用户名至少3个字符');
    return;
  }
  if (password.value.length < 6) {
    showToast('密码至少6位');
    return;
  }
  if (password.value !== confirmPassword.value) {
    showToast('两次密码输入不一致');
    return;
  }

  isRegistering.value = true;

  try {
    const result = await register(username.value.trim(), password.value);
    setToken(result.token);
    setUser(result.user);
    showToast(result._message || '操作成功');
    router.replace('/');
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '出现异常');
  } finally {
    isRegistering.value = false;
  }
}

function goBack() {
  router.back();
}

function goToLogin() {
  router.push('/login');
}
</script>

<style scoped>
.register-page {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
}

.register-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.register-content {
  position: relative;
  z-index: 1;
  padding: 20px 20px 30px;
}

.register-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.title {
  color: #fff;
  font-size: 24px;
  font-weight: bold;
}

.register-form {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  padding: 30px 20px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.form-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f0f7ff;
  padding: 12px 16px;
  border-radius: 10px;
  margin-bottom: 25px;
}

.tip-icon {
  font-size: 18px;
}

.tip-text {
  font-size: 13px;
  color: #667eea;
}

.form-item {
  border-bottom: 1px solid #eee;
  margin-bottom: 10px;
}

.form-item:last-of-type {
  border-bottom: none;
  margin-bottom: 30px;
}

.register-btn {
  border-radius: 25px;
  height: 50px;
  font-size: 17px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
}

.register-btn:disabled {
  background: #ccc;
}

.register-footer {
  text-align: center;
  margin-top: 25px;
  font-size: 14px;
  color: #666;
}

.login-link {
  color: #667eea;
  font-weight: bold;
  margin-left: 5px;
  cursor: pointer;
}
</style>
