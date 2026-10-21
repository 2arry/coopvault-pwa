<script setup>
defineProps({ title: String, subtitle: String })
</script>

<template>
  <div class="flex min-h-screen flex-col px-6 pt-safe">
    <div class="flex items-center justify-between pt-6">
      <RouterLink to="/" class="flex items-center gap-2.5" aria-label="Cooperative360 home">
        <img src="/logo.svg" alt="" class="h-10 w-10 rounded-xl shadow-sm" />
        <span class="font-display text-lg font-semibold tracking-tight">Cooperative360</span>
      </RouterLink>
      <slot name="corner" />
    </div>
    <div class="pb-7 pt-10">
      <slot name="banner" />
      <h1 class="font-display text-[32px] font-semibold leading-[1.1] tracking-tight">{{ title }}</h1>
      <p v-if="subtitle" class="mt-2.5 text-[15px] leading-relaxed text-ink-soft">{{ subtitle }}</p>
    </div>
    <slot />
    <div class="mt-auto py-8 text-center text-sm text-ink-soft"><slot name="footer" /></div>
  </div>
</template>
