<script setup>
import { useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import PaymentForm from '../components/PaymentForm.vue'

const router = useRouter()
</script>

<template>
  <div>
    <PageHeader title="Make a contribution" back="/" />
    <div class="px-5 pb-10 pt-2"><PaymentForm purpose="Contribution" @done="router.replace('/history')" /></div>
  </div>
</template>
