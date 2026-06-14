/* =========================================================
 *  training-compare.js — Training Compare (v2 — fixed splits + selector)
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

  /** Convert average_speed (m/s) → pace sec/km */
  const speedToPace = (speed) => {
    if (!speed || speed <= 0) return null;
    return Math.round(1000 / speed);
  };

  /** Parse pace "M:SS" → sec/km */
  const parsePace = (paceStr) => {
    if (!paceStr) return null;
    const parts = String(paceStr).split(":");
    if (parts.length !== 2) return null;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  };

  /** Sec/km → "M:SS" */
  const formatPace = (s) => {
    if (!s || !isFinite(s)) return "--:--";
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  /** Format date */
  const formatDate = (d) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("pl-PL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  /** Create DOM element */
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /* -------------------------------------------------------
   *  classifyType — klasyfikacja typu treningu
   * ------------------------------------------------------- */

  function classifyType(act, detail) {
    // Strava race flag
    const wt = act.workout_type || act.type;
    if (wt === 1 || wt === "Race" || String(wt).toLowerCase() === "race") {
      return "race";
    }

    const km = parseFloat(act.distance_km || act.km || 0);
    const paceS = parsePace(act.pace || act.avg_pace);

    // Splits variance → intervals detection (uses average_speed m/s)
    const splits = detail && detail.splits ? detail.splits : null;
    if (splits && splits.length >= 4) {
      const speeds = splits
        .map((s) => s.average_speed || null)
        .filter((s) => s !== null && s > 0);
      if (speeds.length >= 4) {
        const mean = speeds.reduce((sum, v) => sum + v, 0) / speeds.length;
        const variance =
          speeds.reduce((sum, v) => sum + (v - mean) ** 2, 0) / speeds.length;
        const stdDev = Math.sqrt(variance);
        // Jeśli odchylenie standardowe w speed > 0.3 m/s → interwały
        if (stdDev > 0.3) return "intervals";
      }
    }

    // Heurystyki pace/distance
    if (paceS !== null) {
      if (km < 6 && paceS > 360) return "recovery";
      if (km > 15 && paceS >= 300) return "long_run";
      if (paceS > 340) return "easy";
      if (paceS >= 280 && paceS <= 320) return "tempo";
      if (paceS < 280) return "tempo";
    }

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

  function findPreviousSameType(currentSid, currentType, allActivities, allDetails) {
    const sorted = [...allActivities].sort(
      (a, b) =>
        new Date(b.date || b.start_date) - new Date(a.date || a.start_date)
    );

    let foundCurrent = false;
    for (const act of sorted) {
      const sid = act.sid || act.id;
      if (String(sid) === String(currentSid)) {
        foundCurrent = true;
        continue;
      }
      // Only look at activities BEFORE current one
      if (!foundCurrent) continue;

      const detail = allDetails[sid] || allDetails[String(sid)] || null;
      const type = classifyType(act, detail);
      if (type === currentType) {
        return { activity: act, detail, type };
      }
    }

    // Fallback: if currentSid wasn't found in sorted list, search all
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
        if (Math.abs(delta) < 0.01) improved = null;
      }
      metrics.push({ name, unit, icon, current: curVal, previous: prevVal, delta, deltaPct, improved });
    };

    // Pace
    addMetric("Tempo", "/km", "⏱️",
      parsePace(current.pace || current.avg_pace),
      parsePace(previous.pace || previous.avg_pace),
      true
    );

    // HR
    addMetric("Avg HR", "bpm", "❤️",
      parseFloat(current.avg_hr || current.average_heartrate || 0) || null,
      parseFloat(previous.avg_hr || previous.average_heartrate || 0) || null,
      true
    );

    // Distance
    addMetric("Dystans", "km", "📏",
      parseFloat(current.distance_km || current.km || 0) || null,
      parseFloat(previous.distance_km || previous.km || 0) || null,
      false
    );

    // Efficiency
    const calcEF = (act) => {
      const km = parseFloat(act.distance_km || act.km || 0);
      const dMin = parseFloat(act.duration_min || act.moving_time_min || 0) || (act.moving_time ? act.moving_time / 60 : 0);
      const hr = parseFloat(act.avg_hr || act.average_heartrate || 0);
      if (km > 0 && dMin > 0 && hr > 0) {
        const speedMPM = (km * 1000) / dMin;
        return +((speedMPM / hr) * 1000).toFixed(1);
      }
      return null;
    };
    addMetric("Efficiency", "EF", "⚡", calcEF(current), calcEF(previous), false);

    // Duration
    const curMin = parseFloat(current.duration_min || current.moving_time_min || 0) || (current.moving_time ? current.moving_time / 60 : 0);
    const prevMin = parseFloat(previous.duration_min || previous.moving_time_min || 0) || (previous.moving_time ? previous.moving_time / 60 : 0);
    addMetric("Czas", "min", "⏳", curMin || null, prevMin || null, true);

    return metrics;
  }

  /* -------------------------------------------------------
   *  compareSplits — uses average_speed from Strava splits
   * ------------------------------------------------------- */

  function compareSplits(currentDetail, previousDetail) {
    if (!currentDetail || !previousDetail || !currentDetail.splits || !previousDetail.splits) {
      return null;
    }

    const curSplits = currentDetail.splits;
    const prevSplits = previousDetail.splits;
    const len = Math.min(curSplits.length, prevSplits.length);
    if (len === 0) return null;

    const result = [];
    for (let i = 0; i < len; i++) {
      // Convert average_speed (m/s) → pace (sec/km)
      const curPace = curSplits[i].average_speed ? speedToPace(curSplits[i].average_speed) : null;
      const prevPace = prevSplits[i].average_speed ? speedToPace(prevSplits[i].average_speed) : null;

      const curHR = curSplits[i].average_heartrate ? Math.round(curSplits[i].average_heartrate) : null;
      const prevHR = prevSplits[i].average_heartrate ? Math.round(prevSplits[i].average_heartrate) : null;

      const delta = curPace !== null && prevPace !== null ? curPace - prevPace : null;
      result.push({
        split: i + 1,
        currentPace: curPace,
        previousPace: prevPace,
        currentHR: curHR,
        previousHR: prevHR,
        delta,
        improved: delta !== null ? delta < 0 : null, // lower pace = faster = better
      });
    }
    return result;
  }

  /* -------------------------------------------------------
   *  renderSelector — dropdown do wyboru aktywności
   * ------------------------------------------------------- */

  function renderSelector(allActivities, selectedSid, containerId, allDetails) {
    const wrap = el("div", "compare-selector");
    const label = el("label", "compare-selector-label", "Wybierz trening do porównania:");
    wrap.appendChild(label);

    const select = document.createElement("select");
    select.className = "compare-select";

    allActivities.forEach((act) => {
      const sid = String(act.sid || act.id);
      const opt = document.createElement("option");
      opt.value = sid;
      if (sid === String(selectedSid)) opt.selected = true;

      const km = parseFloat(act.distance_km || act.km || 0).toFixed(1);
      const pace = act.pace || act.avg_pace || "--";
      const date = formatDate(act.date || act.start_date);
      const detail = allDetails[sid] || null;
      const type = TYPE_LABELS[classifyType(act, detail)] || "";

      opt.textContent = `${date} — ${km} km @ ${pace}/km [${type}]`;
      select.appendChild(opt);
    });

    select.addEventListener("change", () => {
      render(select.value, containerId);
    });

    wrap.appendChild(select);
    return wrap;
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

    // Pobierz dane
    let allActivities = [];
    let currentAct = null;
    let currentDetail = null;
    const allDetails = {};

    try {
      allActivities = await DB.getAll();

      // Pobierz detale dla wszystkich aktywności ze strava_id
      for (const act of allActivities) {
        const sid = act.sid || act.id;
        if (sid && act.strava_id) {
          try {
            allDetails[String(sid)] = await DB.getDetail(sid);
          } catch (_) {
            allDetails[String(sid)] = null;
          }
        }
      }

      // Jeśli nie podano SID, użyj najnowszego
      if (!activitySid && allActivities.length > 0) {
        activitySid = allActivities[0].sid || allActivities[0].id;
      }

      currentAct = allActivities.find(
        (a) => String(a.sid || a.id) === String(activitySid)
      );
      if (!currentAct) {
        container.appendChild(el("p", "compare-error", "❌ Nie znaleziono aktywności"));
        return;
      }
      currentDetail = allDetails[String(activitySid)] || null;
    } catch (e) {
      console.error(TAG, "Błąd pobierania danych", e);
      container.appendChild(el("p", "compare-error", "❌ Błąd pobierania danych"));
      return;
    }

    // === Selector — dropdown z treningami ===
    container.appendChild(renderSelector(allActivities, activitySid, containerId, allDetails));

    // Klasyfikacja
    const currentType = classifyType(currentAct, currentDetail);
    const typeLabel = TYPE_LABELS[currentType] || currentType;

    // Tytuł
    container.appendChild(el("h2", "compare-title", `🔄 Porównanie — ${typeLabel}`));

    // Znajdź poprzedni taki sam typ
    const prev = findPreviousSameType(activitySid, currentType, allActivities, allDetails);

    if (!prev) {
      const msgCard = el("div", "compare-card compare-empty");
      msgCard.appendChild(el("p", "compare-empty-msg", `🎉 Pierwszy trening typu "${typeLabel}"!`));
      msgCard.appendChild(el("p", "compare-empty-sub", "Następnym razem zobaczysz tu porównanie z dzisiejszym treningiem."));
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
      card.appendChild(el("span", "compare-header-date", formatDate(act.date || act.start_date)));
      card.appendChild(el("span", "compare-header-info",
        `${parseFloat(act.distance_km || act.km || 0).toFixed(1)} km • ${act.pace || act.avg_pace || "--"}/km`
      ));
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

    let improved = 0, regressed = 0, total = 0;

    metrics.forEach((m) => {
      if (m.current === null && m.previous === null) return;
      total++;

      const row = el("div", "compare-delta-row");
      let statusCls = "compare-neutral", statusIcon = "➖";
      if (m.improved === true) { statusCls = "compare-improved"; statusIcon = "✅"; improved++; }
      else if (m.improved === false) { statusCls = "compare-regressed"; statusIcon = "🔻"; regressed++; }
      row.classList.add(statusCls);

      row.appendChild(el("span", "compare-delta-cell", m.icon));
      row.appendChild(el("span", "compare-delta-cell compare-delta-name", m.name));

      const fmtVal = (v) => {
        if (v === null) return "--";
        if (m.name === "Tempo") return formatPace(v);
        if (m.name === "Czas") return v.toFixed(1);
        return typeof v === "number" ? v.toFixed(1) : v;
      };

      row.appendChild(el("span", "compare-delta-cell", fmtVal(m.current)));
      row.appendChild(el("span", "compare-delta-cell", fmtVal(m.previous)));

      let deltaStr = "--";
      if (m.delta !== null) {
        const sign = m.delta > 0 ? "+" : "";
        if (m.name === "Tempo") deltaStr = `${sign}${m.delta.toFixed(0)}s`;
        else deltaStr = `${sign}${m.delta.toFixed(1)}`;
      }
      row.appendChild(el("span", "compare-delta-cell", deltaStr));
      row.appendChild(el("span", "compare-delta-cell",
        m.deltaPct !== null ? `${m.deltaPct > 0 ? "+" : ""}${m.deltaPct}%` : "--"
      ));

      table.appendChild(row);
    });

    container.appendChild(table);

    // === Split-by-split comparison ===
    const splitComp = compareSplits(currentDetail, prevDetail);
    if (splitComp && splitComp.length > 0) {
      const splitCard = el("div", "compare-card compare-splits");
      splitCard.appendChild(el("h3", "compare-splits-title", "📊 Porównanie splitów (km)"));

      const splitTable = el("div", "compare-split-table");
      const splitHeader = el("div", "compare-split-row compare-split-header");
      ["km", "Teraz", "Poprz.", "Δ", "HR teraz", "HR poprz."].forEach((t) =>
        splitHeader.appendChild(el("span", "compare-split-cell", t))
      );
      splitTable.appendChild(splitHeader);

      splitComp.forEach((s) => {
        const row = el("div", "compare-split-row");
        if (s.improved === true) row.classList.add("compare-improved");
        else if (s.improved === false) row.classList.add("compare-regressed");

        row.appendChild(el("span", "compare-split-cell", `${s.split}`));
        row.appendChild(el("span", "compare-split-cell", formatPace(s.currentPace)));
        row.appendChild(el("span", "compare-split-cell", formatPace(s.previousPace)));

        let dStr = "--";
        if (s.delta !== null) {
          const sign = s.delta > 0 ? "+" : "";
          dStr = `${sign}${s.delta.toFixed(0)}s`;
        }
        row.appendChild(el("span", "compare-split-cell", dStr));
        row.appendChild(el("span", "compare-split-cell", s.currentHR ? `${s.currentHR}` : "--"));
        row.appendChild(el("span", "compare-split-cell", s.previousHR ? `${s.previousHR}` : "--"));

        splitTable.appendChild(row);
      });

      splitCard.appendChild(splitTable);
      container.appendChild(splitCard);
    }

    // === Podsumowanie ===
    const summaryCard = el("div", "compare-card compare-summary");
    let summaryText;
    if (improved > regressed) summaryText = `💪 Poprawiłeś ${improved} z ${total} metryk — tak trzymaj!`;
    else if (regressed > improved) summaryText = `📉 Regres w ${regressed} z ${total} metryk — nie martw się, to normalne.`;
    else summaryText = `📊 Stabilna forma — ${improved} metryk lepszych, ${regressed} słabszych.`;
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
