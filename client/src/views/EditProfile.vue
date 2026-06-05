<template>
  <div class="edit-profile-page">
    <van-nav-bar
      title="编辑资料"
      left-arrow
      @click-left="goBack"
      fixed
      placeholder
    />

    <div class="form-section">
      <div class="avatar-section" @click="showAvatarPicker = true">
        <div class="avatar-label">头像</div>
        <div class="avatar-right">
          <AvatarDisplay :avatar="form.avatar" :size="50" />
          <van-icon name="arrow" color="#999" />
        </div>
      </div>

      <van-cell
        title="昵称"
        :value="form.nickname"
        is-link
        @click="openNicknameEditor"
      />

      <van-cell
        title="性别"
        :value="form.gender || '未设置'"
        is-link
        @click="showGenderPicker = true"
      />

      <van-cell
        title="出生年月"
        :value="form.birthday || '未设置'"
        is-link
        @click="showBirthdayPicker = true"
      />

      <van-cell
        title="年龄"
        :value="computedAge"
        is-link
        @click="showBirthdayPicker = true"
      />

      <van-cell
        title="个人介绍"
        :value="form.bio || '未设置'"
        is-link
        @click="openBioEditor"
      />
    </div>

    <div class="save-section">
      <van-button
        type="primary"
        block
        round
        :loading="saving"
        @click="handleSave"
      >
        保存修改
      </van-button>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/jpeg,image/png,image/gif,image/webp"
      style="display: none"
      @change="onFileSelected"
    />

    <van-popup
      v-model:show="showAvatarPicker"
      position="bottom"
      round
      :style="{ maxHeight: '70vh' }"
    >
      <div class="avatar-picker">
        <div class="avatar-picker-header">
          <span>选择头像</span>
          <van-icon name="cross" size="18" @click="showAvatarPicker = false" />
        </div>
        <div class="avatar-upload-btn" @click="triggerFileUpload">
          <van-icon name="photograph" size="24" />
          <span>上传本地图片</span>
        </div>
        <div class="avatar-grid">
          <div
            v-for="item in avatarList"
            :key="item"
            class="avatar-item"
            :class="{ active: form.avatar === item }"
            @click="selectAvatar(item)"
          >
            {{ item }}
          </div>
        </div>
      </div>
    </van-popup>

    <van-popup
      v-model:show="showNicknameEditor"
      position="bottom"
      round
    >
      <div class="editor-popup">
        <div class="editor-header">
          <span @click="showNicknameEditor = false">取消</span>
          <span class="editor-title">修改昵称</span>
          <span class="editor-confirm" @click="confirmNickname">确定</span>
        </div>
        <van-field
          v-model="tempNickname"
          placeholder="请输入昵称"
          maxlength="50"
          show-word-limit
          class="editor-field"
        />
      </div>
    </van-popup>

    <van-popup
      v-model:show="showGenderPicker"
      position="bottom"
      round
    >
      <van-picker
        :columns="genderColumns"
        @confirm="onGenderConfirm"
        @cancel="showGenderPicker = false"
      />
    </van-popup>

    <van-popup
      v-model:show="showBirthdayPicker"
      position="bottom"
      round
    >
      <van-date-picker
        v-model="tempBirthday"
        title="选择出生年月"
        :min-date="new Date(1900, 0, 1)"
        :max-date="new Date()"
        @confirm="onBirthdayConfirm"
        @cancel="showBirthdayPicker = false"
      />
    </van-popup>

    <van-popup
      v-model:show="showBioEditor"
      position="bottom"
      round
    >
      <div class="editor-popup">
        <div class="editor-header">
          <span @click="showBioEditor = false">取消</span>
          <span class="editor-title">个人介绍</span>
          <span class="editor-confirm" @click="confirmBio">确定</span>
        </div>
        <van-field
          v-model="tempBio"
          type="textarea"
          placeholder="介绍一下自己吧"
          maxlength="200"
          show-word-limit
          rows="4"
          class="editor-field"
        />
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { getUserInfo, updateProfile, uploadAvatar } from '../api';
import { getUser, setUser } from '../utils/storage';
import AvatarDisplay from '../components/AvatarDisplay.vue';

const router = useRouter();

const avatarList = [
  '🐱', '🐶', '🐼', '🦊', '🐰', '🐨', '🐯', '🦁', '🐮', '🐷',
  '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦄', '🐝', '🦋', '🐙',
  '🐳', '🐬', '🐠', '🐡', '🦀', '🐚', '🌙', '⭐', '🌈', '🌸',
  '🌺', '🌻', '🍀', '🎄', '🍁', '🌵', '🍄', '🦈', '🐪', '🦒'
];

const genderColumns = [
  { text: '未设置', value: '' },
  { text: '男', value: '男' },
  { text: '女', value: '女' },
  { text: '保密', value: '保密' }
];

const form = ref({
  nickname: '',
  avatar: '🐱',
  gender: '',
  birthday: '',
  bio: ''
});

const saving = ref(false);
const uploading = ref(false);
const showAvatarPicker = ref(false);
const showNicknameEditor = ref(false);
const showGenderPicker = ref(false);
const showBirthdayPicker = ref(false);
const showBioEditor = ref(false);

const tempNickname = ref('');
const tempBio = ref('');
const tempBirthday = ref(['2000', '01', '01']);
const fileInputRef = ref(null);

const computedAge = computed(() => {
  if (!form.value.birthday) return '未设置';
  const birthday = new Date(form.value.birthday);
  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();
  const monthDiff = today.getMonth() - birthday.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate())) {
    age--;
  }
  return age >= 0 ? `${age}岁` : '未设置';
});

onMounted(async () => {
  const localUser = getUser();
  if (localUser) {
    form.value.nickname = localUser.nickname || '';
    form.value.avatar = localUser.avatar || '🐱';
  }

  try {
    const userInfo = await getUserInfo();
    form.value.nickname = userInfo.nickname || '';
    form.value.avatar = userInfo.avatar || '🐱';
    form.value.gender = userInfo.gender || '';
    form.value.birthday = userInfo.birthday ? formatDate(userInfo.birthday) : '';
    form.value.bio = userInfo.bio || '';

    if (userInfo.birthday) {
      const d = new Date(userInfo.birthday);
      tempBirthday.value = [
        String(d.getFullYear()),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0')
      ];
    }
  } catch (error) {
    console.error('获取用户信息失败:', error);
  }
});

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function openNicknameEditor() {
  tempNickname.value = form.value.nickname;
  showNicknameEditor.value = true;
}

function openBioEditor() {
  tempBio.value = form.value.bio;
  showBioEditor.value = true;
}

function selectAvatar(item) {
  form.value.avatar = item;
  showAvatarPicker.value = false;
}

function triggerFileUpload() {
  fileInputRef.value?.click();
}

async function onFileSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    showToast('图片大小不能超过2MB');
    return;
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    showToast('只支持 JPG、PNG、GIF、WebP 格式');
    return;
  }

  uploading.value = true;
  try {
    const formData = new FormData();
    formData.append('avatar', file);
    const data = await uploadAvatar(formData);
    form.value.avatar = data.avatar;

    const localUser = getUser() || {};
    setUser({
      ...localUser,
      nickname: data.nickname,
      avatar: data.avatar
    });

    showToast(data._message || '操作成功');
    showAvatarPicker.value = false;
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '出现异常');
  } finally {
    uploading.value = false;
    if (fileInputRef.value) {
      fileInputRef.value.value = '';
    }
  }
}

function confirmNickname() {
  if (!tempNickname.value.trim()) {
    showToast('昵称不能为空');
    return;
  }
  form.value.nickname = tempNickname.value.trim();
  showNicknameEditor.value = false;
}

function onGenderConfirm({ selectedValues }) {
  form.value.gender = selectedValues[0] || '';
  showGenderPicker.value = false;
}

function onBirthdayConfirm({ selectedValues }) {
  form.value.birthday = selectedValues.join('-');
  showBirthdayPicker.value = false;
}

function confirmBio() {
  form.value.bio = tempBio.value.trim();
  showBioEditor.value = false;
}

async function handleSave() {
  if (!form.value.nickname.trim()) {
    showToast('昵称不能为空');
    return;
  }

  saving.value = true;
  try {
    const data = await updateProfile({
      nickname: form.value.nickname,
      avatar: form.value.avatar,
      gender: form.value.gender,
      birthday: form.value.birthday || null,
      bio: form.value.bio
    });

    const localUser = getUser() || {};
    setUser({
      ...localUser,
      nickname: data.nickname,
      avatar: data.avatar
    });

    showToast(data._message || '操作成功');
    router.back();
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '出现异常');
  } finally {
    saving.value = false;
  }
}

function goBack() {
  router.back();
}
</script>

<style scoped>
.edit-profile-page {
  min-height: 100vh;
  background: #f5f5f5;
}

.form-section {
  margin: 16px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.avatar-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  cursor: pointer;
  border-bottom: 1px solid #f5f5f5;
}

.avatar-section:active {
  background: #f9f9f9;
}

.avatar-label {
  font-size: 14px;
  color: #333;
}

.avatar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.save-section {
  margin: 32px 16px;
}

.avatar-picker {
  padding: 16px;
}

.avatar-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.avatar-upload-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  margin-bottom: 12px;
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  border-radius: 10px;
  color: #667eea;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.avatar-upload-btn:active {
  background: linear-gradient(135deg, #667eea25 0%, #764ba225 100%);
}

.avatar-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 8px;
}

.avatar-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  font-size: 28px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.avatar-item:active {
  transform: scale(0.9);
}

.avatar-item.active {
  border-color: #1989fa;
  background: #e8f4fd;
}

.editor-popup {
  padding: 16px;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  font-size: 14px;
  color: #666;
}

.editor-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.editor-confirm {
  color: #1989fa;
  font-weight: bold;
}

.editor-field {
  background: #f9f9f9;
  border-radius: 8px;
}

:deep(.van-cell__value) {
  color: #333;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.van-cell) {
  padding: 14px 16px;
}

:deep(.van-cell::after) {
  left: 16px;
  right: 16px;
}
</style>
