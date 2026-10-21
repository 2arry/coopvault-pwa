import { createApp } from 'vue'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/fraunces/opsz.css'
import App from './App.vue'
import router from './router'
import './style.css'

// Keep the install prompt event until an install button is shown
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  window.__coopInstallEvent = e
  window.dispatchEvent(new Event('coopvault:installable'))
})

createApp(App).use(router).mount('#app')
