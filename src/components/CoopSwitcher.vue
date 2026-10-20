<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { state, current, selectCooperative } from '../store'
import Sheet from './Sheet.vue'
import Icon from './Icon.vue'
import StatusPill from './StatusPill.vue'

const open = ref(false)
const router = useRouter()
function choose(m) {
  selectCooperative(m.cooperative)
  open.value = false
  router.replace('/')
}
</script>

<template>
  <button class="flex min-w-0 items-center gap-1 text-left" @click="open = true">
    <span class="truncate text-lg font-bold">{{ current?.cooperative_name }}</span>
    <Icon name="chevronDown" :size="18" class="shrink-0 text-ink-soft" />
  </button>
  <Sheet :open="open" title="Your cooperatives" @close="open = false">
    <div class="space-y-2">
      <button v-for="m in state.memberships" :key="m.name" class="flex w-full items-center gap-3 rounded-xl border p-3 text-left"
        :class="m.cooperative === current?.cooperative ? 'border-brand-700 bg-brand-50' : 'border-black/10'" @click="choose(m)">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-800 font-bold text-white">{{ m.cooperative_name[0] }}</div>
        <div class="min-w-0 flex-1">
          <p class="truncate font-semibold">{{ m.cooperative_name }}</p>
          <p class="text-xs text-ink-soft">{{ m.role }} · {{ m.member_count || 0 }} members</p>
        </div>
        <StatusPill v-if="m.status !== 'Active'" :status="m.status" />
      </button>
    </div>
    <RouterLink to="/welcome" class="btn-secondary mt-4 w-full" @click="open = false"><Icon name="plus" /> Join or create another</RouterLink>
  </Sheet>
</template>
