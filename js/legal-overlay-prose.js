(function (w) {
  'use strict';
  var HREF = '/css/legal-overlay-prose.css?v=20260513c';
  var PROSE_IDS = ['legal-condiciones', 'legal-privacidad', 'legal-aviso', 'legal-cookies'];
  var FAQ_IDS = ['legal-faq'];
  var PICKUP_IDS = ['airport-pickups'];

  function css() {
    try {
      if (document.querySelector('link[href*="legal-overlay-prose.css"]')) return;
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = HREF;
      document.head.appendChild(l);
    } catch (_) {}
  }

  function setMode(overlayEl, innerEl, targetId) {
    try {
      css();
      var tid = targetId ? String(targetId) : '';
      var prose = tid && PROSE_IDS.indexOf(tid) !== -1;
      var faq = tid && FAQ_IDS.indexOf(tid) !== -1;
      var pickup = tid && PICKUP_IDS.indexOf(tid) !== -1;
      innerEl.classList.toggle('tc-legal-prose', prose);
      innerEl.classList.toggle('tc-legal-faq', faq);
      innerEl.classList.toggle('tc-legal-pickups', pickup);
      overlayEl.classList.toggle('tc-legal-prose-mode', prose);
      overlayEl.classList.toggle('tc-legal-faq-mode', faq);
      overlayEl.classList.toggle('tc-legal-pickups-mode', pickup);
    } catch (_) {}
  }

  function clearMode(overlayEl, innerEl) {
    try {
      innerEl.classList.remove('tc-legal-prose', 'tc-legal-faq', 'tc-legal-pickups');
      overlayEl.classList.remove('tc-legal-prose-mode', 'tc-legal-faq-mode', 'tc-legal-pickups-mode');
    } catch (_) {}
  }

  w.__tcLegalOverlayProse = { css: css, setMode: setMode, clearMode: clearMode };
})(typeof window !== 'undefined' ? window : globalThis);
