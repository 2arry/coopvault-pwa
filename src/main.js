import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'

// Keep the install prompt event until the InstallPrompt component is mounted
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  window.__coopInstallEvent = e
})

createApp(App).use(router).mount('#app')
