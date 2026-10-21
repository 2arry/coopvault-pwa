<script setup>
import { ref } from 'vue'
import { installEvent, isIOS, isStandalone, promptInstall } from '../install'
import Icon from '../components/Icon.vue'

const openFaq = ref(0)
const steps = [
  { title: 'Start your group', body: 'Set the contribution (say ₦10,000 a month), the loan interest and the longest repayment period. Then drop one invite link in your WhatsApp group.' },
  { title: 'Everyone saves', body: 'Members pay by card, bank transfer or USSD in a couple of taps, or transfer to their own account number. Every naira lands in one shared record.' },
  { title: 'Borrow fairly', body: 'Members borrow against what they have saved and pay back in monthly instalments. The treasurer approves, and everyone sees the pool.' },
]
const features = [
  { icon: 'checkCircle', title: 'Know where you stand', body: '“Paid up to December”, or exactly how much is due and by when. No more scrolling the group chat.' },
  { icon: 'zap', title: 'Pay in a tap', body: 'Card, transfer or USSD through Paystack. Confirmed instantly, with a receipt you can share in the group.' },
  { icon: 'repeat', title: 'Autosave', body: 'Save the card once and your contribution goes in automatically every month. Turn it off whenever you like.' },
  { icon: 'bank', title: 'Your own account number', body: 'Members can get a personal account number. Any transfer into it is added to their savings, with no form to fill.' },
  { icon: 'users', title: 'A treasurer’s best friend', body: 'See who has paid this month, confirm transfers with one tap, and send polite WhatsApp reminders.' },
  { icon: 'shield', title: 'Records you can trust', body: 'Confirmed payments can’t be quietly edited or deleted. Balances are rebuilt from every receipt.' },
]
const faqs = [
  { q: 'Who holds the money?', a: 'Your cooperative does. When the treasurer connects the group’s bank account, online payments settle straight into it through Paystack. CoopVault keeps the record; it never holds your savings.' },
  { q: 'Can someone borrow more than they’ve saved?', a: 'No. It’s built in: what you can borrow is what you’ve saved, minus what you still owe. Admins can make it stricter, never looser.' },
  { q: 'What about people who pay by transfer or cash?', a: 'They log it with a receipt and the treasurer confirms it with one tap. Members with their own CoopVault account number are recorded automatically.' },
  { q: 'What does it cost?', a: 'There’s no subscription. Online payments carry Paystack’s standard fee, and your group can choose to add it at checkout so savings stay whole. Transfers and cash cost nothing to record.' },
  { q: 'Do we need to download an app?', a: 'No. Open CoopVault in your phone’s browser and add it to your home screen. It works like an app on any Android phone or iPhone.' },
]
const install = () => promptInstall()
</script>

<template>
  <div class="bg-paper text-ink">
    <!-- Hero -->
    <section class="relative overflow-hidden bg-forest-900 text-forest-100">
      <svg class="pointer-events-none absolute -right-40 -top-40 h-[720px] w-[720px] text-coin-400/[0.07]" viewBox="0 0 200 200" aria-hidden="true">
        <circle v-for="r in [30, 46, 62, 78, 94]" :key="r" cx="100" cy="100" :r="r" fill="none" stroke="currentColor" stroke-width="0.6" />
      </svg>
      <div class="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-forest-950/40 to-transparent" />

      <nav class="relative mx-auto flex max-w-6xl items-center justify-between px-5 pt-safe md:px-8">
        <div class="flex items-center gap-2.5 py-5">
          <img src="/logo.svg" alt="" class="h-9 w-9 rounded-xl" />
          <span class="font-display text-xl font-semibold text-white">CoopVault</span>
        </div>
        <div class="flex items-center gap-2">
          <RouterLink to="/login" class="rounded-xl px-3.5 py-2 text-sm font-semibold text-forest-100 hover:bg-white/10">Log in</RouterLink>
          <RouterLink to="/signup" class="btn-gold btn-sm hidden sm:inline-flex">Get started</RouterLink>
        </div>
      </nav>

      <div class="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-6 md:grid-cols-[1.1fr_0.9fr] md:px-8 md:pb-28 md:pt-12">
        <div class="animate-rise">
          <p class="inline-flex items-center gap-2 rounded-full border border-coin-400/30 bg-coin-400/10 px-3 py-1 text-xs font-semibold text-coin-300">
            <Icon name="sparkle" :size="14" /> For ajo, esusu and cooperative savings groups
          </p>
          <h1 class="mt-6 font-display text-[44px] font-semibold leading-[1.02] tracking-tight text-white sm:text-[56px] md:text-[64px]">
            Your cooperative’s money, <span class="text-coin-400">out of the group chat.</span>
          </h1>
          <p class="mt-6 max-w-xl text-[17px] leading-relaxed text-forest-100/80">
            CoopVault keeps one shared record of every contribution, loan and repayment, so everyone can see who has paid,
            what they owe and what’s in the pool. No more “please post your receipt”.
          </p>
          <div class="mt-8 flex flex-col gap-3 sm:flex-row">
            <RouterLink to="/signup" class="btn-gold btn-lg">Start your cooperative <Icon name="arrowRight" :size="18" /></RouterLink>
            <RouterLink to="/signup?intent=join" class="btn btn-lg border border-white/20 text-white hover:bg-white/10">I have an invite code</RouterLink>
          </div>
          <ul class="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-forest-100/70">
            <li class="flex items-center gap-2"><Icon name="lock" :size="16" class="text-coin-400" /> Payments by Paystack</li>
            <li class="flex items-center gap-2"><Icon name="bank" :size="16" class="text-coin-400" /> Settles to your group’s own bank</li>
            <li class="flex items-center gap-2"><Icon name="phone" :size="16" class="text-coin-400" /> No app store needed</li>
          </ul>
        </div>

        <!-- Phone preview -->
        <div class="relative mx-auto w-full max-w-[340px] animate-rise [animation-delay:120ms]" aria-hidden="true">
          <div class="absolute -inset-10 rounded-full bg-coin-400/10 blur-3xl" />
          <div class="relative rounded-[44px] border border-white/10 bg-forest-950 p-3 shadow-2xl">
            <div class="overflow-hidden rounded-[34px] bg-[#f6f3eb] text-[#141f19]">
              <div class="flex justify-between px-6 pb-1 pt-3 text-[11px] font-semibold"><span>9:41</span><span>●●● ◔</span></div>
              <div class="px-4 pb-5">
                <p class="text-xs text-[#525f58]">Hello, Amaka</p>
                <p class="font-display text-lg font-semibold">Unity Savings Circle</p>
                <div class="relative mt-3 overflow-hidden rounded-[26px] bg-gradient-to-br from-forest-800 to-forest-700 p-4 text-white">
                  <svg class="absolute -right-10 -top-12 h-40 w-40 text-coin-400/20" viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" stroke-width="10" /></svg>
                  <p class="text-[11px] text-forest-100/80">Your savings</p>
                  <p class="money text-[34px] leading-tight">₦240,000</p>
                  <p class="mt-1 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-coin-300">✓ Paid up to December</p>
                  <div class="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div class="rounded-2xl bg-white/10 p-2.5"><p class="text-forest-100/70">You can borrow</p><p class="money text-base">₦180,000</p></div>
                    <div class="rounded-2xl bg-white/10 p-2.5"><p class="text-forest-100/70">You owe</p><p class="money text-base">₦60,000</p></div>
                  </div>
                </div>
                <div class="mt-3 rounded-[20px] bg-white p-3 text-[11px] shadow-sm">
                  <div class="flex items-center justify-between"><span class="font-semibold">Next loan payment</span><span class="text-[#525f58]">21 Nov</span></div>
                  <div class="mt-2 h-1.5 rounded-full bg-[#ece8de]"><div class="h-full w-2/3 rounded-full bg-forest-600" /></div>
                  <p class="mt-1.5 text-[#525f58]">₦20,000 of ₦60,000 left</p>
                </div>
                <div class="mt-3 space-y-2 rounded-[20px] bg-white p-3 text-[11px] shadow-sm">
                  <div class="flex items-center gap-2"><span class="grid h-7 w-7 place-items-center rounded-xl bg-[#ddf2e5] text-[#157d48]">↓</span><span class="flex-1"><b>Saved</b><br /><span class="text-[#525f58]">1 Nov · Autosave</span></span><b class="text-[#157d48]">+₦20,000</b></div>
                  <div class="flex items-center gap-2"><span class="grid h-7 w-7 place-items-center rounded-xl bg-[#e1eafe] text-[#2563eb]">✓</span><span class="flex-1"><b>Repaid loan</b><br /><span class="text-[#525f58]">21 Oct · Online</span></span><b>₦20,000</b></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Sound familiar -->
    <section class="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
      <div class="grid items-center gap-12 md:grid-cols-2">
        <div>
          <p class="section-title">Sound familiar?</p>
          <h2 class="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight md:text-5xl">The group chat was never meant to be a bank.</h2>
          <p class="mt-5 text-[17px] leading-relaxed text-ink-soft">Receipts get buried, the treasurer keeps a spreadsheet nobody else can see, and every loan request turns into a long discussion. CoopVault answers these questions before anyone has to ask.</p>
        </div>
        <div class="space-y-3">
          <div class="max-w-[85%] rounded-3xl rounded-bl-md bg-card px-4 py-3 shadow-soft"><p class="text-xs font-semibold text-brand-text">Treasurer</p><p>Please, who hasn’t paid for October? 🙏</p></div>
          <div class="ml-auto max-w-[85%] rounded-3xl rounded-br-md bg-brand-soft px-4 py-3"><p class="text-xs font-semibold text-pos">CoopVault</p><p><b>9 of 12 paid.</b> Tunde, Ify and Musa have been reminded on WhatsApp.</p></div>
          <div class="max-w-[85%] rounded-3xl rounded-bl-md bg-card px-4 py-3 shadow-soft"><p class="text-xs font-semibold text-gold-text">Chidi</p><p>I sent mine on Tuesday. Did it reach?</p></div>
          <div class="ml-auto max-w-[85%] rounded-3xl rounded-br-md bg-brand-soft px-4 py-3"><p class="text-xs font-semibold text-pos">CoopVault</p><p>Confirmed ₦10,000 on 14 Oct. <span class="underline decoration-dotted">Receipt</span></p></div>
          <div class="max-w-[85%] rounded-3xl rounded-bl-md bg-card px-4 py-3 shadow-soft"><p class="text-xs font-semibold text-info">Ngozi</p><p>How much can I borrow for school fees?</p></div>
          <div class="ml-auto max-w-[85%] rounded-3xl rounded-br-md bg-brand-soft px-4 py-3"><p class="text-xs font-semibold text-pos">CoopVault</p><p>Up to <b>₦85,000</b>, payable over 3 months.</p></div>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section class="border-y border-line/[0.07] bg-card">
      <div class="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-24">
        <p class="section-title">How it works</p>
        <h2 class="mt-3 max-w-2xl font-display text-4xl font-semibold leading-tight tracking-tight md:text-5xl">Running in ten minutes. Trusted for years.</h2>
        <ol class="mt-12 grid gap-8 md:grid-cols-3">
          <li v-for="(s, i) in steps" :key="s.title">
            <span class="money text-5xl text-gold">0{{ i + 1 }}</span>
            <h3 class="mt-3 text-lg font-bold">{{ s.title }}</h3>
            <p class="mt-2 leading-relaxed text-ink-soft">{{ s.body }}</p>
          </li>
        </ol>
      </div>
    </section>

    <!-- Features -->
    <section class="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
      <p class="section-title">Everything the group needs</p>
      <h2 class="mt-3 max-w-2xl font-display text-4xl font-semibold leading-tight tracking-tight md:text-5xl">Built for the way Nigerian savings groups actually work.</h2>
      <div class="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="f in features" :key="f.title" class="card p-6">
          <span class="grid h-11 w-11 place-items-center rounded-2xl bg-brand-soft text-brand-text"><Icon :name="f.icon" :size="22" /></span>
          <h3 class="mt-5 text-lg font-bold">{{ f.title }}</h3>
          <p class="mt-2 leading-relaxed text-ink-soft">{{ f.body }}</p>
        </div>
      </div>
    </section>

    <!-- Fair borrowing rule -->
    <section class="mx-auto max-w-6xl px-5 pb-20 md:px-8 md:pb-28">
      <div class="grid items-center gap-10 overflow-hidden rounded-[40px] bg-forest-800 p-8 text-forest-100 md:grid-cols-2 md:p-14">
        <div>
          <p class="text-[13px] font-semibold uppercase tracking-[0.1em] text-coin-400">The one rule everyone agrees on</p>
          <h2 class="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight text-white md:text-5xl">Nobody borrows more than they’ve saved.</h2>
          <p class="mt-5 text-[17px] leading-relaxed text-forest-100/80">CoopVault works out every member’s limit from their confirmed savings and what they still owe, and it checks that the pool has the cash before a loan is approved. Nobody has to have an awkward conversation.</p>
        </div>
        <div class="rounded-3xl bg-white/[0.06] p-6 ring-1 ring-white/10">
          <div class="flex items-baseline justify-between"><span class="text-forest-100/70">Saved</span><span class="money text-2xl text-white">₦240,000</span></div>
          <div class="mt-3 h-3 overflow-hidden rounded-full bg-white/10"><div class="h-full w-full rounded-full bg-forest-600" /></div>
          <div class="mt-6 flex items-baseline justify-between"><span class="text-forest-100/70">Still owing</span><span class="money text-2xl text-white">− ₦60,000</span></div>
          <div class="mt-3 h-3 overflow-hidden rounded-full bg-white/10"><div class="h-full w-1/4 rounded-full bg-coin-500/70" /></div>
          <div class="mt-6 border-t border-white/10 pt-6 flex items-baseline justify-between"><span class="font-semibold text-white">Can borrow</span><span class="money text-4xl text-coin-400">₦180,000</span></div>
        </div>
      </div>
    </section>

    <!-- Treasurers -->
    <section class="border-y border-line/[0.07] bg-card">
      <div class="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 md:grid-cols-2 md:px-8 md:py-24">
        <div class="order-2 md:order-1">
          <div class="card p-5">
            <div class="flex items-center justify-between">
              <p class="font-semibold">October contributions</p>
              <p class="text-sm text-ink-soft">₦90,000 of ₦120,000</p>
            </div>
            <div class="mt-3 h-2.5 overflow-hidden rounded-full bg-line/[0.07]"><div class="h-full w-3/4 rounded-full bg-brand" /></div>
            <div class="mt-4 divide-soft">
              <div v-for="p in [{ n: 'Tunde Bakare', s: 'Behind · ₦20,000', t: 'neg' }, { n: 'Ify Okeke', s: 'Due · ₦10,000', t: 'warn' }, { n: 'Amaka Eze', s: 'Paid up to Dec', t: 'pos' }]" :key="p.n" class="flex items-center gap-3 py-3">
                <span class="grid h-9 w-9 place-items-center rounded-full bg-sunk text-xs font-bold">{{ p.n.split(' ').map(x => x[0]).join('') }}</span>
                <span class="flex-1"><b class="text-sm">{{ p.n }}</b><br /><span class="text-xs" :class="`text-${p.t}`">{{ p.s }}</span></span>
                <span v-if="p.t !== 'pos'" class="chip bg-pos-soft text-pos"><Icon name="chat" :size="13" /> Remind</span>
              </div>
            </div>
          </div>
        </div>
        <div class="order-1 md:order-2">
          <p class="section-title">For treasurers and admins</p>
          <h2 class="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight md:text-5xl">Run the group in minutes, not evenings.</h2>
          <ul class="mt-6 space-y-3 text-[17px] text-ink-soft">
            <li class="flex gap-3"><Icon name="check" class="mt-1 text-pos" /> See who has paid this period and who is behind</li>
            <li class="flex gap-3"><Icon name="check" class="mt-1 text-pos" /> Confirm transfers against the receipt in one tap</li>
            <li class="flex gap-3"><Icon name="check" class="mt-1 text-pos" /> Approve loans knowing exactly where to send the money</li>
            <li class="flex gap-3"><Icon name="check" class="mt-1 text-pos" /> Send friendly WhatsApp reminders, one by one or to the whole group</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="mx-auto max-w-3xl px-5 py-20 md:px-8 md:py-28">
      <h2 class="text-center font-display text-4xl font-semibold tracking-tight md:text-5xl">Questions people ask</h2>
      <div class="mt-10 divide-soft card px-5">
        <div v-for="(f, i) in faqs" :key="f.q">
          <button class="flex w-full items-center justify-between gap-4 py-5 text-left text-[17px] font-semibold" :aria-expanded="openFaq === i" @click="openFaq = openFaq === i ? -1 : i">
            {{ f.q }}<Icon name="chevronDown" class="text-ink-faint transition" :class="openFaq === i ? 'rotate-180' : ''" />
          </button>
          <p v-show="openFaq === i" class="-mt-1 pb-5 leading-relaxed text-ink-soft">{{ f.a }}</p>
        </div>
      </div>
    </section>

    <!-- Final CTA -->
    <section class="px-5 pb-16 md:px-8">
      <div class="relative mx-auto max-w-6xl overflow-hidden rounded-[40px] bg-forest-900 px-6 py-16 text-center md:py-20">
        <svg class="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 text-coin-400/[0.06]" viewBox="0 0 200 200" aria-hidden="true">
          <circle v-for="r in [40, 60, 80, 98]" :key="r" cx="100" cy="100" :r="r" fill="none" stroke="currentColor" stroke-width="0.6" />
        </svg>
        <h2 class="relative mx-auto max-w-2xl font-display text-4xl font-semibold leading-tight tracking-tight text-white md:text-5xl">Bring your group’s savings into one place.</h2>
        <p class="relative mx-auto mt-4 max-w-xl text-forest-100/80">Free to start. Takes about ten minutes. Your members will thank you at the next meeting.</p>
        <div class="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <RouterLink to="/signup" class="btn-gold btn-lg">Start your cooperative</RouterLink>
          <button v-if="installEvent && !isStandalone" class="btn btn-lg border border-white/20 text-white hover:bg-white/10" @click="install"><Icon name="download" :size="18" /> Install the app</button>
          <p v-else-if="isIOS && !isStandalone" class="self-center text-sm text-forest-100/70">On iPhone: Share → Add to Home Screen</p>
        </div>
      </div>
    </section>

    <footer class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 pb-10 text-sm text-ink-soft sm:flex-row md:px-8">
      <div class="flex items-center gap-2"><img src="/logo.svg" alt="" class="h-6 w-6 rounded-md" /> CoopVault</div>
      <p>Payments secured by Paystack · © {{ new Date().getFullYear() }}</p>
    </footer>
  </div>
</template>
