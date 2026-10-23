<script setup>
// The stages of an approval: who approved, when, and who it's waiting for now.
import { relative } from '../format'
import Icon from './Icon.vue'

defineProps({ approval: { type: Object, required: true }, compact: Boolean })
</script>

<template>
  <div>
    <ol class="space-y-0">
      <li v-for="(s, i) in approval.steps" :key="s.stage_no" class="relative flex gap-3 pb-4 last:pb-0">
        <span v-if="i < approval.steps.length - 1" class="absolute left-[11px] top-6 h-full w-0.5" :class="s.status === 'Approved' ? 'bg-pos/40' : 'bg-line/10'" />
        <span class="relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold"
          :class="s.status === 'Approved' ? 'bg-pos text-white' : s.status === 'Rejected' ? 'bg-neg text-white'
            : s.stage_no === approval.current_stage && approval.status === 'Pending' ? 'border-2 border-brand-text bg-card text-brand-text' : 'border-2 border-line/20 bg-card text-ink-soft'">
          <Icon v-if="s.status === 'Approved'" name="check" :size="13" :stroke="3" />
          <Icon v-else-if="s.status === 'Rejected'" name="x" :size="13" :stroke="3" />
          <template v-else>{{ s.stage_no }}</template>
        </span>
        <div class="min-w-0 flex-1 text-sm">
          <p class="font-semibold">{{ s.label }}</p>
          <p v-if="s.status === 'Approved' || s.status === 'Rejected'" class="text-xs text-ink-soft">
            {{ s.status === 'Approved' ? 'Approved' : 'Declined' }} by {{ s.decided_by_name }} · {{ relative(s.decided_on) }}<template v-if="s.fallback"> (covering as admin)</template>
          </p>
          <p v-else-if="s.stage_no === approval.current_stage && approval.status === 'Pending'" class="text-xs text-ink-soft">
            Waiting for: {{ s.roles }}<template v-if="s.fallback"> (no one else holds this role, so an admin covers it)</template>
          </p>
          <p v-else class="text-xs text-ink-faint">Then: {{ s.roles }}</p>
          <p v-if="s.note && !compact" class="mt-1 rounded-xl bg-sunk px-2.5 py-1.5 text-xs">“{{ s.note }}”</p>
        </div>
      </li>
    </ol>
    <p v-if="approval.stuck" class="mt-3 flex gap-2 rounded-2xl bg-warn-soft p-3 text-xs text-warn">
      <Icon name="alert" :size="14" class="mt-0.5 shrink-0" /> Nobody else can approve this yet. An admin can give another member an officer role (Treasurer, Chairman…) to take it on.
    </p>
  </div>
</template>
