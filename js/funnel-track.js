(function () {
  var SESSION_KEY = "funnel_demo_session_id";

  function sessionId() {
    try {
      var existing = sessionStorage.getItem(SESSION_KEY);
      if (existing) return existing;
      var id =
        "sess_" +
        Math.random().toString(36).slice(2) +
        "_" +
        Date.now().toString(36);
      sessionStorage.setItem(SESSION_KEY, id);
      return id;
    } catch (e) {
      return "sess_anon";
    }
  }

  function pageName() {
    var path = location.pathname.replace(/\/+$/, "") || "/";
    if (path.indexOf("/exit-vp") === 0) return "exit-vp";
    if (path.indexOf("/up1-test") === 0) return "up1-test";
    if (path.indexOf("/up1") === 0) return "up1";
    if (path.indexOf("/up2") === 0) return "up2";
    if (path.indexOf("/up3") === 0) return "up3";
    if (path.indexOf("/thankyou") === 0 || path.indexOf("/thanks") === 0) return "thankyou";
    if (path.indexOf("/refund") === 0) return "refund";

    if (path.indexOf("/back-redirect") === 0) return "back-redirect";
    if (path.indexOf("/back-up1") === 0) return "back-up1";
    if (path.indexOf("/back-up2") === 0) return "back-up2";
    if (path.indexOf("/back-up3") === 0) return "back-up3";
    return path;
  }

  function track(event, extra) {
    extra = extra || {};
    var payload = {
      event: event,
      page: pageName(),
      step: extra.step || location.hash.replace("#", "") || null,
      path: location.pathname + location.search + location.hash,
      referrer: document.referrer || null,
      userAgent: navigator.userAgent,
      sessionId: sessionId(),
      meta: extra.meta || {},
    };
    try {
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }

  function saveLead(data) {
    data = data || {};
    data.page = data.page || pageName();
    data.sessionId = data.sessionId || sessionId();
    return fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      keepalive: true,
    })
      .then(function (r) {
        return r.json().catch(function () {
          return { ok: false };
        });
      })
      .catch(function () {
        return { ok: false };
      });
  }

  window.FunnelTrack = { track: track, saveLead: saveLead, sessionId: sessionId };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      track("page_view");
    });
  } else {
    track("page_view");
  }

  window.addEventListener("hashchange", function () {
    track("step_view", { step: location.hash.replace("#", "") || null });
  });
})();
