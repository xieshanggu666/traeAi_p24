<template>
  <span v-if="isImage" class="avatar-display avatar-image" :style="containerStyle">
    <img :src="avatar" alt="avatar" />
  </span>
  <span v-else class="avatar-display avatar-emoji" :style="containerStyle">{{ avatar || '🐱' }}</span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  avatar: { type: String, default: '' },
  size: { type: Number, default: 44 }
});

const isImage = computed(() => {
  return props.avatar && props.avatar.startsWith('/uploads/');
});

const containerStyle = computed(() => ({
  width: props.size + 'px',
  height: props.size + 'px',
  fontSize: Math.round(props.size * 0.6) + 'px'
}));
</script>

<style scoped>
.avatar-display {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  overflow: hidden;
}

.avatar-image {
  background: #f0f7ff;
}

.avatar-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}
</style>
