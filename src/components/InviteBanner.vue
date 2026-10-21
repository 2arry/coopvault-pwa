<script setup>
// "You've been invited to join X": shown on sign-up / login / welcome when an invite code is pending.
import { ref, onMounted } from 'vue'
import * as api from '../api'
import { money, periodWord } from '../format'
import Icon from './Icon.vue'

const props = defineProps({ code: String })
const coop = ref(null)
const error = ref('')
onMounted(async () => {
  if (!props.code) return
  try { coop.value = await api.get('coop.preview_invite', { join_code: props.code }) } catch (e) { error.value = e.message }
})
</script>

<template>
  <div v-if="coop" class="mb-6 flex items-center gap-3.5 rounded-3xl bg-forest-800 p-4 text-forest-100">
    <div class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-coin-400 font-display text-xl font-semibold text-forest-950">{{ coop.cooperative_name[0] }}</div>
    <div class="min-w-0 text-sm">
      <p class="text-forest-100/70">You’re invited to join</p>
      <p class="truncate font-display text-lg font-semibold text-white">{{ coop.cooperative_name }}</p>
      <p class="text-forest-100/70">{{ coop.member_count }} member{{ coop.member_count === 1 ? '' : 's' }}<span v-if="coop.contribution_amount && coop.contribution_frequency !== 'Flexible'"> · {{ money(coop.contribution_amount, coop.currency) }} a {{ periodWord(coop.contribution_frequency) }}</span></p>
    </div>
  </div>
  <div v-else-if="error" class="mb-6 flex gap-2.5 rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn"><Icon name="info" :size="18" class="mt-0.5" />{{ error }}</div>
</template>
