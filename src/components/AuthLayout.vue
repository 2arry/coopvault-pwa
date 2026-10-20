<script setup>
defineProps({ title: String, subtitle: String })
</script>

<template>
  <div class="flex min-h-screen flex-col px-6 pt-safe">
    <div class="pt-14 pb-8">
      <img src="/logo.svg" alt="CoopVault" class="h-14 w-14 rounded-2xl shadow-sm" />
      <h1 class="mt-6 text-[28px] font-extrabold leading-tight tracking-tight">{{ title }}</h1>
      <p v-if="subtitle" class="mt-2 text-ink-soft">{{ subtitle }}</p>
    </div>
    <slot />
    <div class="mt-auto py-8 text-center text-sm text-ink-soft"><slot name="footer" /></div>
  </div>
</template>
