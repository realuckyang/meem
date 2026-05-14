<template>
  <div class="space-y-2">
    <input
      v-model="form.title"
      type="text"
      placeholder="标题(必填,例:我的口味偏好)"
      class="w-full rounded border border-nt-divider bg-white px-2 py-1.5 text-sm text-nt outline-none focus:border-nt-accent"
    />
    <input
      v-model="form.description"
      type="text"
      placeholder="摘要(可选,一句话概括)"
      class="w-full rounded border border-nt-divider bg-white px-2 py-1.5 text-sm text-nt-muted outline-none focus:border-nt-accent"
    />
    <textarea
      v-model="form.content"
      rows="6"
      placeholder="内容(必填,助理会原文读到)"
      class="w-full resize-y rounded border border-nt-divider bg-white px-2 py-1.5 text-sm text-nt outline-none focus:border-nt-accent"
    ></textarea>
    <div class="flex items-center gap-3 pt-1 text-xs">
      <label class="inline-flex items-center gap-1 text-nt-soft">
        <input type="checkbox" v-model="form.enabled" class="accent-nt-accent" /> 启用
      </label>
      <label class="inline-flex items-center gap-1 text-nt-soft">
        <input type="checkbox" v-model="form.pinned" class="accent-nt-accent" /> 置顶
      </label>
      <button
        type="button"
        class="ml-auto rounded px-2 py-1 text-nt-soft hover:bg-nt-hover hover:text-nt"
        @click="$emit('cancel')"
      >取消</button>
      <button
        v-if="isEdit"
        type="button"
        class="rounded px-2 py-1 text-nt-danger hover:bg-nt-danger/10"
        @click="$emit('delete')"
      >删除</button>
      <button
        type="button"
        :disabled="!form.title.trim() || !form.content.trim()"
        class="rounded bg-nt px-3 py-1 text-white hover:bg-nt-strong disabled:opacity-50"
        @click="onSave"
      >保存</button>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Object, required: true },
  isEdit:     { type: Boolean, default: false },
})
const emit = defineEmits(['save', 'cancel', 'delete'])

const form = reactive({ ...props.modelValue })
watch(() => props.modelValue, (v) => Object.assign(form, v))

const onSave = () => {
  emit('save', {
    title:       form.title.trim(),
    description: form.description.trim(),
    content:     form.content.trim(),
    enabled:     !!form.enabled,
    pinned:      !!form.pinned,
  })
}
</script>
