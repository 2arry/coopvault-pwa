<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api'
import { currency } from '../store'
import { money, date } from '../format'
import PageHeader from '../components/PageHeader.vue'
import PaymentForm from '../components/PaymentForm.vue'
import Loader from '../components/Loader.vue'
import ErrorBox from '../components/ErrorBox.vue'

const props = defineProps({ name: String })
const router = useRouter()
const loan = ref(null)
const error = ref('')
onMounted(async () => {
  try { loan.value = await api.get('finance.get_loan', { name: props.name }) } catch (e) { error.value = e.message }
})
</script>

<template>
  <div>
    <PageHeader title="Repay loan" :back="`/loans/${name}`" />
    <div class="px-5 pb-10 pt-2">
      <ErrorBox :message="error" />
      <Loader v-if="!loan && !error" />
      <template v-else-if="loan">
        <div class="card mb-5 flex items-center justify-between p-4">
          <div>
            <p class="text-sm text-ink-soft">Balance to pay back</p>
            <p class="num text-2xl font-extrabold">{{ money(loan.balance, currency) }}</p>
          </div>
          <p class="text-right text-xs text-ink-soft">Due<br /><b class="text-ink">{{ date(loan.due_date) }}</b></p>
        </div>
        <ErrorBox v-if="loan.status !== 'Active'" :message="`This loan is ${loan.status.toLowerCase()} and cannot be repaid.`" />
        <PaymentForm v-else purpose="Loan Repayment" :loan="loan.name" :max="loan.balance" :suggested="loan.balance"
          @done="router.replace(`/loans/${loan.name}`)" />
      </template>
    </div>
  </div>
</template>
