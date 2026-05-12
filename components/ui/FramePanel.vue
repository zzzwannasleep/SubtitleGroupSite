<script setup lang="ts">
import { cn } from '~/utils/cn'

const props = withDefaults(
  defineProps<{
    as?: string
    tone?: 'default' | 'muted' | 'accent'
  }>(),
  {
    as: 'section',
    tone: 'default',
  },
)

const attrs = useAttrs()

const toneClasses = {
  default: 'bg-[color:var(--sgs-panel)]',
  muted: 'bg-[color:var(--sgs-canvas)]',
  accent: 'bg-[color:var(--sgs-accent-soft)]',
}
</script>

<template>
  <component
    :is="props.as"
    v-bind="attrs"
    :class="cn('section-frame', toneClasses[props.tone], attrs.class as string)"
  >
    <div class="inner-frame h-full p-5 md:p-6">
      <slot />
    </div>
  </component>
</template>

