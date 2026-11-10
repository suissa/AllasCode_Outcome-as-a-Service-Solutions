Promise.all([window.OQReady,window.OaaSPageReady]).then(()=>document.querySelectorAll('[data-mode]').forEach(card=>card.addEventListener('click',()=>OQ.setMode(card.dataset.mode,'mode-selected'))));
