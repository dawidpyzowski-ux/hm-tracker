/* =========================================================
 *  efficiency.js — Efficiency Tracker (Cardiac Efficiency)
 *  Sprint 11 · HM Tracker PWA
 *  EF = (speed_m_per_min / avg_HR) × 1000
 * ========================================================= */
const Efficiency = (() => {
  "use strict";

  const TAG = "[Efficiency]";

  /* -------------------------------------------------------
   *  HELPERS
   * ------------------------------------------------------- */

  const dayStart = (d) => {
    const r = new Date(d);
    r.setHours(0, 0, 0, 0);
    return r;
  };

  const diffDays = (a, b) =>
    Math.round(Math.abs(dayStart(a) - dayStart(b)) / 86400000);

  const parsePace = (paceStr) => {
    if (!paceStr) return null;
    const parts = String(paceStr).split(":");
    if (parts.length !== 2) return null;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  };

  const formatPace = (s) => {
    if (!s || !isFinite(s)) return "--:--";
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const formatDate = (d) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("pl-PL", {
      day: "numeric",
      month: "short",
    });
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /* -------------------------------------------------------
   *  calcEF — Efficiency Factor z podstawowych danych
   * ------------------------------------------------------- */

  /**
   * EF = (speed_m_per_min / avg_HR) × 1000
   * speed_m_per_min = (distance_km × 1000) / duration_min
   */
  function calcEF(act) {
    const km = parseFloat(act.distance_km || act.km || 0);
    const dMin =
      parseFloat(act.duration_min || act.moving_time_min || 0) ||
      (act.moving_time ? act.moving_time / 60 : 0);
    const hr = parseFloat(act.avg_hr || act.average_heartrate || 0);

    if (km <= 0 || dMin <= 0 || hr <= 0) return null;

    const speedMPM = (km * 1000) / dMin;
    return +((speedMPM / hr) * 1000).toFixed(2);
  }

  /* -------------------------------------------------------
   *  calcEFFromStreams — dokładniejszy EF z danych strumieniowych
   * ------------------------------------------------------- */

  /**
   * Używa velocity_smooth i heartrate streams.
   * Wycina pierwsze 10% (rozgrzewka) i ostatnie 5% (wyciszenie).
   * Zwraca avg(speed/HR) × 1000.
   */
  function calcEFFromStreams(streams) {
    if (
      !streams ||
      !streams.velocity_smooth ||
      !streams.heartrate ||
      streams.velocity_smooth.length === 0 ||
      streams.heartrate.length === 0
    ) {
      return null;
    }

    const vel = streams.velocity_smooth; // m/s
    const hr = streams.heartrate; // bpm
    const len = Math.min(vel.length, hr.length);
    if (len < 20) return null; // za mało danych

    // Trim warmup (10%) i cooldown (5%)
    const startIdx = Math.floor(len * 0.1);
    const endIdx = Math.floor(len * 0.95);
    if (startIdx >= endIdx) return null;

    let sumEF = 0;
    let count = 0;

    for (let i = startIdx; i < endIdx; i++) {
      const v = vel[i]; // m/s
      const h = hr[i]; // bpm
      if (v > 0.5 && h > 40) {
        // Filtruj stojące i artefakty
        sumEF += (v * 60) / h; // speed_m_per_min / HR
        count++;
      }
    }

    if (count === 0) return null;
    return +((sumEF / count) * 1000).toFixed(2);
  }

  /* -------------------------------------------------------
   *  classifyTypeSimple — prosta klasyfikacja po pace
   * ------------------------------------------------------- */


function classifyTypeSimple(act) {
    // 1. PRIORYTET: użyj TrainingClassifier jeśli jest dostępny
    if (typeof TrainingClassifier !== "undefined" && TrainingClassifier.classify) {
      var fromType = TrainingClassifier.classify(act.type || act.workout_type);
      if (fromType) {
        // Mapuj na EF wewnętrzne nazwy
        if (fromType === "long") return "long_run";
        if (fromType === "recovery") return "easy";
        return fromType; // tempo, intervals, easy
      }
    }

    // 2. Fallback: stara klasyfikacja po pace
    const km = parseFloat(act.distance_km || act.km || 0);
    const paceS = parsePace(act.pace || act.avg_pace);

    if (km > 15) return "long_run";
    if (paceS !== null) {
      if (paceS > 340) return "easy";
      if (paceS >= 280 && paceS <= 340) return "tempo";
      if (paceS < 280) return "intervals";
    }
    return "easy";
  }


  const TYPE_COLORS = {
    easy: "#3b82f6",
    tempo: "#f59e0b",
    intervals: "#ef4444",
    long_run: "#22c55e",
  };

  const TYPE_LABELS = {
    easy: "Łatwy",
    tempo: "Tempo",
    intervals: "Interwały",
    long_run: "Długi",
  };

  /* -------------------------------------------------------
   *  getEFTrend — trend EF z ostatnich N dni
   * ------------------------------------------------------- */

  function getEFTrend(activities, days = 90) {
    const now = dayStart(new Date());
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);

    const data = [];
    (activities || []).forEach((act) => {
      const d = dayStart(new Date(act.date || act.start_date));
      if (d < cutoff) return;
      const ef = calcEF(act);
      if (ef === null) return;
      data.push({
        date: act.date || act.start_date,
        ef,
        type: classifyTypeSimple(act),
        km: parseFloat(act.distance_km || act.km || 0),
      });
    });

    // Sortuj chronologicznie
    data.sort((a, b) => new Date(a.date) - new Date(b.date));
    return data;
  }

  /* -------------------------------------------------------
   *  calcTrendLine — regresja liniowa
   * ------------------------------------------------------- */

  function calcTrendLine(efData) {
    if (!efData || efData.length < 3)
      return { slope: 0, intercept: 0, r2: 0, direction: "stable" };

    const baseDate = dayStart(new Date(efData[0].date));
    const points = efData.map((d) => ({
      x: diffDays(new Date(d.date), baseDate),
      y: d.ef,
    }));

    const n = points.length;
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0,
      sumY2 = 0;
    points.forEach((p) => {
      sumX += p.x;
      sumY += p.y;
      sumXY += p.x * p.y;
      sumX2 += p.x * p.x;
      sumY2 += p.y * p.y;
    });

    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0)
      return { slope: 0, intercept: sumY / n, r2: 0, direction: "stable" };

    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;

    // R²
    const ssRes = points.reduce((s, p) => {
      const pred = slope * p.x + intercept;
      return s + (p.y - pred) ** 2;
    }, 0);
    const meanY = sumY / n;
    const ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
    const r2 = ssTot > 0 ? +(1 - ssRes / ssTot).toFixed(4) : 0;

    let direction;
    if (slope > 0.5) direction = "improving";
    else if (slope < -0.5) direction = "declining";
    else direction = "stable";

    return { slope: +slope.toFixed(4), intercept: +intercept.toFixed(2), r2, direction };
  }

  /* -------------------------------------------------------
   *  getZoneEfficiency — EF per training type
   * ------------------------------------------------------- */

  function getZoneEfficiency(activities) {
    const groups = {};
    (activities || []).forEach((act) => {
      const ef = calcEF(act);
      if (ef === null) return;
      const type = classifyTypeSimple(act);
      if (!groups[type]) groups[type] = [];
      groups[type].push(ef);
    });

    const result = {};
    Object.keys(groups).forEach((type) => {
      const arr = groups[type];
      result[type] = {
        avgEF: +(arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2),
        count: arr.length,
        min: +Math.min(...arr).toFixed(2),
        max: +Math.max(...arr).toFixed(2),
      };
    });
    return result;
  }

  /* -------------------------------------------------------
   *  getBestEF — najlepszy EF
   * ------------------------------------------------------- */

  function getBestEF(activities) {
    let best = null;
    (activities || []).forEach((act) => {
      const ef = calcEF(act);
      if (ef === null) return;
      if (!best || ef > best.ef) {
        best = {
          date: act.date || act.start_date,
          ef,
          km: parseFloat(act.distance_km || act.km || 0),
          pace: act.pace || act.avg_pace || null,
          hr: parseFloat(act.avg_hr || act.average_heartrate || 0),
        };
      }
    });
    return best;
  }

  /* -------------------------------------------------------
   *  drawEFChart — canvas scatter plot z trend line
   * ------------------------------------------------------- */

  function drawEFChart(canvas, data, trendLine) {
    if (!canvas || !data || data.length === 0) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    // Rozmiar canvas
    const w = canvas.parentElement
      ? canvas.parentElement.clientWidth
      : 360;
    const h = 220;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.scale(dpr, dpr);

    // Marginesy
    const margin = { top: 15, right: 15, bottom: 35, left: 45 };
    const plotW = w - margin.left - margin.right;
    const plotH = h - margin.top - margin.bottom;

    // Dane → współrzędne
    const baseDate = dayStart(new Date(data[0].date));
    const maxDay = diffDays(new Date(data[data.length - 1].date), baseDate);
    const efValues = data.map((d) => d.ef);
    const minEF = Math.floor(Math.min(...efValues) * 0.9);
    const maxEF = Math.ceil(Math.max(...efValues) * 1.1);

    const scaleX = (dayIdx) =>
      margin.left + (maxDay > 0 ? (dayIdx / maxDay) * plotW : plotW / 2);
    const scaleY = (ef) =>
      margin.top + plotH - ((ef - minEF) / (maxEF - minEF || 1)) * plotH;

    // Tło
    ctx.fillStyle = "#fafafa";
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 0.5;
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const val = minEF + ((maxEF - minEF) / ySteps) * i;
      const y = scaleY(val);
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(w - margin.right, y);
      ctx.stroke();
      // Y axis label
      ctx.fillStyle = "#6b7280";
      ctx.font = "10px -apple-system, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(val.toFixed(0), margin.left - 5, y + 3);
    }

    // X axis labels (co 7 dni)
    ctx.textAlign = "center";
    ctx.fillStyle = "#6b7280";
    for (let d = 0; d <= maxDay; d += 7) {
      const labelDate = new Date(baseDate);
      labelDate.setDate(labelDate.getDate() + d);
      const x = scaleX(d);
      ctx.fillText(formatDate(labelDate), x, h - 5);
      // Tick
      ctx.beginPath();
      ctx.moveTo(x, h - margin.bottom);
      ctx.lineTo(x, h - margin.bottom + 4);
      ctx.strokeStyle = "#9ca3af";
      ctx.stroke();
    }

    // Scatter dots
    data.forEach((d) => {
      const dayIdx = diffDays(new Date(d.date), baseDate);
      const x = scaleX(dayIdx);
      const y = scaleY(d.ef);
      const color = TYPE_COLORS[d.type] || "#6b7280";

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Trend line
    if (trendLine && trendLine.slope !== undefined) {
      const y0 = trendLine.intercept;
      const y1 = trendLine.slope * maxDay + trendLine.intercept;

      ctx.beginPath();
      ctx.moveTo(scaleX(0), scaleY(y0));
      ctx.lineTo(scaleX(maxDay), scaleY(y1));
      ctx.strokeStyle = "#8b5cf6";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Legenda
    const legendY = margin.top;
    let legendX = margin.left + 5;
    ctx.font = "9px -apple-system, sans-serif";
    Object.entries(TYPE_COLORS).forEach(([type, color]) => {
      ctx.fillStyle = color;
      ctx.fillRect(legendX, legendY, 8, 8);
      ctx.fillStyle = "#374151";
      ctx.textAlign = "left";
      ctx.fillText(TYPE_LABELS[type] || type, legendX + 11, legendY + 8);
      legendX += ctx.measureText(TYPE_LABELS[type] || type).width + 20;
    });
  }

  /* -------------------------------------------------------
   *  render — główne renderowanie modułu
   * ------------------------------------------------------- */

  async function render(containerId) {
    console.log(TAG, "Rendering Efficiency Tracker…");
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(TAG, `Kontener #${containerId} nie istnieje`);
      return;
    }
    container.innerHTML = "";

    // Pobierz aktywności
    let activities = [];
    try {
      activities = await DB.getAll();
    } catch (e) {
      console.warn(TAG, "Nie udało się pobrać z DB", e);
    }

    // Header
    container.appendChild(el("h2", "ef-title", "⚡ Cardiac Efficiency"));

    // EF trend data
    const trend = getEFTrend(activities, 90);

    if (trend.length === 0) {
      const emptyCard = el("div", "ef-card ef-empty");
      emptyCard.appendChild(
        el(
          "p",
          "ef-empty-msg",
          "❤️ Brak danych HR — synchronizuj treningi z Apple Watch by zobaczyć Efficiency Factor"
        )
      );
      container.appendChild(emptyCard);
      return;
    }

    // Trend line
    const trendLine = calcTrendLine(trend);

    // === Current EF (ostatni trening) ===
    const latest = trend[trend.length - 1];
    const currentCard = el("div", "ef-card ef-current");

    const efVal = el("span", "ef-value", latest.ef.toFixed(1));
    currentCard.appendChild(efVal);

    // Direction badge
    const dirLabels = {
      improving: "📈 Poprawa",
      stable: "➡️ Stabilnie",
      declining: "📉 Spadek",
    };
    const dirColors = {
      improving: "#22c55e",
      stable: "#3b82f6",
      declining: "#ef4444",
    };
    const dirBadge = el("span", "ef-direction-badge", dirLabels[trendLine.direction]);
    dirBadge.style.backgroundColor = dirColors[trendLine.direction];
    currentCard.appendChild(dirBadge);

    currentCard.appendChild(
      el(
        "p",
        "ef-sub",
        `Trend: ${trendLine.slope > 0 ? "+" : ""}${trendLine.slope.toFixed(3)}/dzień • R² = ${trendLine.r2.toFixed(3)}`
      )
    );
    container.appendChild(currentCard);

    // === Chart ===
    const chartCard = el("div", "ef-card ef-chart-container");
    chartCard.appendChild(el("h3", "ef-card-title", "📊 Trend (90 dni)"));
    const canvas = document.createElement("canvas");
    canvas.className = "ef-canvas";
    chartCard.appendChild(canvas);
    container.appendChild(chartCard);

    // Rysuj chart po dodaniu do DOM (potrzebuje clientWidth)
    requestAnimationFrame(() => {
      drawEFChart(canvas, trend, trendLine);
    });

    // === EF by type ===
    const zoneEF = getZoneEfficiency(activities);
    if (Object.keys(zoneEF).length > 0) {
      const typeCard = el("div", "ef-card ef-by-type");
      typeCard.appendChild(el("h3", "ef-card-title", "🏃 EF wg Typu Treningu"));
      const typeGrid = el("div", "ef-type-grid");

      Object.entries(zoneEF).forEach(([type, data]) => {
        const card = el("div", "ef-type-card");
        card.style.borderLeft = `4px solid ${TYPE_COLORS[type] || "#6b7280"}`;
        card.appendChild(
          el("span", "ef-type-label", TYPE_LABELS[type] || type)
        );
        card.appendChild(el("span", "ef-type-value", data.avgEF.toFixed(1)));
        card.appendChild(
          el(
            "span",
            "ef-type-range",
            `${data.min.toFixed(1)} – ${data.max.toFixed(1)} (n=${data.count})`
          )
        );
        typeGrid.appendChild(card);
      });

      typeCard.appendChild(typeGrid);
      container.appendChild(typeCard);
    }

    // === Best EF ===
    const best = getBestEF(activities);
    if (best) {
      const bestCard = el("div", "ef-card ef-best");
      bestCard.appendChild(el("h3", "ef-card-title", "🏆 Najlepszy EF"));
      const bestGrid = el("div", "ef-best-grid");
      const items = [
        ["EF", best.ef.toFixed(1)],
        ["Data", formatDate(best.date)],
        ["Dystans", `${best.km.toFixed(1)} km`],
        ["Tempo", best.pace || "--"],
        ["HR", best.hr > 0 ? `${best.hr} bpm` : "--"],
      ];
      items.forEach(([k, v]) => {
        const item = el("div", "ef-best-item");
        item.appendChild(el("span", "ef-best-key", k));
        item.appendChild(el("span", "ef-best-val", v));
        bestGrid.appendChild(item);
      });
      bestCard.appendChild(bestGrid);
      container.appendChild(bestCard);
    }

    console.log(TAG, "Efficiency Tracker gotowy ✅");
  }

  /* -------------------------------------------------------
   *  PUBLIC API
   * ------------------------------------------------------- */
  return {
    render,
    calcEF,
    getEFTrend,
    calcEFFromStreams,
    _calcTrendLine: calcTrendLine,
    _getZoneEfficiency: getZoneEfficiency,
    _getBestEF: getBestEF,
  };
})();
