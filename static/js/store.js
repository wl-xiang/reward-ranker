/* ============================================================
   store.js - 数据存储层（localStorage 封装）
   暴露：window.Store
   数据键：
     ranking_awards   奖项配置列表 [{id,name,quota}]
     ranking_players  选手成绩列表 [{id,name,score}]
   ============================================================ */
(function (global) {
  "use strict";

  var KEY_AWARDS = "ranking_awards";
  var KEY_PLAYERS = "ranking_players";

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      // 容量溢出或隐私模式
      return false;
    }
  }

  function uid() {
    return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function getAwards() {
    return read(KEY_AWARDS, []);
  }

  function setAwards(list) {
    return write(KEY_AWARDS, list);
  }

  function getPlayers() {
    return read(KEY_PLAYERS, []);
  }

  function setPlayers(list) {
    return write(KEY_PLAYERS, list);
  }

  function clearAll() {
    try {
      localStorage.removeItem(KEY_AWARDS);
      localStorage.removeItem(KEY_PLAYERS);
    } catch (e) { /* 忽略 */ }
  }

  global.Store = {
    uid: uid,
    getAwards: getAwards,
    setAwards: setAwards,
    getPlayers: getPlayers,
    setPlayers: setPlayers,
    clearAll: clearAll
  };
})(window);
