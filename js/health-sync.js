/* health-sync.js — Sprint 14: Cloud Sync via JSONBin */
var HealthSync = (function() {
  "use strict";

  // ⚠️ WSTAW SWOJE DANE
  var BIN_ID = "TUTAJ_WKLEJ_BIN_ID";
  var API_KEY = "TUTAJ_WKLEJ_API_KEY";

  var BASE_URL = "https://api.jsonbin.io/v3/b/" + BIN_ID;

  async function push() {
    try {
      var data = HealthImport.getAll();

      await fetch(BASE_URL, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": API_KEY
        },
        body: JSON.stringify(data)
      });

      console.log("[Sync] ✅ PUSH OK", data.length);
    } catch (e) {
      console.error("[Sync] ❌ PUSH ERROR", e);
    }
  }

  async function pull() {
    try {
      var res = await fetch(BASE_URL, {
        headers: {
          "X-Master-Key": API_KEY
        }
      });

      var json = await res.json();
      var data = json.record || [];

      if (!Array.isArray(data)) return;

      localStorage.setItem("health_data", JSON.stringify(data));

      console.log("[Sync] ✅ PULL OK", data.length);
    } catch (e) {
      console.error("[Sync] ❌ PULL ERROR", e);
    }
  }

  async function sync() {
    await pull();
    await push();
  }

  function auto() {
    // Sync przy starcie
    setTimeout(sync, 1500);
  }

  return {
    push: push,
    pull: pull,
    sync: sync,
    auto: auto
  };
})();
