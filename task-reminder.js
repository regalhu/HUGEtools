(function () {
  function ready(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  ready(() => {
    if (!window.HugeToolsTaskStorage || !window.HugeToolsTaskScheduler || !window.HugeToolsTaskReminderUI) return;
    window.HugeToolsTaskReminderUI.init();
  });
})();
