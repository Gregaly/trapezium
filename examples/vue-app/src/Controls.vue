<script setup lang="ts">
/**
 * The switches above the table.
 *
 * Part of the example rather than the library: a table library has no business
 * shipping a settings panel. What it is for is trying the props without editing
 * code.
 */
defineProps<{
  segments: { label: string; value: string; options: { value: string; label: string }[] }[]
  switches: { label: string; value: boolean }[]
}>()

const emit = defineEmits<{
  segment: [label: string, value: string]
  switch: [label: string, value: boolean]
}>()
</script>

<template>
  <div class="controls">
    <div v-for="segment in segments" :key="segment.label" class="segmented">
      <span class="segmented-label">{{ segment.label }}</span>
      <div class="segmented-options" role="group" :aria-label="segment.label">
        <button
          v-for="option in segment.options"
          :key="option.value"
          type="button"
          :data-active="option.value === segment.value"
          :aria-pressed="option.value === segment.value"
          @click="emit('segment', segment.label, option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <label v-for="toggle in switches" :key="toggle.label" class="switch">
      <input
        type="checkbox"
        :checked="toggle.value"
        @change="emit('switch', toggle.label, ($event.target as HTMLInputElement).checked)"
      />
      <span class="switch-track" aria-hidden="true" />
      <span>{{ toggle.label }}</span>
    </label>
  </div>
</template>
