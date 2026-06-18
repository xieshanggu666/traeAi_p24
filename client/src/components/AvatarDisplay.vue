<template>
  <span
    class="avatar-display-wrapper"
    :style="wrapperStyle"
  >
    <span v-if="isImage" class="avatar-display avatar-image" :style="containerStyle">
      <img :src="avatar" alt="avatar" />
    </span>
    <span v-else class="avatar-display avatar-emoji" :style="containerStyle">{{ avatar || '🐱' }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  avatar: { type: String, default: '' },
  size: { type: Number, default: 44 },
  avatarFrame: { type: Object, default: null }
});

const isImage = computed(() => {
  return props.avatar && props.avatar.startsWith('/uploads/');
});

const hasFrame = computed(() => {
  return props.avatarFrame && props.avatarFrame.id;
});

const containerStyle = computed(() => ({
  width: props.size + 'px',
  height: props.size + 'px',
  fontSize: Math.round(props.size * 0.6) + 'px'
}));

const wrapperStyle = computed(() => {
  if (!hasFrame.value) {
    return {};
  }
  const frame = props.avatarFrame;
  const borderWidth = Math.max(2, Math.round(props.size * 0.08));
  return {
    padding: borderWidth + 'px',
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${frame.gradient_from || frame.border_color} 0%, ${frame.gradient_to || frame.border_color} 100%)`,
    boxShadow: `0 0 ${Math.round(props.size * 0.15)}px ${frame.shadow_color || frame.border_color}60`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  };
});
</script>

<style scoped>
.avatar-display-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

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
