/* trends.js — Weekly Trends Charts
 * Sprint 12 · HM Tracker PWA
 * Renders km/pace/HR per week with optional weather overlay
 */
const Trends = (() => {
  "use strict";
  const TAG = "[Trends]";

  function dayStart(d) { var r = new Date(d); r.setHours(0,0,0,0); return r; }
  function parsePace(p) { if(!p) return null; var pp=String(p).split(":"); if(pp.length!==2) return null; return parseInt(pp[0],10)*60+parseInt(pp[1],10); }
  function fmtPace(s) { if(!s||!isFinite(s)) return "--:--"; return Math.floor(s/60)+":"+String(Math.round(s%60)).padStart(2,"0"); }

  function getWeeklyData(activities, weeks) {
    if (!weeks) weeks = 12;
    var now = dayStart(new Date());
    var monday = new Date(now);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

    var data = [];
    for (var w = weeks - 1; w >= 0; w--) {
      var wStart = new Date(monday);
      wStart.setDate(wStart.getDate() - w * 7);
      var wEnd = new Date(wStart);
      wEnd.setDate(wEnd.getDate() + 6);

      var weekActs = activities.filter(function(a) {
        var d = dayStart(new Date(a.date || a.start_date));
        return d >= wStart && d <= wEnd;
      });

      var km = weekActs.reduce(function(s, a) { return s + parseFloat(a.distance_km || a.km || 0); }, 0);
      var sessions = weekActs.length;
      var hrs = weekActs.map(function(a) { return parseFloat(a.avg_hr || a.average_heartrate || 0); }).filter(function(h) { return h > 0; });
      var avgHR = hrs.length ? Math.round(hrs.reduce(function(s,v){return s+v;},0) / hrs.length) : null;
      var paces = weekActs.map(function(a) { return parsePace(a.pace || a.avg_pace); }).filter(function(p) { return p; });
      var avgPace = paces.length ? Math.round(paces.reduce(function(s,v){return s+v;},0) / paces.length) : null;

      // Average weather (if enriched)
      var temps = weekActs.filter(function(a){return a._weather && a._weather.temp !== null;}).map(function(a){return a._weather.temp;});
      var avgTemp = temps.length ? +(temps.reduce(function(s,v){return s+v;},0)/temps.length).toFixed(1) : null;

      var label = String(wStart.getDate()).padStart(2,"0") + "." + String(wStart.getMonth()+1).padStart(2,"0");

      data.push({
        label: label,
        start: wStart.toISOString().slice(0,10),
        km: +km.toFixed(1),
        sessions: sessions,
        avgHR: avgHR,
        avgPace: avgPace,
        avgTemp: avgTemp
      });
    }
    return data;
  }

  // Simple bar chart renderer (SVG)
  function renderBarChart(container, data, key, color, title, formatFn) {
    var maxVal = Math.max.apply(null, data.map(function(d){return d[key]||0;})) || 1;

    var wrap = document.createElement("div");
    wrap.className = "trends-chart";
    var h3 = document.createElement("h4");
    h3.textContent = title;
    wrap.appendChild(h3);

    var chartH = 120, barW = Math.floor((container.offsetWidth - 40) / data.length) - 4;
    if (barW < 10) barW = 10;
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    var svgW = data.length * (barW + 4) + 20;
    svg.setAttribute("viewBox", "0 0 " + svgW + " " + (chartH + 30));
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", chartH + 30);
    svg.style.display = "block";

    data.forEach(function(d, i) {
      var val = d[key] || 0;
      var h = (val / maxVal) * chartH;
      var x = i * (barW + 4) + 10;
      var y = chartH - h;

      var rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", x);
      rect.setAttribute("y", y);
      rect.setAttribute("width", barW);
      rect.setAttribute("height", h);
      rect.setAttribute("fill", color);
      rect.setAttribute("rx", "2");
      svg.appendChild(rect);

      // Value text
      if (val > 0) {
        var txt = document.createElementNS(ns, "text");
        txt.setAttribute("x", x + barW/2);
        txt.setAttribute("y", y - 3);
        txt.setAttribute("text-anchor", "middle");
        txt.setAttribute("font-size", "9");
        txt.setAttribute("fill", "#374151");
        txt.textContent = formatFn ? formatFn(val) : val;
        svg.appendChild(txt);
      }

      // Label
      var lbl = document.createElementNS(ns, "text");
      lbl.setAttribute("x", x + barW/2);
      lbl.setAttribute("y", chartH + 14);
      lbl.setAttribute("text-anchor", "middle");
      lbl.setAttribute("font-size", "8");
      lbl.setAttribute("fill", "#6b7280");
      lbl.textContent = d.label;
      svg.appendChild(lbl);
    });

    wrap.appendChild(svg);
    container.appendChild(wrap);
  }

  async function render(containerId) {
    console.log(TAG, "Rendering trends...");
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    var activities = [];
    try { activities = await DB.getAll(); } catch(e) { console.warn(TAG, e); }

    // Enrich with weather if available
    if (typeof WeatherHistory !== "undefined") {
      try { activities = await WeatherHistory.enrichAll(activities); } catch(e) { console.warn(TAG, "Weather enrich error", e); }
    }

    var data = getWeeklyData(activities, 12);

    // Title
    var h2 = document.createElement("h2");
    h2.className = "trends-title";
    h2.textContent = "Trendy (ostatnie 12 tygodni)";
    container.appendChild(h2);

    renderBarChart(container, data, "km", "#3b82f6", "Dystans (km/tydzien)", function(v){return v.toFixed(0);});
    renderBarChart(container, data, "sessions", "#8b5cf6", "Sesje / tydzien", null);
    renderBarChart(container, data, "avgPace", "#ef4444", "Avg Pace (s/km)", function(v){
      return Math.floor(v/60)+":"+String(Math.round(v%60)).padStart(2,"0");
    });
    if (data.some(function(d){return d.avgHR;})) {
      renderBarChart(container, data, "avgHR", "#f59e0b", "Avg HR (bpm)", function(v){return v;});
    }
    if (data.some(function(d){return d.avgTemp !== null;})) {
      renderBarChart(container, data, "avgTemp", "#10b981", "Avg temperatura (C)", function(v){return v + "C";});
    }

    console.log(TAG, "Done");
  }

  return { render: render, getWeeklyData: getWeeklyData };
})();
