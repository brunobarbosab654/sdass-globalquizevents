/* A/B VSL assignment — 50% with video (com), 50% without (sem) */
(function () {
  'use strict';
  var KEY = 'inicio_teste_vsl';
  var PARAM = 'vsl';
  var PCT_COM = 50;

  function readSaved() {
    try {
      var v = window.localStorage.getItem(KEY);
      return v === 'com' || v === 'sem' ? v : null;
    } catch (e) {
      return null;
    }
  }

  function save(v) {
    try {
      window.localStorage.setItem(KEY, v);
    } catch (e) {}
  }

  function pick() {
    var p = Number(PCT_COM);
    if (!(p >= 0 && p <= 100)) p = 50;
    return Math.random() * 100 < p ? 'com' : 'sem';
  }

  var fromUrl = null;
  try {
    fromUrl = new URLSearchParams(window.location.search).get(PARAM);
  } catch (e) {}

  var variante =
    (fromUrl === 'com' || fromUrl === 'sem' ? fromUrl : null) ||
    readSaved() ||
    pick();

  save(variante);
  document.documentElement.setAttribute('data-vsl', variante);
  window.vslVariante = variante;
  // Explicit lock for COM; SEM unlocks registration immediately
  window.__vslUnlocked = variante === 'sem';

  window.inicioVslVariant = function () {
    return window.vslVariante || document.documentElement.getAttribute('data-vsl') || 'sem';
  };
})();
