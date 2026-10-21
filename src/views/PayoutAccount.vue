<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api'
import { state, toast } from '../store'
import PageHeader from '../components/PageHeader.vue'
import BankAccountForm from '../components/BankAccountForm.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Icon from '../components/Icon.vue'

const router = useRouter()
const busy = ref(false)
const error = ref('')
const p = state.user?.payout_account || {}
const initial = {
  bank_code: p.payout_bank_code, bank_name: p.payout_bank_name,
  account_number: p.payout_account_number, account_name: p.payout_account_name,
}

async function save(form) {
  busy.value = true
  error.value = ''
  try {
    state.user = await api.post('auth.set_payout_account', form)
    toast('Payout account saved')
    router.back()
  } catch (e) { error.value = e.message } finally { busy.value = false }
}
</script>

<template>
  <div>
    <PageHeader title="Payout account" back="/profile" />
    <div class="space-y-5 px-5 pb-12 pt-1">
      <div class="flex gap-3 rounded-3xl bg-sunk p-4 text-sm text-ink-soft">
        <Icon name="info" class="mt-0.5 text-ink" />
        <p>When the treasurer approves your loan, they send the money here. Use an account in your own name.</p>
      </div>
      <ErrorBox :message="error" />
      <BankAccountForm :initial="initial" :busy="busy" @submit="save" />
    </div>
  </div>
</template>
