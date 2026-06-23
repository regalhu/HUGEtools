(function () {
  function ready(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  ready(() => {
    if (window.HugeToolsIncentiveEngine && window.HugeToolsIncentiveUI) {
      window.HugeToolsIncentiveUI.init();
    }
  });
})();
