
/* health-dashboard.js v3 — Sprint 14 + 17: UI Integration + Cloudflare AI */
(function() {
  "use strict";
  var TAG = "[Dashboard]";

  if (typeof Briefing === "undefined" || !Briefing.render) {
    console.warn(TAG, "Briefing not loaded — skipping patch");
    return;
  }

  var origRender = Briefing.render;

  Briefing.render = async function(id) {
    await origRender.call(Briefing, id);
    var c = document.getElementById(id);
    if (!c) return;

    // Tylko jesli mamy dane health
    if (typeof HealthImport === "undefined") return;
    var hist = HealthImport.getHistory(30);
    if (!hist || hist.length === 0) return;

    // Card
    var card = document.createElement("div");
    card.className = "briefing-card briefing-health-dashboard";
    card.style.cssText = "margin-top:12px;background:#1f2937;border-radius:12px;padding:14px;";

    var html = "<h3 class='briefing-card-title' style='margin:0 0 10px;color:#f9fafb;'>\u{1F4CA} Health Dashboard</h3>";

    // Tab buttons
    html += "<div style='display:flex;gap:6px;margin-bottom:10px;border-bottom:1px solid #374151;padding-bottom:8px;'>";
    html += "<button id='hd-tab-charts' class='hd-tab hd-active' style='flex:1;padding:8px;border:none;border-radius:6px;background:#3b82f6;color:white;font-size:0.85em;cursor:pointer;'>\u{1F4C8} Wykresy</button>";
    html += "<button id='hd-tab-insights' class='hd-tab' style='flex:1;padding:8px;border:none;border-radius:6px;background:#374151;color:#d1d5db;font-size:0.85em;cursor:pointer;'>\u{1F9E0} Insights</button>";
    html += "<button id='hd-tab-history' class='hd-tab' style='flex:1;padding:8px;border:none;border-radius:6px;background:#374151;color:#d1d5db;font-size:0.85em;cursor:pointer;'>\u{1F4D6} Historia</button>";
    html += "</div>";

    // Tab content
    html += "<div id='hd-content' style='min-height:200px;'></div>";

    // Sync button + last sync info
    html += "<div style='margin-top:10px;padding-top:8px;border-top:1px solid #374151;display:flex;justify-content:space-between;align-items:center;'>";
    html += "<span id='hd-sync-status' style='color:#9ca3af;font-size:0.75em;'>" + (hist.length + " dni danych") + "</span>";
    if (typeof HealthSync !== "undefined") {
      html += "<button id='hd-sync-btn' style='padding:6px 12px;border:none;border-radius:6px;background:#1f2937;border:1px solid #4b5563;color:#60a5fa;font-size:0.8em;cursor:pointer;'>\u{1F504} Sync</button>";
    }
    html += "</div>";

    card.innerHTML = html;

    // Insert after coach card or at end
    var coachCard = c.querySelector(".briefing-coach");
    if (coachCard && coachCard.nextSibling) {
      c.insertBefore(card, coachCard.nextSibling);
    } else {
      c.appendChild(card);
    }

    // === Tab switching logic ===
    var contentEl = card.querySelector("#hd-content");
    var tabs = card.querySelectorAll(".hd-tab");

    function activateTab(tabId) {
      tabs.forEach(function(t) {
        if (t.id === tabId) {
          t.style.background = "#3b82f6";
          t.style.color = "white";
        } else {
          t.style.background = "#374151";
          t.style.color = "#d1d5db";
        }
      });

      contentEl.innerHTML = "<p style='color:#9ca3af;text-align:center;padding:20px;'>\u23F3 Loading...</p>";

      setTimeout(function() {
        if (tabId === "hd-tab-charts" && typeof HealthCharts !== "undefined") {
          HealthCharts.render("hd-content");

        } else if (tabId === "hd-tab-insights") {
          // 1. Cross-analysis
          if (typeof HealthCross !== "undefined") {
            HealthCross.render("hd-content");
          } else {
            contentEl.innerHTML = "";
          }

          // 2. AI Coach (basic — algorithm based)
          if (typeof HealthCoachAI !== "undefined") {
            var aiBox = document.createElement("div");
            aiBox.id = "hd-ai";
            contentEl.appendChild(aiBox);
            HealthCoachAI.render("hd-ai");
          }

          // 2b. 🔥 AI Coach Cloudflare (Llama 3.3 - real AI!)
          if (typeof AICoach !== "undefined") {
            var aiCloudBox = document.createElement("div");
            aiCloudBox.id = "hd-ai-cloud";
            contentEl.appendChild(aiCloudBox);
            AICoach.render("hd-ai-cloud");
          }

          // 3. Weekly Report
          if (typeof HealthWeekly !== "undefined") {
            var weeklyBox = document.createElement("div");
            weeklyBox.id = "hd-weekly";
            contentEl.appendChild(weeklyBox);
            HealthWeekly.render("hd-weekly");
          }

        } else if (tabId === "hd-tab-history" && typeof HealthHistory !== "undefined") {
          HealthHistory.render("hd-content");

        } else {
          contentEl.innerHTML = "<p style='color:#9ca3af;text-align:center;padding:20px;'>Modul nie zaladowany</p>";
        }
      }, 50);
    }

    tabs.forEach(function(t) {
      t.addEventListener("click", function() { activateTab(t.id); });
    });

    // Default: charts
    activateTab("hd-tab-charts");

    // === Sync button ===
    var syncBtn = card.querySelector("#hd-sync-btn");
    var statusEl = card.querySelector("#hd-sync-status");
    if (syncBtn) {
      syncBtn.addEventListener("click", async function() {
        syncBtn.disabled = true;
        syncBtn.textContent = "\u23F3 Sync...";
        statusEl.textContent = "Synchronizacja...";

        try {
          await HealthSync.sync();
          var newHist = HealthImport.getHistory(30);
          statusEl.textContent = "\u2705 OK - " + newHist.length + " dni (" + new Date().toLocaleTimeString().slice(0, 5) + ")";
          // Re-render current tab
          var activeTab = card.querySelector(".hd-tab[style*='3b82f6']");
          if (activeTab) activateTab(activeTab.id);
        } catch (e) {
          statusEl.textContent = "\u274C Sync error";
          console.error(TAG, e);
        }

        syncBtn.disabled = false;
        syncBtn.textContent = "\u{1F504} Sync";
      });
    }

    console.log(TAG, "Health Dashboard rendered v3 (" + hist.length + " dni)");
  };

  console.log(TAG, "Health Dashboard patch loaded v3 + Cloudflare AI");
})();
