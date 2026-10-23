<script setup>
import { ref, computed, onMounted } from 'vue'
import * as api from '../../../api'
import { current, currency, can, toast } from '../../../store'
import { money } from '../../../format'
import PageHeader from '../../../components/PageHeader.vue'
import Loader from '../../../components/Loader.vue'
import ErrorBox from '../../../components/ErrorBox.vue'
import Sheet from '../../../components/Sheet.vue'
import Icon from '../../../components/Icon.vue'

const ROOTS = [
  { key: 'Asset', label: 'What the group owns' },
  { key: 'Liability', label: 'What the group owes' },
  { key: 'Equity', label: 'The group’s own funds' },
  { key: 'Income', label: 'Income' },
  { key: 'Expense', label: 'Costs' },
]
const PURPOSES = {
  Asset: [['', 'Other asset'], ['Bank', 'Another bank account'], ['Cash', 'Cash']],
  Liability: [['', 'Other liability']],
  Equity: [['', 'Other fund']],
  Income: [['', 'Other income'], ['Fee Income', 'Fees']],
  Expense: [['Operating Expense', 'Running cost'], ['Bank Charges', 'Bank charges'], ['', 'Other cost']],
}
const accounts = ref(null)
const error = ref('')
const editing = ref(null)
const busy = ref(false)
const groups = computed(() => ROOTS.map((r) => ({ ...r, rows: (accounts.value || []).filter((a) => a.root_type === r.key) })))

async function load() {
  try { accounts.value = (await api.get('accounts.chart', { cooperative: current.value.cooperative })).accounts } catch (e) { error.value = e.message }
}
onMounted(load)

function add(root) { editing.value = { root_type: root, account_name: '', account_type: PURPOSES[root][0][0], description: '' } }
function edit(a) { editing.value = { ...a } }
async function save() {
  busy.value = true
  try {
    const e = editing.value
    await api.post('accounts.save_account', { cooperative: current.value.cooperative, name: e.name, account_name: e.account_name,
      root_type: e.root_type, account_type: e.account_type || null, description: e.description, disabled: e.disabled ? 1 : 0 })
    editing.value = null
    toast('Account saved')
    await load()
  } catch (err) { toast(err.message, 'error') } finally { busy.value = false }
}
</script>

<template>
  <div>
    <PageHeader title="Chart of accounts" :subtitle="current?.cooperative_name" back="/admin?tab=books" />
    <div class="space-y-5 px-5 pb-12 pt-1">
      <ErrorBox :message="error" />
      <Loader v-if="!accounts && !error" />
      <section v-for="g in accounts ? groups : []" :key="g.key">
        <div class="flex items-center justify-between px-1">
          <h2 class="text-sm font-semibold">{{ g.label }}</h2>
          <button v-if="can('close')" class="text-xs font-semibold link" @click="add(g.key)"><Icon name="plus" :size="14" /> Add</button>
        </div>
        <div class="card mt-2 divide-soft">
          <div v-for="a in g.rows" :key="a.name" class="flex items-center gap-3 px-4 py-3" :class="a.disabled ? 'opacity-50' : ''">
            <RouterLink :to="`/admin/books/ledger/${a.name}`" class="flex min-w-0 flex-1 items-center gap-3">
              <span class="num w-11 shrink-0 text-xs text-ink-faint">{{ a.account_code }}</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold">{{ a.account_name }}</span>
                <span v-if="a.is_system" class="block text-[11px] text-ink-faint">Used automatically</span>
              </span>
              <span class="num text-sm">{{ money(a.closing, currency) }}</span>
            </RouterLink>
            <button v-if="can('close')" class="grid h-8 w-8 place-items-center rounded-lg text-ink-faint hover:text-ink" :aria-label="`Edit ${a.account_name}`" @click="edit(a)"><Icon name="edit" :size="15" /></button>
          </div>
        </div>
      </section>
    </div>

    <Sheet :open="!!editing" :title="editing?.name ? 'Edit account' : 'New account'" :subtitle="editing?.is_system ? 'System accounts can be renamed. The app posts to them automatically.' : undefined" @close="editing = null">
      <form v-if="editing" class="space-y-4" @submit.prevent="save">
        <div><label class="label" for="a-name">Name</label><input id="a-name" v-model="editing.account_name" class="input" required placeholder="e.g. Hall rent" /></div>
        <div v-if="!editing.is_system && !editing.name">
          <label class="label" for="a-purpose">Kind</label>
          <select id="a-purpose" v-model="editing.account_type" class="input">
            <option v-for="p in PURPOSES[editing.root_type]" :key="p[1]" :value="p[0]">{{ p[1] }}</option>
          </select>
        </div>
        <div><label class="label" for="a-desc">Notes <span class="font-normal text-ink-faint">(optional)</span></label><input id="a-desc" v-model="editing.description" class="input" /></div>
        <label v-if="editing.name && !editing.is_system" class="flex items-center gap-3 text-sm"><input v-model="editing.disabled" type="checkbox" class="h-5 w-5" /> Disabled (no new entries)</label>
        <button class="btn-primary w-full" :disabled="busy">Save</button>
      </form>
    </Sheet>
  </div>
</template>
