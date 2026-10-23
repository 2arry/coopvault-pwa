<script setup>
// Savings products (Admins): regular contributions plus any voluntary savings the group offers.
import { ref, onMounted } from 'vue'
import * as api from '../api'
import { current, currency, toast, loadDashboard } from '../store'
import { money } from '../format'
import Sheet from './Sheet.vue'
import Icon from './Icon.vue'

const emit = defineEmits(['change'])
const products = ref([])
const editing = ref(null)
const busy = ref(false)
const blank = () => ({ product_name: '', description: '', enabled: 1, withdrawal_rule: 'Any time', counts_for_borrowing: 1 })

function apply(rows) {
  products.value = rows
  emit('change', rows)
}
async function load() {
  try { apply(await api.get('finance.admin_savings_products', { cooperative: current.value.cooperative })) } catch (e) { toast(e.message, 'error') }
}
onMounted(load)

async function save() {
  busy.value = true
  try {
    const { name, product_name, description, enabled, withdrawal_rule, counts_for_borrowing } = editing.value
    apply(await api.post('finance.save_savings_product', { cooperative: current.value.cooperative, name, product_name, description, enabled,
      withdrawal_rule, counts_for_borrowing }))
    editing.value = null
    loadDashboard().catch(() => {})
    toast('Savings product saved')
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
const regular = (p) => p.kind === 'Regular contributions'
const terms = (p) => [regular(p) ? 'The contribution plan above' : null,
  p.withdrawal_rule === 'Only when leaving' ? 'Withdrawn only on leaving' : 'Withdraw any time',
  p.counts_for_borrowing ? 'Counts for borrowing' : 'Doesn’t count for borrowing'].filter(Boolean).join(' · ')
</script>

<template>
  <section class="space-y-3">
    <div class="flex items-center justify-between">
      <h2 class="section-title">Savings products</h2>
      <button type="button" class="text-xs font-semibold link" @click="editing = blank()"><Icon name="plus" :size="13" /> New product</button>
    </div>
    <div class="card divide-soft">
      <button v-for="p in products" :key="p.name" type="button" class="flex w-full items-start gap-3 p-4 text-left" @click="editing = { ...p }">
        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-2 font-semibold">{{ p.product_name }}<span v-if="!p.enabled" class="rounded-md bg-sunk px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">Off</span></span>
          <span class="block text-xs text-ink-soft">{{ terms(p) }}</span>
          <span class="num block text-xs text-ink-faint">{{ money(p.total_held, currency) }} held · {{ p.savers }} member{{ p.savers === 1 ? '' : 's' }}</span>
        </span>
        <Icon name="edit" :size="15" class="mt-1 text-ink-faint" />
      </button>
    </div>
    <p class="hint">Each product has its own account in the books. Voluntary savings don’t count towards the contribution plan.</p>

    <Sheet :open="!!editing" :title="editing?.name ? editing.product_name : 'New savings product'"
      :subtitle="editing && regular(editing) ? 'The regular contributions everyone makes. It can be renamed but not switched off.' : 'Extra savings members can choose, like a Christmas fund or school fees.'" @close="editing = null">
      <form v-if="editing" class="space-y-4" @submit.prevent="save">
        <div><label class="label" for="sp-name">Name</label><input id="sp-name" v-model="editing.product_name" class="input" required placeholder="e.g. Christmas savings" /></div>
        <div><label class="label" for="sp-desc">What it’s for <span class="font-normal text-ink-faint">(members see this)</span></label><input id="sp-desc" v-model="editing.description" class="input" /></div>
        <div>
          <span class="label">When can members take it out?</span>
          <div class="seg grid-cols-2 text-[13px]">
            <button type="button" :class="{ on: editing.withdrawal_rule === 'Any time' }" @click="editing.withdrawal_rule = 'Any time'">Any time</button>
            <button type="button" :class="{ on: editing.withdrawal_rule === 'Only when leaving' }" @click="editing.withdrawal_rule = 'Only when leaving'">Only when leaving</button>
          </div>
          <p class="hint">{{ editing.withdrawal_rule === 'Any time' ? 'Withdrawals still go through the group’s approval.' : 'Paid out with everything else when a member leaves the group.' }}</p>
        </div>
        <label class="flex items-start gap-3 text-sm"><input v-model="editing.counts_for_borrowing" type="checkbox" :true-value="1" :false-value="0" class="mt-0.5 h-5 w-5" />
          <span>Counts towards what members can borrow<span class="block text-xs text-ink-soft">It also backs their loans and the guarantees they give.</span></span></label>
        <label v-if="!regular(editing)" class="flex items-center gap-3 text-sm"><input v-model="editing.enabled" type="checkbox" :true-value="1" :false-value="0" class="h-5 w-5" /> Members can save into it</label>
        <button class="btn-primary w-full" :disabled="busy">Save savings product</button>
      </form>
    </Sheet>
  </section>
</template>
