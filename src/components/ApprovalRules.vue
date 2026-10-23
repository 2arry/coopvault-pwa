<script setup>
// "Who approves what": each action's rules, with stages and the roles that can approve each.
import { ref, computed, onMounted } from 'vue'
import * as api from '../api'
import { current, currency, toast } from '../store'
import { money } from '../format'
import Sheet from './Sheet.vue'
import Icon from './Icon.vue'

const LABELS = {
  'Member admission': 'New members',
  Loan: 'Loans',
  Withdrawal: 'Withdrawals',
  'Offline payment': 'Offline payments',
  'Manual journal': 'Journal entries',
  'Share-out': 'Year-end share-out',
}
const data = ref(null)
const editing = ref(null)
const busy = ref(false)
const byAction = computed(() => (data.value?.actions || []).map((action) => ({
  action,
  rules: data.value.rules.filter((r) => r.action === action).sort((a, b) => a.min_amount - b.min_amount),
})))

async function load() {
  try { data.value = await api.get('approvals.rules', { cooperative: current.value.cooperative }) } catch (e) { toast(e.message, 'error') }
}
onMounted(load)

function edit(rule, action) {
  editing.value = rule
    ? { name: rule.name, action: rule.action, min_amount: rule.min_amount, stages: rule.stages.map((s) => ({ label: s.label, roles: [...s.roles] })) }
    : { action, min_amount: '', stages: [{ label: 'Review', roles: ['Treasurer', 'Admin'] }, { label: 'Final approval', roles: ['Chairman', 'Admin'] }] }
}
function toggle(stage, role) {
  stage.roles = stage.roles.includes(role) ? stage.roles.filter((r) => r !== role) : [...stage.roles, role]
}
async function save() {
  busy.value = true
  try {
    const e = editing.value
    data.value = await api.post('approvals.save_rule', { cooperative: current.value.cooperative, name: e.name, action: e.action,
      min_amount: Number(e.min_amount) || 0, stages: e.stages })
    editing.value = null
    toast('Approval rule saved. New requests follow it.')
  } catch (err) { toast(err.message, 'error') } finally { busy.value = false }
}
async function remove() {
  busy.value = true
  try {
    data.value = await api.post('approvals.delete_rule', { name: editing.value.name })
    editing.value = null
    toast('Rule removed')
  } catch (err) { toast(err.message, 'error') } finally { busy.value = false }
}
</script>

<template>
  <section class="space-y-3">
    <h2 class="section-title">Who approves what</h2>
    <p class="text-sm text-ink-soft">Nobody approves their own request or anything that benefits them, or two stages of the same request. If nobody else holds a stage’s role, an admin covers it.</p>
    <div v-if="data" class="card divide-soft">
      <div v-for="g in byAction" :key="g.action" class="p-4">
        <div class="flex items-center justify-between">
          <p class="font-semibold">{{ LABELS[g.action] }}</p>
          <button type="button" class="inline-flex items-center gap-1 text-xs font-semibold link" @click="edit(null, g.action)"><Icon name="plus" :size="13" /> Bigger amounts</button>
        </div>
        <button v-for="r in g.rules" :key="r.name" type="button" class="mt-2 flex w-full items-start gap-3 rounded-2xl bg-sunk p-3 text-left text-sm" @click="edit(r)">
          <span class="flex-1">
            <span class="block text-xs text-ink-soft">{{ r.min_amount ? `From ${money(r.min_amount, currency)}` : 'Any amount' }}</span>
            <span v-for="(s, i) in r.stages" :key="i" class="block">{{ r.stages.length > 1 ? `${i + 1}. ` : '' }}{{ s.roles.join(' or ') }}</span>
          </span>
          <Icon name="edit" :size="15" class="mt-1 text-ink-faint" />
        </button>
      </div>
    </div>

    <Sheet :open="!!editing" :title="editing ? LABELS[editing.action] : ''" subtitle="Stages happen in order. Anyone with one of the ticked roles can approve a stage." @close="editing = null">
      <form v-if="editing" class="space-y-4" @submit.prevent="save">
        <div>
          <label class="label" for="r-min">Applies from</label>
          <input id="r-min" v-model="editing.min_amount" type="number" min="0" class="input" :disabled="editing.name && !editing.min_amount" placeholder="0 = any amount" />
          <p class="hint">Requests use the rule with the highest starting amount at or below theirs.</p>
        </div>
        <div v-for="(st, i) in editing.stages" :key="i" class="card space-y-3 p-3">
          <div class="flex items-center gap-2">
            <span class="grid h-6 w-6 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-text">{{ i + 1 }}</span>
            <input v-model="st.label" class="input flex-1 py-2 text-sm" placeholder="Stage name" />
            <button v-if="editing.stages.length > 1" type="button" class="grid h-8 w-8 place-items-center rounded-lg text-ink-faint hover:text-neg" aria-label="Remove stage" @click="editing.stages.splice(i, 1)"><Icon name="x" :size="15" /></button>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button v-for="role in data.roles" :key="role" type="button" class="rounded-full px-3 py-1 text-xs font-semibold"
              :class="st.roles.includes(role) ? 'bg-navy-800 text-white' : 'border border-line/12 text-ink-soft'" @click="toggle(st, role)">{{ role }}</button>
          </div>
        </div>
        <button v-if="editing.stages.length < 4" type="button" class="btn-secondary btn-sm w-full" @click="editing.stages.push({ label: '', roles: ['Chairman', 'Admin'] })"><Icon name="plus" :size="15" /> Add a stage</button>
        <button class="btn-primary w-full" :disabled="busy">Save rule</button>
        <button v-if="editing.name && editing.min_amount" type="button" class="btn-ghost w-full text-neg" :disabled="busy" @click="remove">Remove this rule</button>
      </form>
    </Sheet>
  </section>
</template>
