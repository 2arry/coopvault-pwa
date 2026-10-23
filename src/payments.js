// Paystack checkout inside the app (InlineJS v2): the server initialises the transaction and
// returns an access code; the popup collects payment; we then ask the server to verify it.
import * as api from './api'

let popupPromise
function loadPopup() {
  popupPromise ||= import('@paystack/inline-js').then((m) => new m.default())
  return popupPromise
}

// Group payments by default; a Cooperative360 subscription uses its own endpoints
const GROUP = { initialize: 'payments.initialize', verify: 'payments.verify', abandon: 'payments.mark_abandoned' }
export const SUBSCRIPTION = { initialize: 'subscription.pay', verify: 'subscription.verify', abandon: 'subscription.mark_abandoned' }

/**
 * Opens checkout and resolves with the verified transaction summary, or null if the member
 * closed the popup. Falls back to Paystack's hosted page if the popup can't load.
 */
export async function payWithPaystack(payload, { onOpen, endpoints = GROUP } = {}) {
  const init = await api.post(endpoints.initialize, payload)
  let popup
  try {
    popup = await loadPopup()
  } catch {
    window.location.href = init.authorization_url
    return new Promise(() => {})
  }
  return new Promise((resolve, reject) => {
    popup.resumeTransaction(init.access_code, {
      onLoad: () => onOpen?.(),
      onSuccess: async () => {
        try {
          resolve(await api.post(endpoints.verify, { reference: init.reference }))
        } catch (e) {
          reject(e)
        }
      },
      onCancel: () => {
        api.post(endpoints.abandon, { reference: init.reference }).catch(() => {})
        resolve(null)
      },
      onError: () => {
        // Popup blocked or failed to load: continue on Paystack's own page instead
        window.location.href = init.authorization_url
      },
    })
  })
}

/** Where to send the member after a successful payment. */
export function receiptPath(tx) {
  if (tx?.document_type && tx?.document) {
    return `/receipt/${encodeURIComponent(tx.document_type)}/${encodeURIComponent(tx.document)}?new=1`
  }
  return tx?.loan ? `/loans/${tx.loan}` : '/home'
}
