/* =========================================================
 *  briefing.js — Pre-Run Briefing + Injury Risk Engine
 *  Sprint 11 · HM Tracker PWA
 *  Autor: Dawid P. | cel: HM 6 wrz 2026, 4:59/km
 * ========================================================= */
const Briefing = (() => {
  "use strict";

  const TAG = "[Briefing]";

  /* -------------------------------------------------------
   *  HELPERS
   * ------------------------------------------------------- */

  /** Zwraca Date z wyzerowanym czasem (YYYY-MM-DD) */
  const dayStart = (d) => {
    const r = new Date(d);
    r.setHours(0, 0, 0, 0);
    return r;
  };

  /** Dziś jako YYYY-MM-DD */
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  /** Parsuj pace "M:SS" → sek/km */
  const parsePace = (paceStr) => {
    if (!paceStr) return null;
    const parts = String(paceStr).split(":");
    if (parts.length !== 2) return null;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  };

  /** Sek/km → "M:SS" */
  const formatPace = (s) => {
    if (!s || !isFinite(s)) return "--:--";
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  /** Minuty → "Xh YYm" */
  const formatTime = (min) => {
    if (!min) return "--";
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
  };

  /** Clamp wartość do zakresu */
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** Różnica dni między dwoma Date */
  const diffDays = (a, b) =>
    Math.round(Math.abs(dayStart(a) - dayStart(b)) / 86400000);

  /* -------------------------------------------------------
   *  INJURY RISK ENGINE
   * ------------------------------------------------------- */

  /**
   * activityLoad — TRIMP-like obciążenie treningowe
   * Formuła: duration_min × normHR
   *   normHR = clamp((avgHR − 55) / (190 − 55), 0.5, 1.0)
   * Fallback (brak HR): km × 10
   */
  function activityLoad(act) {
    const km = parseFloat(act.distance_km || act.km || 0);
    const durationMin =
      parseFloat(act.duration_min || act.moving_time_min || 0) ||
      (act.moving_time ? act.moving_time / 60 : 0);
    const avgHR = parseFloat(act.avg_hr || act.average_heartrate || 0);

    if (avgHR > 0 && durationMin > 0) {
      const normHR = clamp((avgHR - 55) / (190 - 55), 0.5, 1.0);
      return +(durationMin * normHR).toFixed(1);
    }
    // Fallback — brak HR
    return +(km * 10).toFixed(1);
  }

  /**
   * calcACWR — Acute:Chronic Workload Ratio
   * acute  = suma load z ostatnich 7 dni
   * chronic = średnia tygodniowa z 28 dni (suma/4)
   * ratio  = acute / chronic
   * Zones: <0.8 undertrained | 0.8-1.3 optimal | 1.3-1.5 caution | >1.5 danger
   */
  function calcACWR(activities) {
    const now = dayStart(new Date());
    let acute = 0;
    let chronic = 0;

    (activities || []).forEach((act) => {
      const d = dayStart(new Date(act.date || act.start_date));
      const age = diffDays(now, d);
      const load = activityLoad(act);
      if (age < 7) acute += load;
      if (age < 28) chronic += load;
    });

    const chronicWeekly = chronic / 4; // avg tygodniowy
    const ratio =
      chronicWeekly > 0 ? +(acute / chronicWeekly).toFixed(2) : 0;

    let zone, color;
    if (ratio < 0.8) {
      zone = "undertrained";
      color = "#3b82f6";
    } else if (ratio <= 1.3) {
      zone = "optimal";
      color = "#22c55e";
    } else if (ratio <= 1.5) {
      zone = "caution";
      color = "#f59e0b";
    } else {
      zone = "danger";
      color = "#ef4444";
    }

    return { acute: +acute.toFixed(1), chronic: +chronicWeekly.toFixed(1), ratio, zone, color };
  }

  /**
   * consecutiveDays — ile dni z rzędu trenowałeś (od dziś wstecz)
   */
  function consecutiveDays(activities) {
    const now = dayStart(new Date());
    const dateSet = new Set();
    (activities || []).forEach((act) => {
      dateSet.add(dayStart(new Date(act.date || act.start_date)).getTime());
    });

    let count = 0;
    for (let i = 0; i < 365; i++) {
      const check = new Date(now);
      check.setDate(check.getDate() - i);
      if (dateSet.has(dayStart(check).getTime())) {
        count++;
      } else {
        break;
      }
    }
    return { count, alert: count >= 3 };
  }

  /**
   * volumeSpike — km w tym tygodniu vs średnia 4 tygodni
   */
  function volumeSpike(activities) {
    const now = dayStart(new Date());
    const monday = new Date(now);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7)); // poniedziałek

    let thisWeek = 0;
    const weeklyKm = [0, 0, 0, 0]; // 4 poprzednie pełne tygodnie

    (activities || []).forEach((act) => {
      const d = dayStart(new Date(act.date || act.start_date));
      const km = parseFloat(act.distance_km || act.km || 0);
      const age = diffDays(monday, d);

      if (d >= monday) {
        thisWeek += km;
      } else if (age < 7) {
        weeklyKm[0] += km;
      } else if (age < 14) {
        weeklyKm[1] += km;
      } else if (age < 21) {
        weeklyKm[2] += km;
      } else if (age < 28) {
        weeklyKm[3] += km;
      }
    });

    const avg4w = weeklyKm.reduce((s, v) => s + v, 0) / 4;
    const spikePercent =
      avg4w > 0 ? +(((thisWeek - avg4w) / avg4w) * 100).toFixed(1) : 0;

    return {
      thisWeek: +thisWeek.toFixed(1),
      avg4w: +avg4w.toFixed(1),
      spikePercent,
      alert: spikePercent > 30,
    };
  }

  /**
   * getInjuryRisk — łączna ocena ryzyka kontuzji
   * Zwraca: { level, alerts[], color, acwr, consecutive, spike }
   */
  function getInjuryRisk(activities) {
    const acwr = calcACWR(activities);
    const consec = consecutiveDays(activities);
    const spike = volumeSpike(activities);
    const alerts = [];
    let score = 0; // 0–100, wyżej = gorzej

    // ACWR
    if (acwr.zone === "danger") {
      score += 40;
      alerts.push(`⚠️ ACWR ${acwr.ratio} — strefa niebezpieczna`);
    } else if (acwr.zone === "caution") {
      score += 20;
      alerts.push(`⚡ ACWR ${acwr.ratio} — uwaga, rosnące obciążenie`);
    } else if (acwr.zone === "undertrained") {
      score += 10;
      alerts.push(`🔵 ACWR ${acwr.ratio} — niski trening, ryzyko nagłego wzrostu`);
    }

    // Consecutive days
    if (consec.count >= 5) {
      score += 25;
      alerts.push(`🔴 ${consec.count} dni z rzędu bez odpoczynku!`);
    } else if (consec.count >= 3) {
      score += 10;
      alerts.push(`🟡 ${consec.count} dni z rzędu — rozważ rest day`);
    }

    // Volume spike
    if (spike.spikePercent > 50) {
      score += 35;
      alerts.push(`🔴 Volume spike +${spike.spikePercent}% — duże ryzyko!`);
    } else if (spike.spikePercent > 30) {
      score += 15;
      alerts.push(`🟡 Volume spike +${spike.spikePercent}% — przekroczony próg 30%`);
    }

    let level, color;
    if (score >= 60) {
      level = "critical";
      color = "#dc2626";
    } else if (score >= 35) {
      level = "high";
      color = "#ef4444";
    } else if (score >= 15) {
      level = "moderate";
      color = "#f59e0b";
    } else {
      level = "low";
      color = "#22c55e";
    }

    if (alerts.length === 0) alerts.push("✅ Brak alertów — możesz trenować!");

    return { level, alerts, color, acwr, consecutive: consec, spike };
  }

  /* -------------------------------------------------------
   *  PRE-RUN BRIEFING — dane
   * ------------------------------------------------------- */

  /** Dzisiejszy plan treningowy z window.PLAN_FLAT */
  
function getTodayPlan() {
  try {
    const plan = window.PLAN_FLAT || [];
    const today = todayISO();

    // 1. Plan na dziś
    let entry = plan.find(p => p.date === today);

    if (!entry) return null;

    // 2. Sprawdź log dziś
    const logToday = S.getLog(today);
    if (logToday && logToday.distance) {
      entry._status = "done";
      entry._logDate = today;
      return entry;
    }

    // 3. SHIFT CHECK (wczoraj / -2 dni)
    for (let i = 1; i <= 2; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const prevDate = d.toISOString().slice(0, 10);

      const log = S.getLog(prevDate);
      if (log && log.distance) {
        const ratio = parseFloat(log.distance) / entry.km;

        // sensowny match
        if (ratio > 0.7 && ratio < 1.4) {
          entry._status = "moved";
          entry._logDate = prevDate;
          return entry;
        }
      }
    }

    // 4. Nie zrobiony
    entry._status = "pending";
    return entry;

  } catch (e) {
    console.warn(TAG, "PLAN_FLAT error", e);
    return null;
  }
}


  /**
   * getRecentForm — statystyki z ostatnich N dni + porównanie z poprzednim okresem
   */
  function getRecentForm(activities, days = 7) {
    const now = dayStart(new Date());
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffPrev = new Date(cutoff);
    cutoffPrev.setDate(cutoffPrev.getDate() - days);

    const recent = [];
    const prior = [];

    (activities || []).forEach((act) => {
      const d = dayStart(new Date(act.date || act.start_date));
      if (d >= cutoff && d <= now) recent.push(act);
      else if (d >= cutoffPrev && d < cutoff) prior.push(act);
    });

    const stats = (arr) => {
      const totalKm = arr.reduce(
        (s, a) => s + parseFloat(a.distance_km || a.km || 0),
        0
      );
      const sessions = arr.length;
      const hrs = arr
        .map((a) => parseFloat(a.avg_hr || a.average_heartrate || 0))
        .filter((h) => h > 0);
      const avgHR = hrs.length > 0
        ? Math.round(hrs.reduce((s, v) => s + v, 0) / hrs.length)
        : null;
      const paces = arr
        .map((a) => parsePace(a.pace || a.avg_pace))
        .filter((p) => p);
      const avgPace = paces.length > 0
        ? Math.round(paces.reduce((s, v) => s + v, 0) / paces.length)
        : null;
      return { totalKm: +totalKm.toFixed(1), sessions, avgHR, avgPace };
    };

    const curr = stats(recent);
    const prev = stats(prior);

    // Trendy (km delta, sessions delta)
    const kmDelta = prev.totalKm > 0
      ? +(((curr.totalKm - prev.totalKm) / prev.totalKm) * 100).toFixed(1)
      : null;

    return { current: curr, previous: prev, kmDelta, days };
  }

  /**
   * getReadinessScore — 0-100: gotowość do treningu
   * 100 = w pełni gotowy, 0 = lepiej odpocząć
   */
  function getReadinessScore(injuryRisk, recentForm) {
    let score = 100;

    // Ryzyko kontuzji obniża wynik
    const riskPenalty = {
      low: 0,
      moderate: 15,
      high: 35,
      critical: 55,
    };
    score -= riskPenalty[injuryRisk.level] || 0;

    // Zbyt dużo treningów ostatnio (>5 sesji w 7 dni)
    if (recentForm.current.sessions > 5) score -= 15;
    else if (recentForm.current.sessions > 4) score -= 5;

    // Volume trend — duży wzrost obniża
    if (recentForm.kmDelta !== null && recentForm.kmDelta > 40) score -= 10;

    return clamp(Math.round(score), 0, 100);
  }

  /* -------------------------------------------------------
   *  PRE-RUN BRIEFING — rendering
   * ------------------------------------------------------- */

  /** Tworzenie elementu DOM z klasami i tekstem */
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /** SVG arc path helper (do gauges) */
  function arcPath(cx, cy, r, startAngle, endAngle) {
    const rad = (a) => ((a - 90) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(rad(startAngle));
    const y1 = cy + r * Math.sin(rad(startAngle));
    const x2 = cx + r * Math.cos(rad(endAngle));
    const y2 = cy + r * Math.sin(rad(endAngle));
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  }

  /** Renderuj SVG circular gauge (0-100) */
  function renderGauge(value, color, label, size = 100) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 120 120");
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.style.display = "block";
    svg.style.margin = "0 auto";

    // Tło łuku
    const bgArc = document.createElementNS(ns, "path");
    bgArc.setAttribute("d", arcPath(60, 60, 48, 0, 360));
    bgArc.setAttribute("fill", "none");
    bgArc.setAttribute("stroke", "#e5e7eb");
    bgArc.setAttribute("stroke-width", "8");
    bgArc.setAttribute("stroke-linecap", "round");
    svg.appendChild(bgArc);

    // Wartość łuku
    const angle = (clamp(value, 0, 100) / 100) * 360;
    if (angle > 0) {
      const valArc = document.createElementNS(ns, "path");
      valArc.setAttribute("d", arcPath(60, 60, 48, 0, Math.min(angle, 359.9)));
      valArc.setAttribute("fill", "none");
      valArc.setAttribute("stroke", color);
      valArc.setAttribute("stroke-width", "8");
      valArc.setAttribute("stroke-linecap", "round");
      svg.appendChild(valArc);
    }

    // Tekst — wartość
    const txt = document.createElementNS(ns, "text");
    txt.setAttribute("x", "60");
    txt.setAttribute("y", "58");
    txt.setAttribute("text-anchor", "middle");
    txt.setAttribute("font-size", "28");
    txt.setAttribute("font-weight", "bold");
    txt.setAttribute("fill", color);
    txt.textContent = value;
    svg.appendChild(txt);

    // Tekst — label
    const lbl = document.createElementNS(ns, "text");
    lbl.setAttribute("x", "60");
    lbl.setAttribute("y", "78");
    lbl.setAttribute("text-anchor", "middle");
    lbl.setAttribute("font-size", "10");
    lbl.setAttribute("fill", "#6b7280");
    lbl.textContent = label;
    svg.appendChild(lbl);

    return svg;
  }

  /** Renderuj progress bar */
  function renderBar(value, max, color, label) {
    const wrap = el("div", "briefing-bar-wrap");
    const lbl = el("div", "briefing-bar-label", label);
    wrap.appendChild(lbl);
    const track = el("div", "briefing-bar-track");
    const fill = el("div", "briefing-bar-fill");
    const pct = max > 0 ? clamp((value / max) * 100, 0, 100) : 0;
    fill.style.width = pct + "%";
    fill.style.backgroundColor = color;
    track.appendChild(fill);
    wrap.appendChild(track);
    return wrap;
  }

  /* -------------------------------------------------------
   *  render() — główna funkcja budująca dashboard
   * ------------------------------------------------------- */
  async function render(containerId) {
    console.log(TAG, "Rendering pre-run briefing…");
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(TAG, `Kontener #${containerId} nie istnieje`);
      return;
    }
    container.innerHTML = "";

    // Pobierz aktywności z DB
    let activities = [];
    try {
      activities = await DB.getAll();
    } catch (e) {
      console.warn(TAG, "Nie udało się pobrać aktywności z DB", e);
    }

    // === SEKCJA: Dzisiejszy Plan ===
    const planCard = el("div", "briefing-card briefing-plan");
    const planTitle = el("h3", "briefing-card-title", "📋 Dzisiejszy Plan");
    planCard.appendChild(planTitle);


    const plan = getTodayPlan();
    if (plan) {
      if (plan._status === "moved" || plan._status === "done") {
        planCard.appendChild(
          el("p", "briefing-ok", `✅ Trening wykonany (${plan._logDate})`)
        );
        planCard.appendChild(
          el("p", "briefing-reco", "➡️ Rekomendacja na dziś: recovery / easy run")
        );
      } else {
        const planGrid = el("div", "briefing-plan-grid");
        const fields = [
          ["Typ", plan.type || "--"],
          ["Dystans", plan.km ? `${plan.km} km` : "--"],
          ["Tempo", plan.pace || "--"],
          ["Strefa HR", plan.hr_zone || "--"],
        ];
        fields.forEach(([k, v]) => {
          const item = el("div", "briefing-plan-item");
          item.appendChild(el("span", "briefing-plan-key", k));
          item.appendChild(el("span", "briefing-plan-val", v));
          planGrid.appendChild(item);
        });
        planCard.appendChild(planGrid);
        if (plan.notes) {
          planCard.appendChild(el("p", "briefing-plan-notes", `📝 ${plan.notes}`));
        }
        planCard.appendChild(el("p", "briefing-warning", "⏳ Trening jeszcze nie wykonany"));
      }
    } else {
      planCard.appendChild(el("p", "briefing-rest", "😴 Brak planu"));
    }
    container.appendChild(planCard);

    // === SEKCJA: Pogoda i ubiór ===
    try {
      if (typeof Weather !== "undefined" && Weather.getCurrent) {
        const weatherCard = el("div", "briefing-card briefing-weather");
        weatherCard.appendChild(el("h3", "briefing-card-title", "🌤️ Pogoda i Ubiór"));
        const current = await Weather.getCurrent();
        if (current) {
          const info = el("div", "briefing-weather-info");
          info.appendChild(
            el("span", null, `${current.temp}°C  ${current.description || ""}`)
          );
          if (current.wind) info.appendChild(el("span", null, `💨 ${current.wind} km/h`));
          if (current.humidity) info.appendChild(el("span", null, `💧 ${current.humidity}%`));
          weatherCard.appendChild(info);
        }
        if (Weather.getAdvisor) {
          const advisor = await Weather.getAdvisor();
          if (advisor && advisor.clothing) {
            weatherCard.appendChild(el("p", "briefing-clothing", `👕 ${advisor.clothing}`));
          }
          if (advisor && advisor.notes) {
            weatherCard.appendChild(el("p", "briefing-weather-note", advisor.notes));
          }
        }
        container.appendChild(weatherCard);
      }
    } catch (e) {
      console.warn(TAG, "Moduł Weather niedostępny", e);
    }

    // === SEKCJA: Injury Risk ===
    const risk = getInjuryRisk(activities);
    const riskCard = el("div", "briefing-card briefing-risk");
    riskCard.appendChild(el("h3", "briefing-card-title", "🛡️ Ryzyko Kontuzji"));

    const riskRow = el("div", "briefing-risk-row");

    // ACWR gauge
    const acwrGaugeVal = clamp(Math.round(risk.acwr.ratio * 50), 0, 100); // ~1.0 → 50
    riskRow.appendChild(renderGauge(risk.acwr.ratio, risk.acwr.color, `ACWR — ${risk.acwr.zone}`, 90));

    riskCard.appendChild(riskRow);

    // Volume spike bar
    riskCard.appendChild(
      renderBar(
        risk.spike.thisWeek,
        Math.max(risk.spike.avg4w * 1.3, risk.spike.thisWeek, 1),
        risk.spike.alert ? "#ef4444" : "#22c55e",
        `📊 Volume: ${risk.spike.thisWeek} km (avg ${risk.spike.avg4w} km, ${risk.spike.spikePercent > 0 ? "+" : ""}${risk.spike.spikePercent}%)`
      )
    );

    // Consecutive days
    riskCard.appendChild(
      el(
        "p",
        risk.consecutive.alert ? "briefing-risk-alert" : "briefing-risk-ok",
        `📅 Dni z rzędu: ${risk.consecutive.count}`
      )
    );

    // Alerty
    const alertList = el("ul", "briefing-alert-list");
    risk.alerts.forEach((a) => {
      alertList.appendChild(el("li", null, a));
    });
    riskCard.appendChild(alertList);

    // Ogólny level badge
    const badge = el("span", `briefing-risk-badge risk-${risk.level}`, risk.level.toUpperCase());
    badge.style.backgroundColor = risk.color;
    riskCard.insertBefore(badge, riskCard.children[1]); // po tytule
    container.appendChild(riskCard);

    // === SEKCJA: Ostatnia forma (7 dni) ===
    const form = getRecentForm(activities, 7);
    const formCard = el("div", "briefing-card briefing-form");
    formCard.appendChild(el("h3", "briefing-card-title", "📈 Forma (ostatnie 7 dni)"));

    const formGrid = el("div", "briefing-form-grid");
    const formItems = [
      ["🏃 Dystans", `${form.current.totalKm} km`],
      ["📅 Sesje", `${form.current.sessions}`],
      ["⏱️ Avg Pace", formatPace(form.current.avgPace)],
      ["❤️ Avg HR", form.current.avgHR ? `${form.current.avgHR} bpm` : "--"],
    ];
    formItems.forEach(([k, v]) => {
      const item = el("div", "briefing-form-item");
      item.appendChild(el("span", "briefing-form-key", k));
      item.appendChild(el("span", "briefing-form-val", v));
      formGrid.appendChild(item);
    });
    formCard.appendChild(formGrid);

    if (form.kmDelta !== null) {
      const trend = form.kmDelta > 0 ? `↑ +${form.kmDelta}%` : `↓ ${form.kmDelta}%`;
      const trendCls = form.kmDelta > 20 ? "trend-up-alert" : form.kmDelta > 0 ? "trend-up" : "trend-down";
      formCard.appendChild(el("p", `briefing-trend ${trendCls}`, `vs poprzedni tydzień: ${trend}`));
    }
    container.appendChild(formCard);

    // === SEKCJA: Readiness Score ===
    const readiness = getReadinessScore(risk, form);
    const readyCard = el("div", "briefing-card briefing-readiness");
    readyCard.appendChild(el("h3", "briefing-card-title", "🎯 Gotowość do Treningu"));

    const readyColor =
      readiness >= 80 ? "#22c55e" : readiness >= 50 ? "#f59e0b" : "#ef4444";
    readyCard.appendChild(renderGauge(readiness, readyColor, "Readiness", 120));

    let readyMsg;
    if (readiness >= 80) readyMsg = "💪 Jesteś gotowy — daj z siebie wszystko!";
    else if (readiness >= 50) readyMsg = "⚡ Uważaj na intensywność — słuchaj ciała.";
    else readyMsg = "🛑 Rozważ lżejszy trening lub odpoczynek.";
    readyCard.appendChild(el("p", "briefing-readiness-msg", readyMsg));
    container.appendChild(readyCard);

    console.log(TAG, "Dashboard gotowy ✅");
  }

  /* -------------------------------------------------------
   *  PUBLIC API
   * ------------------------------------------------------- */
  return {
    render,
    getInjuryRisk,
    calcACWR,
    // Eksporty do testów / innych modułów
    _activityLoad: activityLoad,
    _consecutiveDays: consecutiveDays,
    _volumeSpike: volumeSpike,
    _getRecentForm: getRecentForm,
    _getReadinessScore: getReadinessScore,
    _getTodayPlan: getTodayPlan,
  };
})();
