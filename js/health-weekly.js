var HealthWeekly = (function() {
  function render(containerId) {
    var el = document.getElementById(containerId);
    var hist = HealthImport.getHistory(7);

    if (hist.length < 3) {
      el.innerHTML = "<p style='color:#9ca3af'>Za mało danych</p>";
      return;
    }

    var avgSleep = Math.round(hist.reduce((a,b)=>a+b.sleepMin,0)/hist.length);
    var avgRHR = Math.round(hist.reduce((a,b)=>a+b.rhr,0)/hist.length);
    var avgHRV = Math.round(hist.reduce((a,b)=>a+b.hrv,0)/hist.length);

    el.innerHTML = `
      <div style="background:#111827;border-radius:10px;padding:12px;">
        <h4 style="color:#f9fafb;">📅 Weekly Report</h4>
        <p style="color:#d1d5db;font-size:0.85em;">
          Sen: ${(avgSleep/60).toFixed(1)}h<br>
          RHR: ${avgRHR} bpm<br>
          HRV: ${avgHRV} ms
        </p>
      </div>
    `;
  }

  return { render };
})();
