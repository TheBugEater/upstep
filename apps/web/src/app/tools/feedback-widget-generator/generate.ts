export type WidgetConfig = {
  buttonText: string;
  email: string;
  position: "bottom-right" | "bottom-left";
  accentColor: string;
};

const UTM = "utm_source=widget&utm_medium=referral&utm_campaign=feedback-widget-generator";

export function buildWidgetScript(config: WidgetConfig): string {
  const { buttonText, email, position, accentColor } = config;
  const side = position === "bottom-left" ? "left" : "right";

  return `<script>
(function () {
  var CONFIG = {
    buttonText: ${JSON.stringify(buttonText || "Feedback")},
    email: ${JSON.stringify(email)},
    accentColor: ${JSON.stringify(accentColor || "#E05A33")},
    side: ${JSON.stringify(side)},
  };

  var style = document.createElement("style");
  style.textContent =
    "#uw-btn{position:fixed;bottom:20px;" + CONFIG.side + ":20px;z-index:2147483000;" +
    "background:" + CONFIG.accentColor + ";color:#fff;border:none;border-radius:999px;" +
    "padding:12px 18px;font:600 14px/1 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;" +
    "box-shadow:0 4px 16px rgba(0,0,0,.18);cursor:pointer;}" +
    "#uw-overlay{position:fixed;inset:0;background:rgba(20,18,16,.45);z-index:2147483001;" +
    "display:none;align-items:center;justify-content:center;padding:20px;}" +
    "#uw-modal{background:#fff;border-radius:16px;max-width:360px;width:100%;padding:20px;" +
    "font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.25);}" +
    "#uw-modal h3{margin:0 0 10px;font-size:15px;color:#222;}" +
    "#uw-modal textarea{width:100%;box-sizing:border-box;min-height:100px;border:1px solid #ddd;" +
    "border-radius:10px;padding:10px;font:13px/1.4 inherit;resize:vertical;margin-bottom:12px;}" +
    "#uw-modal .uw-row{display:flex;gap:8px;justify-content:flex-end;}" +
    "#uw-modal button{border:none;border-radius:999px;padding:9px 16px;font:600 13px inherit;cursor:pointer;}" +
    "#uw-cancel{background:#f1f1f1;color:#444;}" +
    "#uw-send{background:" + CONFIG.accentColor + ";color:#fff;}" +
    "#uw-powered{display:block;text-align:center;margin-top:14px;font-size:11px;color:#999;text-decoration:none;}";
  document.head.appendChild(style);

  var btn = document.createElement("button");
  btn.id = "uw-btn";
  btn.type = "button";
  btn.textContent = CONFIG.buttonText;

  var overlay = document.createElement("div");
  overlay.id = "uw-overlay";
  overlay.innerHTML =
    '<div id="uw-modal" role="dialog" aria-modal="true">' +
    "<h3>Send feedback</h3>" +
    '<textarea id="uw-text" placeholder="What\\'s on your mind?"></textarea>' +
    '<div class="uw-row">' +
    '<button id="uw-cancel" type="button">Cancel</button>' +
    '<button id="uw-send" type="button">Send</button>' +
    "</div>" +
    '<a id="uw-powered" href="https://upstep.dev/?${UTM}" target="_blank" rel="noopener">Powered by Upstep.dev</a>' +
    "</div>";

  document.body.appendChild(btn);
  document.body.appendChild(overlay);

  function open() { overlay.style.display = "flex"; document.getElementById("uw-text").focus(); }
  function close() { overlay.style.display = "none"; document.getElementById("uw-text").value = ""; }

  btn.addEventListener("click", open);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
  document.getElementById("uw-cancel").addEventListener("click", close);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

  document.getElementById("uw-send").addEventListener("click", function () {
    var text = document.getElementById("uw-text").value.trim();
    if (!text) return;
    var subject = encodeURIComponent("Feedback from " + location.hostname);
    var body = encodeURIComponent(text + "\\n\\n---\\nSent from " + location.href);
    var a = document.createElement("a");
    a.href = "mailto:" + CONFIG.email + "?subject=" + subject + "&body=" + body;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    close();
  });
})();
</script>`;
}
