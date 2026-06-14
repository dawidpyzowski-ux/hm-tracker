/* =========================================================
 *  training-compare.js — Training Compare
 *  Sprint 11 · HM Tracker PWA
 *  Porównanie z poprzednim takim samym typem treningu
 * ========================================================= */
const TrainingCompare = (() => {
  "use strict";

  const TAG = "[Compare]";

  /* -------------------------------------------------------
   *  HELPERS
   * ------------------------------------------------------- */

  const dayStart = (d) => {
    const r = new Date(d);
    r.setHours(0, 0, 0, 0);
    return r;
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

  /** Formatuj datę */
  const formatDate = (d) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("pl-PL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  /** Tworzy element DOM */
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /* -------------------------------------------------------
   *  classifyType — klasyfikacja typu treningu
   * ------------------------------------------------------- */

  /**
   * classifyType(act, detail)
   * Zwraca: 'easy' | 'tempo' | 'intervals' | 'long_run' | 'recovery' | 'race'
   *
   * Logika:
   * 1. Jeśli Strava workout_type === 1 → race
   * 2. Jeśli detail ma splits z dużą wariancją pace → intervals
   * 3. Na podstawie pace i dystansu:
   *    - recovery: < 6km i pace > 6:00
   *    - easy: pace > 5:40
   *    - tempo: pace 4:40–5:20
   *    - long_run: dystans > 15km i pace > 5:00
   *    - default: easy
   */
  function classifyType(act, detail) {
    // Strava race flag
    const wt = act.workout_type || act.type;
    if (wt === 1 || wt === "Race" || String(wt).toLowerCase() === "race") {
      return "race";
    }

    const km = parseFloat(act.distance_km || act.km || 0);
    const paceS = parsePace(act.pace || act.avg_pace);

    // Splits variance → intervals detection
    if (detail && detail.splits && detail.splits.length >= 4) {
      const splitPaces = detail.splits
        .map((s) => parsePace(s.pace) || s.average_speed_sec_per_km || null)
        .filter((p) => p !== null);
      if (splitPaces.length >= 4) {
        const mean = splitPaces.reduce((s, v) => s + v, 0) / splitPaces.length;
        const variance =
          splitPaces.reduce((s, v) => s + (v - mean) ** 2, 0) / splitPaces.length;
        const stdDev = Math.sqrt(variance);
        // Jeśli odchylenie standardowe > 20 sek → interwały
        if (stdDev > 20) return "intervals";
      }
    }

    // Heurystyki pace/distance
    if (paceS !== null) {
      if (km < 6 && paceS > 360) return "recovery"; // > 6:00/km
      if (km > 15 && paceS >= 300) return "long_run"; // > 15km i > 5:00
      if (paceS > 340) return "easy"; // > 5:40
      if (paceS >= 280 && paceS <= 320) return "tempo"; // 4:40–5:20
      if (paceS < 280) return "tempo"; // szybki trening
    }

    // Fallback na dystans
    if (km > 15) return "long_run";
    if (km < 5) return "recovery";

    return "easy";
  }

  /** Polskie nazwy typów */
  const TYPE_LABELS = {
    easy: "Łatwy bieg",
    tempo: "Tempo",
    intervals: "Interwały",
    long_run: "Długi bieg",
    recovery: "Regeneracja",
    race: "Wyścig",
  };

  /* -------------------------------------------------------
   *  findPreviousSameType
   * ------------------------------------------------------- */

  /**
   * Znajdź poprzednią aktywność tego samego typu.
   * Sortuje po dacie malejąco, pomija currentSid.
   */
  function findPreviousSameType(currentSid, currentType, allActivities, allDetails) {
    // Sortuj od najnowszych
    const sorted = [...allActivities].sort(
      (a, b) =>
        new Date(b.date || b.start_date) - new Date(a.date || a.start_date)
    );

    for (const act of sorted) {
      const sid = act.sid || act.id;
      if (String(sid) === String(currentSid)) continue;

      const detail = allDetails[sid] || allDetails[String(sid)] || null;
      const type = classifyType(act, detail);
      if (type === currentType) {
        return { activity: act, detail, type };
      }
    }
    return null;
  }

  /* -------------------------------------------------------
   *  comparePair — porównanie dwóch aktywności
   * ------------------------------------------------------- */

  function comparePair(current, previous, currentDetail, previousDetail) {
    const metrics = [];

    /** Dodaj metrykę do listy */
    const addMetric = (name, unit, icon, curVal, prevVal, lowerIsBetter) => {
      if (curVal === null && prevVal === null) return;
      const delta = curVal !== null && prevVal !== null ? +(curVal - prevVal).toFixed(2) : null;
      const deltaPct =
        delta !== null && prevVal !== 0
          ? +(((curVal - prevVal) / Math.abs(prevVal)) * 100).toFixed(1)
          : null;
      let improved = null;
      if (delta !== null) {
        improved = lowerIsBetter ? delta < 0 : delta > 0;
        if (Math.abs(delta) < 0.01) improved = null; // neutralne
      }
      metrics.push({
        name,
        unit,
        icon,
        current: curVal,
        previous: prevVal,
        delta,
        deltaPct,
        improved,
      });
    };

    // Pace (sek/km) — niżej = lepiej
    addMetric(
      "Tempo",
      "/km",
      "⏱️",
      parsePace(current.pace || current.avg_pace),
      parsePace(previous.pace || previous.avg_pace),
      true
    );

    // HR — niżej = lepiej (lepsza wydolność)
    addMetric(
      "Avg HR",
      "bpm",
      "❤️",
      parseFloat(current.avg_hr || current.average_heartrate || 0) || null,
      parseFloat(previous.avg_hr || previous.average_heartrate || 0) || null,
      true
    );

    // Distance — wyżej = lepiej (dla long run)
    addMetric(
      "Dystans",
      "km",
      "📏",
      parseFloat(current.distance_km || current.km || 0) || null,
      parseFloat(previous.distance_km || previous.km || 0) || null,
      false
    );

    // Efficiency = speed / HR
    const calcEF = (act) => {
      const km = parseFloat(act.distance_km || act.km || 0);
      const dMin =
        parseFloat(act.duration_min || act.moving_time_min || 0) ||
        (act.moving_time ? act.moving_time / 60 : 0);
      const hr = parseFloat(act.avg_hr || act.average_heartrate || 0);
      if (km > 0 && dMin > 0 && hr > 0) {
        const speedMPM = (km * 1000) / dMin;
        return +((speedMPM / hr) * 1000).toFixed(1);
      }
      return null;
    };
    addMetric("Efficiency", "EF", "⚡", calcEF(current), calcEF(previous), false);

    // Elevation
    addMetric(
      "Przewyższenie",
      "m",
      "⛰️",
      parseFloat(current.elevation_gain || current.total_elevation_gain || 0) || null,
      parseFloat(previous.elevation_gain || previous.total_elevation_gain || 0) || null,
      false
    );

    // Cadence
    addMetric(
      "Kadencja",
      "spm",
      "🦶",
      parseFloat(current.avg_cadence || current.average_cadence || 0) || null,
      parseFloat(previous.avg_cadence || previous.average_cadence || 0) || null,
      false
    );

    // Duration — niżej = lepiej (szybciej ukończony)
    const curMin =
      parseFloat(current.duration_min || current.moving_time_min || 0) ||
      (current.moving_time ? current.moving_time / 60 : 0);
    const prevMin =
      parseFloat(previous.duration_min || previous.moving_time_min || 0) ||
      (previous.moving_time ? previous.moving_time / 60 : 0);
    addMetric("Czas", "min", "⏳", curMin || null, prevMin || null, true);

    return metrics;
  }

  /* -------------------------------------------------------
   *  compareSplits — porównanie split-by-split
   * ------------------------------------------------------- */

  function compareSplits(currentDetail, previousDetail) {
    if (
      !currentDetail ||
      !previousDetail ||
      !currentDetail.splits ||
      !previousDetail.splits
    ) {
      return null;
    }

    const curSplits = currentDetail.splits;
    const prevSplits = previousDetail.splits;
    const len = Math.min(curSplits.length, prevSplits.length);
    if (len === 0) return null;

    const result = [];
    for (let i = 0; i < len; i++) {
      const curPace =
        parsePace(curSplits[i].pace) ||
        curSplits[i].average_speed_sec_per_km ||
        null;
      const prevPace =
        parsePace(prevSplits[i].pace) ||
        prevSplits[i].average_speed_sec_per_km ||
        null;
      const delta = curPace !== null && prevPace !== null ? curPace - prevPace : null;
      result.push({
        split: i + 1,
        currentPace: curPace,
        previousPace: prevPace,
        delta,
        improved: delta !== null ? delta < 0 : null,
      });
    }
    return result;
  }

  /* -------------------------------------------------------
   *  render — główne renderowanie porównania
   * ------------------------------------------------------- */

  async function render(activitySid, containerId) {
    console.log(TAG, `Rendering comparison for activity ${activitySid}`);
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(TAG, `Kontener #${containerId} nie istnieje`);
      return;
    }
    container.innerHTML = "";

    // Pobierz dane z DB
    let allActivities = [];
    let currentAct = null;
    let currentDetail = null;
    const allDetails = {};

    try {
      allActivities = await DB.getAll();
      currentAct = allActivities.find(
        (a) => String(a.sid || a.id) === String(activitySid)
      );
      if (!currentAct) {
        container.appendChild(
          el("p", "compare-error", "❌ Nie znaleziono aktywności")
        );
        return;
      }
      currentDetail = await DB.getDetail(activitySid);
      // Pobierz detale wszystkich aktywności (cache)
      for (const act of allActivities) {
        const sid = act.sid || act.id;
        try {
          allDetails[sid] = await DB.getDetail(sid);
        } catch (_) {
          allDetails[sid] = null;
        }
      }
    } catch (e) {
      console.error(TAG, "Błąd pobierania danych z DB", e);
      container.appendChild(
        el("p", "compare-error", "❌ Błąd pobierania danych")
      );
      return;
    }

    // Klasyfikacja typu bieżącego treningu
    const currentType = classifyType(currentAct, currentDetail);
    const typeLabel = TYPE_LABELS[currentType] || currentType;

    // Tytuł
    container.appendChild(
      el("h2", "compare-title", `🔄 Porównanie — ${typeLabel}`)
    );

    // Znajdź poprzedni taki sam typ
    const prev = findPreviousSameType(
      activitySid,
      currentType,
      allActivities,
      allDetails
    );

    if (!prev) {
      const msgCard = el("div", "compare-card compare-empty");
      msgCard.appendChild(
        el("p", "compare-empty-msg", `🎉 Pierwszy trening typu "${typeLabel}"!`)
      );
      msgCard.appendChild(
        el(
          "p",
          "compare-empty-sub",
          "Następnym razem zobaczysz tu porównanie z dzisiejszym treningiem."
        )
      );
      container.appendChild(msgCard);
      return;
    }

    const prevAct = prev.activity;
    const prevDetail = prev.detail;

    // === Side-by-side header cards ===
    const headerRow = el("div", "compare-header-row");

    const buildHeader = (act, label) => {
      const card = el("div", "compare-header-card");
      card.appendChild(el("span", "compare-header-label", label));
      card.appendChild(
        el("span", "compare-header-date", formatDate(act.date || act.start_date))
      );
      card.appendChild(
        el(
          "span",
          "compare-header-info",
          `${parseFloat(act.distance_km || act.km || 0).toFixed(1)} km • ${act.pace || act.avg_pace || "--"}/km`
        )
      );
      return card;
    };

    headerRow.appendChild(buildHeader(currentAct, "📍 Aktualny"));
    headerRow.appendChild(buildHeader(prevAct, "📍 Poprzedni"));
    container.appendChild(headerRow);

    // === Delta table ===
    const metrics = comparePair(currentAct, prevAct, currentDetail, prevDetail);

    const table = el("div", "compare-delta-table");
    const tableHeader = el("div", "compare-delta-row compare-delta-header");
    ["", "Metryka", "Teraz", "Poprz.", "Δ", "%"].forEach((t) => {
      tableHeader.appendChild(el("span", "compare-delta-cell", t));
    });
    table.appendChild(tableHeader);

    let improved = 0;
    let regressed = 0;
    let total = 0;

    metrics.forEach((m) => {
      if (m.current === null && m.previous === null) return;
      total++;

      const row = el("div", "compare-delta-row");

      // Status icon
      let statusCls = "compare-neutral";
      let statusIcon = "➖";
      if (m.improved === true) {
        statusCls = "compare-improved";
        statusIcon = "✅";
        improved++;
      } else if (m.improved === false) {
        statusCls = "compare-regressed";
        statusIcon = "🔻";
        regressed++;
      }
      row.classList.add(statusCls);

      row.appendChild(el("span", "compare-delta-cell", m.icon));
      row.appendChild(el("span", "compare-delta-cell compare-delta-name", m.name));

      // Format wartości — specjalny dla pace (M:SS)
      const fmtVal = (v) => {
        if (v === null) return "--";
        if (m.name === "Tempo") return formatPace(v);
        if (m.name === "Czas") return v.toFixed(1);
        return typeof v === "number" ? v.toFixed(1) : v;
      };

      row.appendChild(el("span", "compare-delta-cell", fmtVal(m.current)));
      row.appendChild(el("span", "compare-delta-cell", fmtVal(m.previous)));

      // Delta
      let deltaStr = "--";
      if (m.delta !== null) {
        const sign = m.delta > 0 ? "+" : "";
        if (m.name === "Tempo") {
          deltaStr = `${sign}${m.delta.toFixed(0)}s`;
        } else {
          deltaStr = `${sign}${m.delta.toFixed(1)}`;
        }
      }
      row.appendChild(el("span", "compare-delta-cell", deltaStr));

      // Delta %
      row.appendChild(
        el(
          "span",
          "compare-delta-cell",
          m.deltaPct !== null ? `${m.deltaPct > 0 ? "+" : ""}${m.deltaPct}%` : "--"
        )
      );

      table.appendChild(row);
    });

    container.appendChild(table);

    // === Split-by-split comparison ===
    const splitComp = compareSplits(currentDetail, prevDetail);
    if (splitComp && splitComp.length > 0) {
      const splitCard = el("div", "compare-card compare-splits");
      splitCard.appendChild(
        el("h3", "compare-splits-title", "📊 Porównanie splitów (km)")
      );

      const splitTable = el("div", "compare-split-table");
      const splitHeader = el("div", "compare-split-row compare-split-header");
      ["km", "Teraz", "Poprz.", "Δ"].forEach((t) =>
        splitHeader.appendChild(el("span", "compare-split-cell", t))
      );
      splitTable.appendChild(splitHeader);

      splitComp.forEach((s) => {
        const row = el("div", "compare-split-row");
        if (s.improved === true) row.classList.add("compare-improved");
        else if (s.improved === false) row.classList.add("compare-regressed");

        row.appendChild(el("span", "compare-split-cell", `${s.split}`));
        row.appendChild(
          el("span", "compare-split-cell", formatPace(s.currentPace))
        );
        row.appendChild(
          el("span", "compare-split-cell", formatPace(s.previousPace))
        );

        let dStr = "--";
        if (s.delta !== null) {
          const sign = s.delta > 0 ? "+" : "";
          dStr = `${sign}${s.delta.toFixed(0)}s`;
        }
        row.appendChild(el("span", "compare-split-cell", dStr));
        splitTable.appendChild(row);
      });

      splitCard.appendChild(splitTable);
      container.appendChild(splitCard);
    }

    // === Podsumowanie ===
    const summaryCard = el("div", "compare-card compare-summary");
    let summaryText;
    if (improved > regressed) {
      summaryText = `💪 Poprawiłeś ${improved} z ${total} metryk — tak trzymaj!`;
    } else if (regressed > improved) {
      summaryText = `📉 Regres w ${regressed} z ${total} metryk — nie martw się, to normalne.`;
    } else {
      summaryText = `📊 Stabilna forma — ${improved} metryk lepszych, ${regressed} słabszych.`;
    }
    summaryCard.appendChild(el("p", "compare-summary-text", summaryText));
    container.appendChild(summaryCard);

    console.log(TAG, "Porównanie gotowe ✅");
  }

  /* -------------------------------------------------------
   *  PUBLIC API
   * ------------------------------------------------------- */
  return {
    render,
    comparePair,
    classifyType,
    _findPreviousSameType: findPreviousSameType,
    _compareSplits: compareSplits,
    _TYPE_LABELS: TYPE_LABELS,
  };
})();
