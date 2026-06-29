/* workout-ai-button.js v1 — add 🤖 button to each activity */
(function() {
  "use strict";

  function addAIButtons() {
    // znajdz wszystkie karty treningow
    var logs = document.querySelectorAll(".wlog");
    if (!logs.length) return;

    logs.forEach(function(el) {
      // unikamy duplikatów
      if (el.dataset.aiAttached === "1") return;

      var top = el.querySelector(".wlog-top");
      if (!top) return;

      // UTWORZ BUTTON
      var btn = document.createElement("button");
      btn.innerText = "🤖";
      btn.title = "AI analiza treningu";

      btn.style.cssText = `
        margin-left:6px;
        background:#1f2937;
        border:1px solid #4b5563;
        color:#60a5fa;
        border-radius:6px;
        padding:4px 8px;
        cursor:pointer;
        font-size:0.75em;
      `;

      // EXTRACT DATE (kluczowe)
      var dateEl = el.querySelector(".wlog-d");
      if (!dateEl) return;

      // format: "13.06"
      var shortDate = dateEl.innerText.trim();

      btn.onclick = async function() {
        try {
          if (typeof WorkoutAnalyzer === "undefined") {
            alert("WorkoutAnalyzer not loaded");
            return;
          }

          var acts = await DB.getAll();

          // znajdz activity po dacie (dopasowanie day.month)
          var workout = acts.find(function(a) {
            return a.date.slice(5) === convertDate(shortDate);
          });

          if (!workout) {
            console.warn("Nie znaleziono treningu dla:", shortDate);
            alert("Nie znaleziono treningu");
            return;
          }

          // 🔥 ODPAL AI
          WorkoutAnalyzer.renderAsModal(workout);

        } catch (e) {
          console.error("AI Button error:", e);
        }
      };

      top.appendChild(btn);
      el.dataset.aiAttached = "1";
    });
  }

  // pomoc: "13.06" → "06-13"

  function convertDate(d) {
    var parts = d.split(".");
    if (parts.length !== 2) return "";
    // Format: "06.28" (MM.DD) → "06-28" (MM-DD format jak a.date.slice(5))
    return parts[0].padStart(2, "0") + "-" + parts[1].padStart(2, "0");
  }


  // 🚀 Observer (działa po każdym renderze)
  var observer = new MutationObserver(function() {
    addAIButtons();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // initial run
  setTimeout(addAIButtons, 500);

})();
