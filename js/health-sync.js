
/* health-sync.js v2 — Sprint 14: Cloud Sync via JSONBin */
var HealthSync = (function() {
  "use strict";

  var BIN_ID = "6a32eeddf5f4af5e2903de81";
  var API_KEY = "$2a$10$6NbODl6x2IbzQwZ4TV9OieTf5BG9zhHT54SibqBhcT/cUTUWsLxBS"; // <-- TYLKO TO PODMIEN!

  var BASE_URL = "https://api.jsonbin.io/v3/b/" + BIN_ID;

  async function push() {
    try {
      var healthData = HealthImport.getAll();
      var payload = {
        health: healthData,
        meta: {
          updated: new Date().toISOString(),
          version: 1,
          device: navigator.userAgent.includes("iPhone") ? "iphone" : "desktop"
        }
      };

      var res = await fetch(BASE_URL, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": API_KEY,
          "X-Bin-Versioning": "false"
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        console.error("[Sync] ❌ PUSH failed:", res.status);
        return false;
      }

      console.log("[Sync] ✅ PUSH OK", healthData.length, "records");
      return true;
    } catch (e) {
      console.error("[Sync] ❌ PUSH ERROR", e);
      return false;
    }
  }

  async function pull() {
    try {
      var res = await fetch(BASE_URL + "/latest", {
        headers: { "X-Master-Key": API_KEY }
      });

      if (!res.ok) {
        console.error("[Sync] ❌ PULL failed:", res.status);
        return false;
      }

      var json = await res.json();
      var record = json.record || {};
      var cloudData = Array.isArray(record.health) ? record.health : [];

      // MERGE: lokalne + chmura (po dacie, najnowsze wygrywają)
      var localData = HealthImport.getAll();
      var merged = mergeByDate(localData, cloudData);

      localStorage.setItem("health_data", JSON.stringify(merged));
      console.log("[Sync] ✅ PULL OK — cloud:", cloudData.length, "| local:", localData.length, "| merged:", merged.length);
      return true;
    } catch (e) {
      console.error("[Sync] ❌ PULL ERROR", e);
      return false;
    }
  }

  function mergeByDate(local, cloud) {
    var map = {};
    cloud.forEach(function(e) { if (e.date) map[e.date] = e; });
    local.forEach(function(e) {
      if (!e.date) return;
      // Jesli lokalny ma nowszy timestamp, ma pierwszenstwo
      if (!map[e.date] || (e.ts && map[e.date].ts && e.ts > map[e.date].ts)) {
        map[e.date] = e;
      }
    });
    return Object.values(map).sort(function(a, b) { return a.date.localeCompare(b.date); });
  }

  async function sync() {
    await pull();
    await push();
  }

  function auto() {
    setTimeout(sync, 1500);
  }

  return { push: push, pull: pull, sync: sync, auto: auto };
})();
