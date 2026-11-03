/**
 * Vendepay one-click: green offer card on top, Pay / No at bottom.
 * Expand the iframe to full height, then shift up so only the button
 * strip is visible. Keep a little headroom so Pay's top isn't clipped.
 */
(function () {
  var BUTTONS = 120;
  var MIN_FULL = 260;

  function apply(container, iframe, reported) {
    if (!container || !iframe) return;

    var full = Math.max(Number(reported) || 0, MIN_FULL);
    var shift = -(full - BUTTONS);

    container.style.setProperty("height", BUTTONS + "px", "important");
    container.style.setProperty("max-height", BUTTONS + "px", "important");
    container.style.setProperty("overflow", "hidden", "important");

    iframe.style.setProperty("width", "100%", "important");
    iframe.style.setProperty("min-height", full + "px", "important");
    iframe.style.setProperty("max-height", "none", "important");
    iframe.style.setProperty("height", full + "px", "important");
    iframe.style.setProperty("margin-top", shift + "px", "important");
  }

  function init() {
    var container = document.getElementById("vendepay-upsell-container");
    if (!container) return;

    var lastReported = 0;

    function iframeEl() {
      return container.querySelector("iframe");
    }

    function sync() {
      apply(container, iframeEl(), lastReported);
    }

    var mo = new MutationObserver(function () {
      sync();
    });
    mo.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style"],
    });

    window.addEventListener("message", function (event) {
      var data = event.data;
      if (!data || data.source !== "VendepayUpsell") return;
      if (data.type === "HEIGHT" && data.height) {
        var h = Number(data.height) || 0;
        if (h > lastReported) lastReported = h;
      }
      requestAnimationFrame(sync);
    });

    sync();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
