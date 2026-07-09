/* ============================================================
   app.js - 应用入口与模块协调
   依赖：Toast, Store, Ranking, Drag, Render
   ============================================================ */
(function () {
  "use strict";

  var state = {
    awards: [],
    players: [],
    results: null,
    sortMode: "rank"
  };

  /* ---------- 初始化 ---------- */
  function init() {
    loadFromStore();
    Render.renderAwards(state.awards);
    Render.renderPlayers(state.players);
    Render.renderResult(state.results, state.sortMode);
    bindHeader();
    bindTabs();
    bindAwards();
    bindPlayers();
    bindResult();
    initDrag();
  }

  function loadFromStore() {
    state.awards = Store.getAwards();
    state.players = Store.getPlayers();
    // 结果不持久化，每次刷新重新计算
    if (state.players.length && state.awards.length) {
      state.results = Ranking.compute(state.players, state.awards);
    } else {
      state.results = null;
    }
  }

  function persistAwards() {
    if (!Store.setAwards(state.awards)) {
      Toast.error("本地存储写入失败");
    }
    // 奖项变更后重新计算结果
    if (state.players.length) {
      state.results = Ranking.compute(state.players, state.awards);
      Render.renderResult(state.results, state.sortMode);
    }
  }

  function persistPlayers() {
    if (!Store.setPlayers(state.players)) {
      Toast.error("本地存储写入失败");
    }
    if (state.awards.length) {
      state.results = Ranking.compute(state.players, state.awards);
      Render.renderResult(state.results, state.sortMode);
    }
  }

  /* ---------- 顶部导航 ---------- */
  function bindHeader() {
    document.getElementById("newRankBtn").addEventListener("click", function () {
      openModal("新建排名", "将清空当前所有奖项配置与选手成绩，且不可撤销，确认继续？", function () {
        Store.clearAll();
        state.awards = [];
        state.players = [];
        state.results = null;
        Render.renderAwards(state.awards);
        Render.renderPlayers(state.players);
        Render.renderResult(null, state.sortMode);
        switchTab("awards");
        Toast.success("已开启新排名");
      });
    });
  }

  /* ---------- 标签切换 ---------- */
  function bindTabs() {
    var tabs = document.querySelectorAll(".tab");
    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        switchTab(t.dataset.tab);
      });
    });
    document.getElementById("gotoPlayersBtn").addEventListener("click", function () {
      if (!validateAwards()) return;
      switchTab("players");
    });
    document.getElementById("gotoPlayersFromResult").addEventListener("click", function () {
      switchTab("players");
    });
  }

  function switchTab(name) {
    document.querySelectorAll(".tab").forEach(function (t) {
      var on = t.dataset.tab === name;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    document.querySelectorAll(".tab-panel").forEach(function (p) {
      p.classList.toggle("active", p.id === "tab-" + name);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- 奖项配置 ---------- */
  function bindAwards() {
    var list = document.getElementById("awardList");

    document.getElementById("addAwardBtn").addEventListener("click", function () {
      if (!validateAwards(true)) return; // 校验现有未填完整的奖项
      state.awards.push({ id: Store.uid(), name: "", quota: 1 });
      persistAwards();
      Render.renderAwards(state.awards);
      // 聚焦新项名称输入框
      var inputs = list.querySelectorAll(".input-name");
      if (inputs.length) inputs[inputs.length - 1].focus();
    });

    // 输入与删除（事件委托）
    list.addEventListener("input", function (e) {
      var t = e.target;
      if (!t.classList.contains("input")) return;
      var li = t.closest(".award-card");
      if (!li) return;
      var id = li.dataset.id;
      var idx = findIdx(state.awards, id);
      if (idx === -1) return;
      if (t.dataset.field === "name") {
        state.awards[idx].name = t.value;
      } else if (t.dataset.field === "quota") {
        // 允许临时空值，校验时再处理
        state.awards[idx].quota = t.value;
      }
      Store.setAwards(state.awards);
      // 名额变更影响结果，但避免每次输入重渲染导致输入框失焦
      if (state.players.length && state.awards.length) {
        state.results = Ranking.compute(state.players, state.awards);
        Render.renderResult(state.results, state.sortMode);
      }
    });

    list.addEventListener("click", function (e) {
      var btn = e.target.closest('[data-act="del"]');
      if (!btn) return;
      var li = btn.closest(".award-card");
      var id = li.dataset.id;
      var idx = findIdx(state.awards, id);
      if (idx === -1) return;
      var name = state.awards[idx].name || ("第 " + (idx + 1) + " 个奖项");
      openModal("删除奖项", "确认删除「" + name + "」？该操作不可撤销。", function () {
        state.awards.splice(idx, 1);
        persistAwards();
        Render.renderAwards(state.awards);
        Toast.success("已删除奖项");
      });
    });
  }

  function validateAardsSilent() {
    return validateAwards(true);
  }

  function validateAwards(silent) {
    for (var i = 0; i < state.awards.length; i++) {
      var a = state.awards[i];
      var name = (a.name || "").trim();
      if (!name) {
        if (!silent) Toast.error("第 " + (i + 1) + " 个奖项名称不能为空");
        return false;
      }
      var q = parseInt(a.quota, 10);
      if (isNaN(q) || q <= 0) {
        if (!silent) Toast.error("第 " + (i + 1) + " 个奖项名额必须为正整数");
        return false;
      }
    }
    return true;
  }

  /* ---------- 成绩录入 ---------- */
  function bindPlayers() {
    var form = document.getElementById("playerForm");
    var nameInput = document.getElementById("playerName");
    var scoreInput = document.getElementById("playerScore");
    var list = document.getElementById("playerList");

    // 聚焦时上推防遮挡
    [nameInput, scoreInput].forEach(function (el) {
      el.addEventListener("focus", function () {
        setTimeout(function () { el.scrollIntoView({ block: "center", behavior: "smooth" }); }, 240);
      });
    });

    // 回车快捷：姓名→分数→提交
    nameInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); scoreInput.focus(); }
    });
    scoreInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); form.requestSubmit(); }
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = nameInput.value.trim();
      var scoreRaw = scoreInput.value.trim();
      if (!name) { Toast.error("请输入选手姓名"); nameInput.focus(); return; }
      var score = Number(scoreRaw);
      if (scoreRaw === "" || isNaN(score)) {
        Toast.error("分数格式不正确");
        scoreInput.focus();
        return;
      }
      if (score < 0) { Toast.error("分数不能为负数"); scoreInput.focus(); return; }
      state.players.push({ id: Store.uid(), name: name, score: score });
      persistPlayers();
      Render.renderPlayers(state.players);
      nameInput.value = "";
      scoreInput.value = "";
      nameInput.focus();
      Toast.success("已添加 " + name);
    });

    // 编辑 / 删除
    list.addEventListener("click", function (e) {
      var li = e.target.closest(".player-row");
      if (!li) return;
      var id = li.dataset.id;
      var idx = findIdx(state.players, id);
      if (idx === -1) return;

      var editBtn = e.target.closest('[data-act="edit"]');
      var delBtn = e.target.closest('[data-act="del"]');
      if (editBtn) {
        toggleEdit(li, idx);
      } else if (delBtn) {
        var name = state.players[idx].name;
        openModal("删除选手", "确认删除选手「" + name + "」？", function () {
          state.players.splice(idx, 1);
          persistPlayers();
          Render.renderPlayers(state.players);
          Toast.success("已删除 " + name);
        });
      }
    });
  }

  function toggleEdit(li, idx) {
    if (li.classList.contains("editing")) {
      // 保存
      var nameInput = li.querySelector('.edit-fields .input-name');
      var scoreInput = li.querySelector('.edit-fields .input-score');
      var name = nameInput.value.trim();
      var scoreRaw = scoreInput.value.trim();
      if (!name) { Toast.error("姓名不能为空"); nameInput.focus(); return; }
      var score = Number(scoreRaw);
      if (scoreRaw === "" || isNaN(score)) { Toast.error("分数格式不正确"); scoreInput.focus(); return; }
      if (score < 0) { Toast.error("分数不能为负数"); scoreInput.focus(); return; }
      state.players[idx].name = name;
      state.players[idx].score = score;
      persistPlayers();
      Render.renderPlayers(state.players);
      Toast.success("已更新");
    } else {
      li.classList.add("editing");
      // 切换图标为保存
      var editBtn = li.querySelector('[data-act="edit"]');
      editBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      editBtn.setAttribute("aria-label", "保存");
      var nameInput = li.querySelector('.edit-fields .input-name');
      nameInput.focus();
      nameInput.select();
    }
  }

  /* ---------- 结果展示 ---------- */
  function bindResult() {
    document.getElementById("generateBtn").addEventListener("click", function () {
      if (!state.awards.length) {
        Toast.error("请先配置奖项");
        switchTab("awards");
        return;
      }
      if (!validateAwards()) return;
      if (!state.players.length) {
        Toast.error("请先录入选手成绩");
        return;
      }
      state.results = Ranking.compute(state.players, state.awards);
      Render.renderResult(state.results, state.sortMode);
      switchTab("result");
      Toast.success("排名已生成");
    });

    // 排序切换
    var sortBtns = document.querySelectorAll(".sort-btn");
    sortBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        sortBtns.forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        state.sortMode = b.dataset.sort;
        if (state.results) {
          Render.renderResult(state.results, state.sortMode);
        }
      });
    });

    // 长按复制榜单文本
    var list = document.getElementById("rankList");
    var pressTimer = null;
    function startPress() {
      pressTimer = setTimeout(function () {
        copyRankText();
      }, 600);
    }
    function cancelPress() { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } }
    list.addEventListener("pointerdown", startPress);
    list.addEventListener("pointerup", cancelPress);
    list.addEventListener("pointermove", cancelPress);
    list.addEventListener("pointercancel", cancelPress);
  }

  function copyRankText() {
    if (!state.results || !state.results.length) return;
    var lines = ["【赛事排名榜】"];
    var sorted = state.results.slice().sort(function (a, b) { return a.rank - b.rank; });
    sorted.forEach(function (r) {
      var award = r.award ? (" [" + r.award.name + "]") : " [未获奖]";
      lines.push("第" + r.rank + "名 " + r.player.name + " " + r.player.score + "分" + award);
    });
    var text = lines.join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        Toast.success("榜单已复制到剪贴板");
      }).catch(function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      Toast.success("榜单已复制");
    } catch (e) {
      Toast.error("复制失败，请手动选择");
    }
    document.body.removeChild(ta);
  }

  /* ---------- 拖拽排序 ---------- */
  function initDrag() {
    var list = document.getElementById("awardList");
    Drag.init(list, {
      selector: ".award-card",
      handleSelector: ".drag-handle",
      onReorder: function (from, to) {
        if (from < 0 || to < 0) return;
        var moved = state.awards.splice(from, 1)[0];
        state.awards.splice(to, 0, moved);
        persistAwards();
        Render.renderAwards(state.awards);
        Toast.success("已调整奖项级别");
      }
    });
  }

  /* ---------- 二次确认弹窗 ---------- */
  var modal = document.getElementById("modal");
  var modalTitle = document.getElementById("modalTitle");
  var modalText = document.getElementById("modalText");
  var modalConfirm = document.getElementById("modalConfirm");
  var modalCancel = document.getElementById("modalCancel");
  var modalCallback = null;

  function openModal(title, text, onConfirm) {
    modalTitle.textContent = title;
    modalText.textContent = text;
    modalCallback = onConfirm;
    modal.classList.remove("hidden");
    modalConfirm.focus();
  }
  function closeModal() {
    modal.classList.add("hidden");
    modalCallback = null;
  }
  modalConfirm.addEventListener("click", function () {
    var cb = modalCallback;
    closeModal();
    if (typeof cb === "function") cb();
  });
  modalCancel.addEventListener("click", closeModal);
  modal.querySelector(".modal-mask").addEventListener("click", closeModal);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
  });

  /* ---------- 工具 ---------- */
  function findIdx(arr, id) {
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return i;
    return -1;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
