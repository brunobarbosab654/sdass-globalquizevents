/**
 * Funnel attribution store (ttclid + UTMs) for Vendepay checkout handoff.
 */
(function (w) {
  var PREFIX = "funnel_attr_";
  var KEYS = [
    "ttclid",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "utm_id",
    "fbclid",
    "gclid",
  ];

  function qp(name) {
    try {
      return new URLSearchParams(w.location.search).get(name) || "";
    } catch (e) {
      return "";
    }
  }

  function set(k, v) {
    if (!v) return;
    var val = String(v);
    try {
      localStorage.setItem(PREFIX + k, val);
    } catch (e) {}
    try {
      sessionStorage.setItem(k, val);
    } catch (e2) {}
    try {
      localStorage.setItem(k, val);
    } catch (e3) {}
  }

  function get(k) {
    try {
      var v = localStorage.getItem(PREFIX + k) || "";
      if (v) return v;
    } catch (e) {}
    try {
      var s = sessionStorage.getItem(k) || "";
      if (s) return s;
    } catch (e3) {}
    try {
      var plain = localStorage.getItem(k) || "";
      if (plain) return plain;
    } catch (e4) {}
    return "";
  }

  function captureFromUrl() {
    KEYS.forEach(function (k) {
      var v = qp(k);
      if (v) set(k, v);
    });
    try {
      var m = document.cookie.match(/(?:^|; )ttclid=([^;]*)/);
      if (m && m[1]) set("ttclid", decodeURIComponent(m[1]));
    } catch (e) {}
  }

  function hasTikTokTraffic() {
    if (get("ttclid") || get("utm_source") || get("utm_campaign")) return true;
    if (qp("ttclid") || qp("utm_source") || qp("utm_campaign")) return true;
    return false;
  }

  function appendToCheckoutUrl(base) {
    try {
      captureFromUrl();
    } catch (e) {}
    var url = new URL(base, w.location.origin);
    KEYS.forEach(function (k) {
      var v = get(k) || qp(k);
      if (v && !url.searchParams.get(k)) url.searchParams.set(k, v);
    });
    return url.toString();
  }

  w.AttrStore = {
    KEYS: KEYS,
    PREFIX: PREFIX,
    captureFromUrl: captureFromUrl,
    get: get,
    set: set,
    getTtclid: function () {
      return get("ttclid");
    },
    hasTtclid: function () {
      return !!get("ttclid");
    },
    hasTikTokTraffic: hasTikTokTraffic,
    appendToCheckoutUrl: appendToCheckoutUrl,
  };

  try {
    captureFromUrl();
  } catch (e) {}
})(window);
