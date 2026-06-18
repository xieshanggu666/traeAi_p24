<template>
  <div 
    class="title-badge" 
    :class="[`rarity-${title?.rarity || 'common'}`, { 'title-badge-small': size === 'small', 'title-badge-large': size === 'large' }]"
    :style="badgeStyle"
  >
    <span class="title-icon" v-if="title?.icon">{{ title.icon }}</span>
    <span class="title-name">{{ title?.name || '暂无称号' }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  title: {
    type: Object,
    default: null
  },
  size: {
    type: String,
    default: 'medium'
  }
});

const badgeStyle = computed(() => {
  if (!props.title) return {};
  return {
    background: props.title.bg_gradient || props.title.bgGradient,
    color: '#ffffff',
    borderColor: props.title.color || 'transparent',
    textShadow: `0 1px 2px ${props.title.color || 'rgba(0,0,0,0.3)'}`
  };
});
</script>

<style scoped>
.title-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  border: 1.5px solid transparent;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
}

.title-badge::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  animation: shine 3s infinite;
}

@keyframes shine {
  0% { left: -100%; }
  50%, 100% { left: 100%; }
}

.title-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.title-name {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.title-badge-small {
  padding: 1px 8px;
  font-size: 10px;
  border-radius: 10px;
}

.title-badge-small .title-icon {
  font-size: 12px;
}

.title-badge-large {
  padding: 4px 14px;
  font-size: 14px;
  border-radius: 16px;
}

.title-badge-large .title-icon {
  font-size: 18px;
}

.rarity-legendary {
  box-shadow: 0 0 10px rgba(255, 215, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.15);
  animation: legendary-glow 2s ease-in-out infinite alternate;
}

@keyframes legendary-glow {
  from {
    box-shadow: 0 0 8px rgba(255, 215, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  to {
    box-shadow: 0 0 16px rgba(255, 215, 0, 0.7), 0 2px 12px rgba(0, 0, 0, 0.2);
  }
}

.rarity-epic {
  box-shadow: 0 0 8px rgba(114, 50, 221, 0.4), 0 2px 6px rgba(0, 0, 0, 0.12);
}

.rarity-rare {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.rarity-common {
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}
</style>
