/* ============================================================
   drag.js - 拖拽排序交互（兼容 PC 鼠标 + 移动端触屏）
   暴露：window.Drag.init(container, opts)

   opts:
     selector     可拖拽项选择器
     handleSelector 拖拽手柄选择器（命中后才触发）
     onReorder    (fromIndex, toIndex) => void  完成重排回调
   ============================================================ */
(function (global) {
  "use strict";

  var LONG_PRESS = 150;   // 触屏长按触发毫秒
  var THRESHOLD = 6;      // 移动阈值，超过才进入拖拽

  function init(container, opts) {
    opts = opts || {};
    var selector = opts.selector || ".drag-item";
    var handleSelector = opts.handleSelector || ".drag-handle";

    var state = {
      dragging: false,
      pointerId: null,
      item: null,           // 原始 DOM 项
      ghost: null,          // 跟随手指的克隆
      placeholder: null,    // 占位符
      fromIndex: -1,
      targetIndex: -1,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0,
      timer: null,
      isTouch: false
    };

    container.addEventListener("pointerdown", function (e) {
      var handle = e.target.closest(handleSelector);
      if (!handle) return;
      var item = e.target.closest(selector);
      if (!item || !container.contains(item)) return;

      // 仅主键 / 触屏
      if (e.pointerType === "mouse" && e.button !== 0) return;

      state.pointerId = e.pointerId;
      state.item = item;
      state.startX = e.clientX;
      state.startY = e.clientY;
      state.isTouch = e.pointerType === "touch";
      state.fromIndex = indexOf(container, item, selector);
      state.targetIndex = state.fromIndex;

      // 计算手柄内偏移，使克隆体贴合抓取位置
      var rect = item.getBoundingClientRect();
      state.offsetX = e.clientX - rect.left;
      state.offsetY = e.clientY - rect.top;

      // 触屏：长按触发；鼠标：移动阈值触发
      if (state.isTouch) {
        state.timer = setTimeout(function () {
          state.timer = null;
          if (!state.dragging) beginDrag(e);
        }, LONG_PRESS);
        container.setPointerCapture(e.pointerId);
      } else {
        try { container.setPointerCapture(e.pointerId); } catch (_) {}
      }
      e.preventDefault();
    });

    container.addEventListener("pointermove", function (e) {
      if (state.pointerId !== e.pointerId) return;

      if (!state.dragging) {
        // 未进入拖拽：判断是否越过阈值（鼠标）/长按已过（触屏由 timer 触发）
        var dx = e.clientX - state.startX;
        var dy = e.clientY - state.startY;
        if (Math.abs(dx) > THRESHOLD || Math.abs(dy) > THRESHOLD) {
          if (state.isTouch) {
            // 触屏移动即取消长按定时器，避免误触发
            if (state.timer) { clearTimeout(state.timer); state.timer = null; }
            beginDrag(e);
          } else {
            beginDrag(e);
          }
        }
        return;
      }

      // 移动 ghost
      moveGhost(e.clientX, e.clientY);
      // 检测目标
      var target = findTarget(e.clientY);
      updatePlaceholder(target);
      e.preventDefault();
    });

    function end(e) {
      if (state.pointerId !== e.pointerId) return;
      if (state.timer) { clearTimeout(state.timer); state.timer = null; }

      if (state.dragging) {
        var toIndex = state.targetIndex;
        var fromIndex = state.fromIndex;
        cleanup();
        if (toIndex !== -1 && toIndex !== fromIndex && typeof opts.onReorder === "function") {
          opts.onReorder(fromIndex, toIndex);
        }
      } else {
        // 未进入拖拽，视为普通点击，不处理
        cleanup();
      }
      try { container.releasePointerCapture(e.pointerId); } catch (_) {}
    }

    container.addEventListener("pointerup", end);
    container.addEventListener("pointercancel", end);

    function beginDrag(e) {
      if (state.dragging || !state.item) return;
      state.dragging = true;

      var item = state.item;
      var rect = item.getBoundingClientRect();

      // 克隆体
      var ghost = item.cloneNode(true);
      ghost.classList.add("drag-ghost");
      ghost.style.width = rect.width + "px";
      ghost.style.left = (e.clientX - state.offsetX) + "px";
      ghost.style.top = (e.clientY - state.offsetY) + "px";
      document.body.appendChild(ghost);
      state.ghost = ghost;

      // 占位符
      var placeholder = document.createElement("div");
      placeholder.className = "drag-placeholder";
      placeholder.style.width = rect.width + "px";
      state.placeholder = placeholder;
      item.parentNode.insertBefore(placeholder, item);

      item.classList.add("is-dragging");
      state.targetIndex = state.fromIndex;
    }

    function moveGhost(x, y) {
      if (state.ghost) {
        state.ghost.style.left = (x - state.offsetX) + "px";
        state.ghost.style.top = (y - state.offsetY) + "px";
      }
    }

    function findTarget(y) {
      var items = container.querySelectorAll(selector);
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it === state.item) continue;
        var r = it.getBoundingClientRect();
        var mid = r.top + r.height / 2;
        if (y < mid) return it;
      }
      return null; // 放到最后
    }

    function updatePlaceholder(target) {
      var items = container.querySelectorAll(selector);
      var placeholder = state.placeholder;
      if (!placeholder) return;

      if (target) {
        if (target.previousElementSibling !== placeholder) {
          target.parentNode.insertBefore(placeholder, target);
        }
        state.targetIndex = indexOf(container, target, selector);
        if (state.targetIndex > state.fromIndex) state.targetIndex -= 0; // 保留原值
      } else {
        // 放到末尾
        var last = items[items.length - 1];
        if (last && last !== placeholder) {
          if (last.nextSibling) {
            last.parentNode.insertBefore(placeholder, last.nextSibling);
          } else {
            last.parentNode.appendChild(placeholder);
          }
        }
        state.targetIndex = items.length - 1;
      }

      // 修正：from 在 target 之后时，索引需 +1（因为移除 from 后目标下标变化）
      // 这里直接计算 placeholder 当前在容器中的位置
      state.targetIndex = placeholderIndex(container, selector);
    }

    function cleanup() {
      if (state.timer) { clearTimeout(state.timer); state.timer = null; }
      if (state.ghost && state.ghost.parentNode) state.ghost.parentNode.removeChild(state.ghost);
      if (state.placeholder && state.placeholder.parentNode) state.placeholder.parentNode.removeChild(state.placeholder);
      if (state.item) state.item.classList.remove("is-dragging");
      state.ghost = null;
      state.placeholder = null;
      state.item = null;
      state.dragging = false;
      state.pointerId = null;
      state.fromIndex = -1;
      state.targetIndex = -1;
    }
  }

  function indexOf(container, item, selector) {
    var nodes = container.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i] === item) return i;
    }
    return -1;
  }

  function placeholderIndex(container, selector) {
    // 统计 placeholder 之前的同选择器项数量 + 占位符位置
    var nodes = container.querySelectorAll(selector + ", .drag-placeholder");
    var count = 0;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].classList.contains("drag-placeholder")) return count;
      count++;
    }
    return count;
  }

  global.Drag = { init: init };
})(window);
