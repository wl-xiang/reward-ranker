/* ============================================================
   render.js - 视图渲染层
   暴露：window.Render
   依赖：window.Store, window.Ranking
   ============================================================ */
(function (global) {
  "use strict";

  // 拖拽手柄 SVG（六点）
  var HANDLE_SVG = '<svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">' +
    '<circle cx="6" cy="5" r="1.4"/><circle cx="12" cy="5" r="1.4"/>' +
    '<circle cx="6" cy="9" r="1.4"/><circle cx="12" cy="9" r="1.4"/>' +
    '<circle cx="6" cy="13" r="1.4"/><circle cx="12" cy="13" r="1.4"/></svg>';

  // 删除图标
  var TRASH_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>' +
    '<path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

  var EDIT_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>';

  var CHECK_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<polyline points="20 6 9 17 4 12"></polyline></svg>';

  var TOP_COLORS = ["var(--award-1)", "var(--award-2)", "var(--award-3)"];
  var TOP_SHADOWS = ["rgba(201,154,46,.35)", "rgba(138,143,152,.35)", "rgba(181,121,62,.35)"];
  var MEDAL_TEXT = ["金", "银", "铜"];

  /* ---------- 奖项列表 ---------- */
  function renderAwards(awards) {
    var list = document.getElementById("awardList");
    var empty = document.getElementById("awardEmpty");
    var count = document.getElementById("awardCount");
    list.innerHTML = "";

    if (!awards.length) {
      empty.classList.remove("hidden");
    } else {
      empty.classList.add("hidden");
    }
    count.textContent = awards.length + " 项";

    awards.forEach(function (a, i) {
      var palette = Ranking.paletteFor(i);
      var li = document.createElement("li");
      li.className = "award-card drag-item";
      li.setAttribute("data-id", a.id);
      li.style.setProperty("--level-color", palette.color);
      li.style.setProperty("--level-bg", palette.bg);

      li.innerHTML =
        '<span class="drag-handle" aria-label="拖拽调整级别" role="button">' + HANDLE_SVG + '</span>' +
        '<span class="level-badge">' + cnLevel(i) + '</span>' +
        '<div class="award-fields">' +
          '<input class="input input-name" type="text" maxlength="20" placeholder="奖项名称" value="' + esc(a.name) + '" data-field="name" />' +
          '<input class="input input-quota" type="number" min="1" step="1" inputmode="numeric" placeholder="名额" value="' + esc(a.quota) + '" data-field="quota" />' +
        '</div>' +
        '<button class="icon-btn" type="button" data-act="del" aria-label="删除奖项">' + TRASH_SVG + '</button>';

      list.appendChild(li);
    });
  }

  function cnLevel(i) {
    var names = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
    if (i < names.length) return names[i];
    return String(i + 1);
  }

  /* ---------- 选手列表 ---------- */
  function renderPlayers(players) {
    var list = document.getElementById("playerList");
    var empty = document.getElementById("playerEmpty");
    var count = document.getElementById("playerCount");
    list.innerHTML = "";
    count.textContent = players.length + " 人";

    if (!players.length) {
      empty.classList.remove("hidden");
    } else {
      empty.classList.add("hidden");
    }

    players.forEach(function (p, i) {
      var li = document.createElement("li");
      li.className = "player-row";
      li.setAttribute("data-id", p.id);
      li.innerHTML =
        '<span class="player-seq">' + (i + 1) + '</span>' +
        '<span class="player-name">' + esc(p.name) + '</span>' +
        '<span class="player-score">' + fmtScore(p.score) + '</span>' +
        '<div class="edit-fields">' +
          '<input class="input input-name" type="text" maxlength="30" value="' + esc(p.name) + '" data-field="name" />' +
          '<input class="input input-score" type="text" inputmode="decimal" value="' + esc(p.score) + '" data-field="score" />' +
        '</div>' +
        '<div class="row-actions">' +
          '<button class="icon-btn" type="button" data-act="edit" aria-label="编辑">' + EDIT_SVG + '</button>' +
          '<button class="icon-btn" type="button" data-act="del" aria-label="删除">' + TRASH_SVG + '</button>' +
        '</div>';
      list.appendChild(li);
    });
  }

  /* ---------- 排名结果 ---------- */
  function renderResult(results, sortMode) {
    var list = document.getElementById("rankList");
    var empty = document.getElementById("resultEmpty");
    var summary = document.getElementById("resultSummary");

    if (!results || results.length === 0) {
      list.innerHTML = "";
      summary.innerHTML = "";
      empty.classList.remove("hidden");
      list.classList.add("hidden");
      return;
    }
    empty.classList.add("hidden");
    list.classList.remove("hidden");

    // 统计概览
    var total = results.length;
    var awarded = results.filter(function (r) { return r.award; }).length;
    var quotaTotal = 0;
    var awards = Store.getAwards();
    awards.forEach(function (a) { quotaTotal += Math.max(0, parseInt(a.quota, 10) || 0); });

    summary.innerHTML =
      cell(total, "参赛人数", false) +
      cell(awarded, "获奖人数", true) +
      cell(quotaTotal, "奖项名额", false);

    // 排序
    var sorted = results.slice();
    if (sortMode === "score") {
      sorted.sort(function (a, b) {
        var sa = Number(a.player.score), sb = Number(b.player.score);
        if (sb !== sa) return sb - sa;
        return a.rank - b.rank;
      });
    } else if (sortMode === "name") {
      sorted.sort(function (a, b) {
        return a.player.name.localeCompare(b.player.name, "zh-Hans");
      });
    } else {
      // rank 升序（默认），同分按录入顺序
      sorted.sort(function (a, b) { return a.rank - b.rank; });
    }

    list.innerHTML = "";
    sorted.forEach(function (r, idx) {
      var li = document.createElement("li");
      li.className = "rank-item";
      var rank0 = r.rank;
      var isTop = rank0 <= 3 && sortMode === "rank";
      if (isTop) {
        li.classList.add("top");
        li.style.setProperty("--top-color", TOP_COLORS[rank0 - 1]);
        li.style.setProperty("--top-shadow", TOP_SHADOWS[rank0 - 1]);
      }

      var medalText = isTop ? MEDAL_TEXT[rank0 - 1] : ("#" + r.rank);
      var awardHtml;
      if (r.award) {
        var pal = Ranking.paletteFor(r.awardIndex);
        awardHtml = '<span class="award-tag" style="--award-color:' + pal.color + ';--award-bg:' + pal.bg + '">' + esc(r.award.name) + '</span>';
      } else {
        awardHtml = '<span class="award-tag none">未获奖</span>';
      }

      li.innerHTML =
        '<span class="rank-medal">' + medalText + '</span>' +
        '<div class="rank-info">' +
          '<div class="rank-name">' + esc(r.player.name) + '</div>' +
          '<div class="rank-score">' + fmtScore(r.player.score) + ' 分 · 第 ' + r.rank + ' 名</div>' +
        '</div>' +
        awardHtml;

      list.appendChild(li);
    });
  }

  function cell(num, label, primary) {
    return '<div class="summary-cell"><div class="summary-num' + (primary ? " primary" : "") + '">' + num + '</div><div class="summary-label">' + label + '</div></div>';
  }

  /* ---------- 工具函数 ---------- */
  function esc(s) {
    if (s === undefined || s === null) return "";
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fmtScore(s) {
    var n = Number(s);
    if (isNaN(n)) return "0";
    // 整数显示整数，小数保留原始
    return String(s);
  }

  global.Render = {
    renderAwards: renderAwards,
    renderPlayers: renderPlayers,
    renderResult: renderResult
  };
})(window);
