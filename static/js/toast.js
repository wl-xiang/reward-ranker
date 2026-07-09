/* ============================================================
   toast.js - 轻量 Toast 提示（顶部下滑式，不阻塞操作）
   暴露：window.Toast
   ============================================================ */
(function (global) {
  "use strict";

  var container = null;
  var queue = [];
  var active = 0;
  var MAX = 3;
  var DURATION = 2000;

  function init() {
    if (!container) {
      container = document.getElementById("toastContainer");
    }
  }

  function show(message, type) {
    init();
    if (!container) return;
    var item = { message: message, type: type || "info" };
    queue.push(item);
    pump();
  }

  function pump() {
    if (!container) return;
    while (active < MAX && queue.length > 0) {
      var item = queue.shift();
      render(item);
    }
  }

  function render(item) {
    var el = document.createElement("div");
    el.className = "toast" + (item.type ? " " + item.type : "");
    el.textContent = item.message;
    container.appendChild(el);
    active++;
    setTimeout(function () {
      el.classList.add("leaving");
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        active--;
        pump();
      }, 250);
    }, DURATION);
  }

  global.Toast = {
    info: function (m) { show(m, "info"); },
    success: function (m) { show(m, "success"); },
    error: function (m) { show(m, "error"); }
  };
})(window);
