/* ============================================================
   ranking.js - 排名与获奖计算逻辑
   暴露：window.Ranking

   规则：
   1. 按分数从高到低排序
   2. 同分并列同名次，后续名次顺延（两位并列第1，下一位第3）
   3. 按奖项级别从高到低匹配名额：
      - 同分并列组必须整体分配同一奖项
      - 当前奖项剩余名额不足以容纳整组时，整组顺延至下一等级奖项，
        被跳过奖项的剩余名额自动空置
      - 所有奖项名额用尽后，剩余选手标注「未获奖」
   ============================================================ */
(function (global) {
  "use strict";

  // 奖项级别配色表（与 CSS 变量对应）
  var AWARD_PALETTE = [
    { color: "var(--award-1)", bg: "var(--award-1-bg)" },
    { color: "var(--award-2)", bg: "var(--award-2-bg)" },
    { color: "var(--award-3)", bg: "var(--award-3-bg)" },
    { color: "var(--award-4)", bg: "var(--award-4-bg)" },
    { color: "var(--award-5)", bg: "var(--award-5-bg)" },
    { color: "var(--award-6)", bg: "var(--award-6-bg)" },
    { color: "var(--award-7)", bg: "var(--award-7-bg)" },
    { color: "var(--award-8)", bg: "var(--award-8-bg)" }
  ];

  function paletteFor(index) {
    return AWARD_PALETTE[index % AWARD_PALETTE.length];
  }

  /**
   * 计算排名与获奖结果
   * @param {Array} players [{id,name,score}]
   * @param {Array} awards  [{id,name,quota}] 按级别从高到低
   * @returns {Array} [{rank, player, award, awardIndex}]
   */
  function compute(players, awards) {
    if (!players || players.length === 0) return [];

    // 1. 复制并按分数降序（稳定排序，分数相同保持录入顺序）
    var sorted = players.slice().map(function (p, i) {
      return { p: p, idx: i };
    });
    sorted.sort(function (a, b) {
      var sa = Number(a.p.score);
      var sb = Number(b.p.score);
      if (sb !== sa) return sb - sa;
      return a.idx - b.idx; // 录入顺序为 tie-breaker，保证稳定
    });

    // 2. 按同分分组（连续相同分数）
    var groups = [];
    for (var i = 0; i < sorted.length; i++) {
      var cur = sorted[i];
      var last = groups[groups.length - 1];
      if (last && Number(last.items[0].p.score) === Number(cur.p.score)) {
        last.items.push(cur);
      } else {
        groups.push({ items: [cur] });
      }
    }

    // 3. 计算名次（并列同名次，后续顺延）
    var results = [];
    var rankCounter = 0;
    groups.forEach(function (g) {
      var rank = rankCounter + 1; // 组内首位 +1
      g.items.forEach(function (it) {
        results.push({
          rank: rank,
          player: it.p,
          award: null,
          awardIndex: -1
        });
      });
      rankCounter += g.items.length;
    });

    // 4. 奖项匹配：整组分配同一奖项，名额不足整组顺延
    var remaining = awards.map(function (a) { return Math.max(0, parseInt(a.quota, 10) || 0); });
    var awardIdx = 0;
    var groupStart = 0;
    groups.forEach(function (g) {
      var size = g.items.length;
      // 跳过无法容纳整组的奖项（剩余名额 < 组大小）
      while (awardIdx < awards.length && remaining[awardIdx] < size) {
        awardIdx++;
      }
      if (awardIdx < awards.length) {
        remaining[awardIdx] -= size;
        for (var k = 0; k < size; k++) {
          var r = results[groupStart + k];
          r.award = awards[awardIdx];
          r.awardIndex = awardIdx;
        }
      }
      // 否则该组未获奖
      groupStart += size;
    });

    return results;
  }

  global.Ranking = {
    compute: compute,
    paletteFor: paletteFor
  };
})(window);
