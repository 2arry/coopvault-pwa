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
  router.replace('/home')
}
</script>

<template>
  <button class="flex min-w-0 items-center gap-1 text-left" :aria-label="`Switch cooperative (current: ${current?.cooperative_name})`" @click="open = true">
    <span class="truncate font-display text-[22px] font-semibold tracking-tight">{{ current?.cooperative_name }}</span>
    <Icon name="chevronDown" :size="18" class="text-ink-soft" />
  </button>
  <Sheet :open="open" title="Your cooperatives" @close="open = false">
    <div class="space-y-2">
      <button v-for="m in state.memberships" :key="m.name" class="flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition"
        :class="m.cooperative === current?.cooperative ? 'border-brand-text/40 bg-brand-soft' : 'border-line/10 hover:bg-sunk'" @click="choose(m)">
        <div class="grid h-11 w-11 place-items-center rounded-2xl bg-navy-800 font-display text-lg font-semibold text-glow-300">{{ m.cooperative_name[0] }}</div>
        <div class="min-w-0 flex-1">
          <p class="truncate font-semibold">{{ m.cooperative_name }}</p>
          <p class="text-xs text-ink-soft">{{ m.role }} · {{ m.member_count || 0 }} members</p>
        </div>
        <StatusPill v-if="m.status !== 'Active'" :status="m.status" />
        <Icon v-else-if="m.cooperative === current?.cooperative" name="check" class="text-brand-text" />
      </button>
    </div>
    <RouterLink to="/welcome" class="btn-secondary mt-4 w-full" @click="open = false"><Icon name="plus" /> Join or start another</RouterLink>
  </Sheet>
</template>
