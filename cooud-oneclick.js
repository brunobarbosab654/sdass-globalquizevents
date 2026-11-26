/**
 * Funnel bridge for Vendepay one-click upsells.
 *
 * Vendepay widget postMessage types (v1.0.16):
 *   HEIGHT | PIX_OPEN | PIX_SUCCESS | CC_OPEN | CC_TOKEN | CC_CLOSED
 *
 * PIX_SUCCESS = paid. Never reuse front vendaId from the URL as upsell order_id.
 * CC_TOKEN only arms CC detection — does NOT mark a pending sale.
 */
(function () {
  "use strict";

  var navigating = false;
  var paidOnce = {};
  var ccArmedUntil = 0;
  var PRICES = { up1: 37.9, up2: 28.4, up3: 67.4 };
  // Banxico FIX 26 Nov 2026: 19.72 MXN per USD. Same products, peso amounts.
  var PRICES_MXN = { up1: 747.39, up2: 560.05, up3: 1329.13 };
  var CAPI =
    "https://iyterupgapczlgcwuwbw.supabase.co/functions/v1/tiktok-capi";
  var ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5dGVydXBnYXBjemxnY3d1d2J3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NjI0MjQsImV4cCI6MjEwMzAzODQyNH0.7_VF7JnRrmkVLGeyKLxzJJUCEEvvcPjPN26FN-69wlY";
  var IGNORE_TYPES = {
    HEIGHT: 1,
    PIX_OPEN: 1,
    CC_OPEN: 1,
    CC_TOKEN: 1,
    CC_CLOSED: 1,
  };
  var PRODUCT_IDS = {
    "2979a3be-4980-4118-9f8c-388f3d62fa25": 1,
    "8b553836-ddb5-4582-a594-a66744542b22": 1,
    "663bd9f3-bcb3-4686-b1ad-ffee8576b12a": 1,
    "665ed4f6-82bc-419c-9fb8-79cf048023f9": 1,
    "73147419-77ac-4745-bfc4-98015d27edda": 1,
    "1d60600f-5b4c-4703-b81a-2a2e783fa61e": 1,
    "e9483f59-925a-4ada-ab8e-fa9a140c8aea": 1,
    "eb6c606e-86f4-4874-a461-d30ae9f0e714": 1,
    front: 1,
    up1: 1,
    up2: 1,
    up3: 1,
  };

  function currentProduct() {
    var p = (location.pathname || "").toLowerCase();
    if (p.indexOf("/back-up3") !== -1 || p.indexOf("/up3") !== -1) return "up3";
    if (p.indexOf("/back-up2") !== -1 || p.indexOf("/up2") !== -1) return "up2";
    if (p.indexOf("/back-up1") !== -1 || p.indexOf("/up1-test") !== -1 || p.indexOf("/up1") !== -1) return "up1";
    return "unknown";
  }

  function isMx() {
    var p = (location.pathname || "").toLowerCase();
    return p === "/mx" || p.indexOf("/mx/") === 0;
  }

  function priceFor(product) {
    return (isMx() ? PRICES_MXN : PRICES)[product];
  }

  function currency() {
    return isMx() ? "MXN" : "USD";
  }

  function locale() {
    return isMx() ? "es_MX" : "en_US";
  }

  function resolveTtclid() {
    try {
      if (window.AttrStore) {
        if (AttrStore.captureFromUrl) AttrStore.captureFromUrl();
        if (AttrStore.getTtclid) {
          var a = AttrStore.getTtclid();
          if (a) return String(a);
        }
      }
    } catch (e) {}
    try {
      var params = new URLSearchParams(location.search || "");
      var q = params.get("ttclid");
      if (q) return q;
    } catch (e2) {}
    try {
      var ls =
        sessionStorage.getItem("ttclid") ||
        localStorage.getItem("funnel_attr_ttclid") ||
        localStorage.getItem("ttclid") ||
        "";
      if (ls) return ls;
    } catch (e3) {}
    try {
      var m = document.cookie.match(/(?:^|; )ttclid=([^;]*)/);
      if (m) return decodeURIComponent(m[1]);
    } catch (e4) {}
    return null;
  }

  function restoreAttrParams(url) {
    var keys = [
      "ttclid",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "utm_id",
    ];
    keys.forEach(function (key) {
      if (url.searchParams.has(key)) return;
      var val = "";
      try {
        if (window.AttrStore && AttrStore.get) val = AttrStore.get(key) || "";
      } catch (e) {}
      if (!val) {
        try {
          val =
            sessionStorage.getItem(key) ||
            localStorage.getItem("funnel_attr_" + key) ||
            localStorage.getItem(key) ||
            "";
        } catch (e2) {}
      }
      if (!val && key === "ttclid") {
        try {
          var m = document.cookie.match(/(?:^|; )ttclid=([^;]*)/);
          if (m) val = decodeURIComponent(m[1]);
        } catch (e3) {}
      }
      if (val) url.searchParams.set(key, val);
    });
  }

  function buildNextUrl(flags) {
    var base = window.COOUD_PP_NEXT;
    if (!base) return null;
    try {
      var url = new URL(base, window.location.href);
      var current = new URLSearchParams(window.location.search);
      // Keep attribution + vendaId (widget needs it). Drop outcome flags.
      var statusKeys = {
        paid: 1,
        declined: 1,
        failed: 1,
        pending: 1,
        waiting: 1,
        cancelled: 1,
        status: 1,
        payment: 1,
        result: 1,
      };
      current.forEach(function (value, key) {
        if (statusKeys[key]) return;
        if (!url.searchParams.has(key)) url.searchParams.set(key, value);
      });
      restoreAttrParams(url);
      if (flags) {
        Object.keys(statusKeys).forEach(function (k) {
          url.searchParams.delete(k);
        });
        Object.keys(flags).forEach(function (key) {
          url.searchParams.set(key, flags[key]);
        });
      }
      return url.toString();
    } catch (e) {
      return base;
    }
  }

  function postCapi(payload) {
    try {
      if (!payload.ttclid) payload.ttclid = resolveTtclid();
      if (!payload.ttp) {
        try {
          var m = document.cookie.match(/(?:^|; )_ttp=([^;]*)/);
          if (m) payload.ttp = decodeURIComponent(m[1]);
        } catch (e0) {}
      }
      var body = JSON.stringify(payload);
      return fetch(CAPI, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON,
          Authorization: "Bearer " + ANON,
        },
        body: body,
        keepalive: true,
        mode: "cors",
        credentials: "omit",
      })
        .then(function (res) {
          return res.json().catch(function () {
            return { ok: res.ok };
          });
        })
        .catch(function () {
          return { ok: false };
        });
    } catch (e) {
      return Promise.resolve({ ok: false });
    }
  }

  function firePixelPurchase(product, value, cur, eventId) {
    try {
      if (!(window.ttq && typeof window.ttq.track === "function")) return;
      window.ttq.track(
        "Purchase",
        {
          contents: [
            {
              content_id: product,
              content_type: "product",
              content_name: "Upsell " + String(product).toUpperCase(),
            },
          ],
          value: value,
          currency: cur || "USD",
        },
        { event_id: eventId }
      );
    } catch (e) {}
  }

  function asObject(data) {
    if (!data) return null;
    if (typeof data === "string") {
      try {
        return JSON.parse(data);
      } catch (e) {
        return { raw: data };
      }
    }
    return data;
  }

  /** Only accept order ids from the gateway message — NEVER from page URL
   *  (URL still carries the front vendaId for the one-click widget). */
  function extractOrderId(data) {
    var obj = asObject(data) || {};
    var nested =
      (obj.data && typeof obj.data === "object" ? obj.data : null) ||
      (obj.payload && typeof obj.payload === "object" ? obj.payload : null) ||
      {};
    var candidates = [
      obj.order_id,
      obj.orderId,
      obj.vendaId,
      obj.venda_id,
      obj.transaction_id,
      nested.order_id,
      nested.vendaId,
      nested.venda_id,
      nested.transaction_id,
      nested.intentId,
    ];
    for (var i = 0; i < candidates.length; i++) {
      var s = String(candidates[i] || "").trim();
      if (s.length >= 6 && !PRODUCT_IDS[s.toLowerCase()]) return s;
    }
    return "";
  }

  function stableEventId(product) {
    try {
      var key = "upsell_stable_eid_" + product;
      var existing = sessionStorage.getItem(key);
      if (existing) return existing;
      var eid =
        "upsell-sess-" +
        product +
        "-" +
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2, 8);
      sessionStorage.setItem(key, eid);
      return eid;
    } catch (e) {
      return (
        "upsell-sess-" +
        product +
        "-" +
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2, 8)
      );
    }
  }

  function markPending(product, orderId) {
    try {
      sessionStorage.setItem("pending_upsell_report", product);
      sessionStorage.setItem("pending_upsell_order", orderId || "");
      sessionStorage.setItem("pending_upsell_at", String(Date.now()));
      sessionStorage.setItem("upsell_stable_eid_" + product, stableEventId(product));
    } catch (e) {}
  }

  function clearPending() {
    try {
      sessionStorage.removeItem("pending_upsell_report");
      sessionStorage.removeItem("pending_upsell_order");
      sessionStorage.removeItem("pending_upsell_at");
    } catch (e) {}
  }

  function notifyPaid(data) {
    var product = currentProduct();
    if (product === "unknown") return Promise.resolve(null);
    try {
      if (sessionStorage.getItem("upsell_sale_" + product) === "1") {
        return Promise.resolve(null);
      }
    } catch (e) {}

    var orderId = extractOrderId(data);
    var eventId = orderId ? "vp-" + orderId : stableEventId(product);
    markPending(product, orderId);
    var value = priceFor(product);
    var cur = currency();
    firePixelPurchase(product, value, cur, eventId);

    function after(res) {
      try {
        var sale = res && res.sale;
        var okNew =
          res &&
          res.ok === true &&
          sale &&
          sale.ok === true &&
          sale.duplicate !== true;
        var okDupSame =
          sale &&
          sale.duplicate === true &&
          String(res.product_type || product) === product;
        if (okNew || okDupSame) {
          sessionStorage.setItem("upsell_sale_" + product, "1");
          clearPending();
        }
      } catch (e2) {}
      return res;
    }

    if (
      window.SSTrack &&
      typeof window.SSTrack.reportUpsellSale === "function"
    ) {
      return window.SSTrack
        .reportUpsellSale(product, value, cur, {
          order_id: orderId,
          event_id: eventId,
          source: "oneclick-immediate",
        })
        .then(after)
        .catch(function () {
          return after({ ok: false });
        });
    }

    return postCapi({
      event: "UpsellSale",
      event_id: eventId,
      order_id: orderId,
      value: value,
      currency: cur,
      product_type: product,
      content_id: product,
      content_name: "Upsell " + product.toUpperCase(),
      url: location.href,
      locale: locale(),
      user_agent: navigator.userAgent,
      source_detail: "oneclick-beacon",
      ttclid: resolveTtclid(),
    }).then(after);
  }

  function notifyLocal(status, note, data) {
    try {
      clearPending();
      var product = currentProduct();
      if (product === "unknown") return;
      if (
        window.SSTrack &&
        typeof window.SSTrack.reportSaleStatus === "function"
      ) {
        window.SSTrack.reportSaleStatus(
          product,
          status,
          priceFor(product),
          currency(),
          note || ""
        );
        return;
      }
      postCapi({
        event: "SaleStatus",
        event_id:
          "status-" +
          product +
          "-" +
          status +
          "-" +
          Date.now().toString(36),
        status: status,
        note: note || "",
        value: priceFor(product),
        currency: currency(),
        product_type: product,
        content_id: product,
        order_id: extractOrderId(data),
        url: location.href,
        locale: locale(),
        user_agent: navigator.userAgent,
        ttclid: resolveTtclid(),
      });
    } catch (e) {}
  }

  function goNext(reason, flags) {
    if (navigating) return;
    var next = buildNextUrl(flags || {});
    if (!next) {
      console.warn("[funnel] COOUD_PP_NEXT missing");
      return;
    }
    navigating = true;
    console.log("[funnel] redirect", reason, "→", next);
    window.location.href = next;
  }

  function textBlob(data) {
    try {
      return JSON.stringify(data).toLowerCase();
    } catch (e) {
      return String(data || "").toLowerCase();
    }
  }

  function sanitizeBlob(raw) {
    var s = String(raw || "").toLowerCase();
    s = s.replace(/"error"\s*:\s*null/g, "");
    s = s.replace(/"errors"\s*:\s*\[\s*\]/g, "");
    s = s.replace(
      /"(cancel|fail|failure|pending|success)_?urls?"\s*:\s*"[^"]*"/g,
      ""
    );
    s = s.replace(/https?:\/\/[^\s"']+/g, "");
    return s;
  }

  function isFailure(obj, blob) {
    if (!obj) return false;
    if (obj.declined === true || obj.skip === true) return true;
    return /declin|recus|reject|no_thanks|upsell_decline|"skip"\s*:\s*true|\bfailed\b|payment_failed|transaction_failed|\bincomplete\b|refund|chargeback/.test(
      blob
    );
  }

  function isPaidSignal(obj, type, status, blob) {
    if (!obj) return false;
    if (type === "pix_success" || type === "cc_success" || type === "payment_success") {
      return true;
    }
    if (
      /^(paid|pago|approved|aprovado|success|succeeded|complete|completed|payment_success|order_paid|upsell_success|completo)$/.test(
        status
      )
    ) {
      return true;
    }
    if (obj.success === true || obj.paid === true) return true;
    // After CC token: only explicit success statuses/types (no blob heuristics)
    if (Date.now() < ccArmedUntil) {
      if (/success|paid|approved|aprovado|completo|completed|purchase/.test(type)) {
        return !isFailure(obj, blob);
      }
    }
    return false;
  }

  function classifyVendepayUpsell(obj) {
    var type = String(obj.type || obj.event || obj.action || "").toUpperCase();
    var typeLc = type.toLowerCase();
    var status = String(
      obj.status ||
        obj.payment_status ||
        (obj.payload && obj.payload.status) ||
        ""
    ).toLowerCase();
    var blob = sanitizeBlob(textBlob(obj));

    if (type === "HEIGHT" || type === "PIX_OPEN" || type === "CC_OPEN") {
      return null;
    }
    if (type === "CC_TOKEN") {
      // Card submitted — arm only. Do NOT markPending (false backups on decline).
      ccArmedUntil = Date.now() + 120000;
      return null;
    }
    if (type === "CC_CLOSED") {
      return null;
    }
    if (type === "PIX_SUCCESS") {
      return { status: "paid", flags: { paid: "1" }, note: "PIX_SUCCESS" };
    }
    if (isFailure(obj, blob)) {
      return {
        status: "declined",
        flags: { declined: "1" },
        note: "Pagamento/cartão recusado — não cobrado",
      };
    }
    if (isPaidSignal(obj, typeLc, status, blob)) {
      return { status: "paid", flags: { paid: "1" }, note: type || "paid" };
    }
    return null;
  }

  function classifyOutcome(data) {
    var obj = asObject(data);
    if (!obj) return null;

    if (String(obj.source || "") === "VendepayUpsell") {
      return classifyVendepayUpsell(obj);
    }

    var type = String(
      obj.type || obj.event || obj.action || obj.name || ""
    ).toLowerCase();
    var status = String(
      obj.status || obj.payment_status || obj.state || obj.result || ""
    ).toLowerCase();
    var blob = sanitizeBlob(textBlob(obj));

    if (
      obj.declined === true ||
      obj.skip === true ||
      /decline|declined|reject|no_thanks|upsell_decline|recus|"skip"\s*:\s*true/.test(
        blob
      )
    ) {
      return {
        status: "declined",
        flags: { declined: "1" },
        note: "Pagamento/cartão recusado — não cobrado",
      };
    }
    if (
      /\bfailed\b|payment_failed|transaction_failed|\bincomplete\b/.test(blob)
    ) {
      return {
        status: "failed",
        flags: { failed: "1", status: "failed" },
        note: "Pagamento falhou — não cobrado",
      };
    }
    if (isPaidSignal(obj, type, status, blob)) {
      return { status: "paid", flags: { paid: "1" } };
    }
    return null;
  }

  function allowedOrigin(origin) {
    if (!origin) return true;
    origin = String(origin).toLowerCase();
    return (
      origin.indexOf("vendepay.com") !== -1 ||
      origin.indexOf("cooud.com") !== -1 ||
      origin === window.location.origin.toLowerCase()
    );
  }

  function handlePaid(data, reason) {
    var product = currentProduct();
    if (product === "unknown") return;
    if (paidOnce[product]) return;
    paidOnce[product] = true;
    try {
      if (sessionStorage.getItem("upsell_sale_" + product) === "1") {
        goNext(reason || "already-sent", { paid: "1" });
        return;
      }
    } catch (e) {}

    var done = false;
    function proceed() {
      if (done) return;
      done = true;
      goNext(reason || "widget-success", { paid: "1" });
    }
    try {
      var p = notifyPaid(data);
      if (p && typeof p.then === "function") {
        p.then(proceed).catch(proceed);
        setTimeout(proceed, 1800);
        return;
      }
    } catch (e2) {}
    proceed();
  }

  window.addEventListener("message", function (event) {
    if (!allowedOrigin(event.origin)) return;
    var data = event.data;
    var obj = asObject(data);
    if (!obj) return;

    var type = String(obj.type || "").toUpperCase();
    if (
      type === "PIX_SUCCESS" ||
      type === "CC_SUCCESS" ||
      type === "PAYMENT_SUCCESS"
    ) {
      console.log("[funnel] vendepay paid signal", type, event.origin);
      handlePaid(obj, "vendepay-" + type.toLowerCase());
      return;
    }

    var outcome = classifyOutcome(obj);
    if (!outcome) return;
    if (outcome.status === "paid") {
      console.log("[funnel] classified paid", outcome.note || "", event.origin);
      handlePaid(obj, "widget-success");
      return;
    }
    notifyLocal(outcome.status, outcome.note, obj);
    goNext("widget-" + outcome.status, outcome.flags);
  });

  try {
    var params = new URLSearchParams(window.location.search);
    var flag = (
      params.get("status") ||
      params.get("payment") ||
      params.get("result") ||
      ""
    ).toLowerCase();
    if (
      flag === "success" ||
      flag === "paid" ||
      flag === "approved" ||
      flag === "complete" ||
      flag === "completed" ||
      flag === "completo"
    ) {
      handlePaid({ status: "paid" }, "query-success");
    } else if (/declin|recus|reject/.test(flag)) {
      notifyLocal("declined", "Pagamento/cartão recusado — não cobrado");
      goNext("query-declined", { declined: "1" });
    } else if (/fail|error|erro/.test(flag)) {
      notifyLocal("failed", "Pagamento falhou — não cobrado");
      goNext("query-failed", { failed: "1", status: "failed" });
    }
  } catch (e) {}

  window.COOUD_GO_NEXT = goNext;
})();
