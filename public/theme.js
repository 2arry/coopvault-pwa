try { var t = localStorage.getItem('coopvault.theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t } catch (e) {}
