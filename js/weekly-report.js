/* =========================================================
 *  weekly-report.js — Weekly Report Card
 *  Sprint 11 · HM Tracker PWA
 *  Tygodniowe podsumowanie z oceną A–F
 * ========================================================= */
const WeeklyReport = (() => {
  "use strict";

  const TAG = "[WeeklyReport]";

  /* -------------------------------------------------------
   *  HELPERS
   * ------------------------------------------------------- */

  const dayStart = (d) => {
    const r = new Date(d);
    r.setHours(0, 0, 0, 0);
    return r;
  };

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

  const formatTime = (min) => {
    if (!min) return "--";
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const formatDateShort = (d) => {
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}`;
  };

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /* -------------------------------------------------------
   *  Wewnętrzny state (weekOffset do nawigacji)
   * ------------------------------------------------------- */
  let _currentOffset = 0;
  let _currentContainerId = null;

  /* -------------------------------------------------------
   *  getWeekRange — zakres tygodnia (pon–ndz)
   * ------------------------------------------------------- */

  function getWeekRange(weekOffset = 0) {
    const now = dayStart(new Date());
    // Znajdź poniedziałek bieżącego tygodnia
    const dayOfWeek = now.getDay(); // 0=ndz, 1=pon, ..., 6=sob
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(monday.getDate() + mondayOffset + weekOffset * 7);

    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const label = `${formatDateShort(monday)} – ${formatDateShort(sunday)}`;
    return { start: monday, end: sunday, label };
  }

  /* -------------------------------------------------------
   *  getWeekActivities — filtruj aktywności w tygodniu
   * ------------------------------------------------------- */

  function getWeekActivities(activities, weekOffset = 0) {
    const range = getWeekRange(weekOffset);
    return (activities || []).filter((act) => {
      const d = dayStart(new Date(act.date || act.start_date));
      return d >= range.start && d <= range.end;
    });
  }

  /* -------------------------------------------------------
   *  getWeekPlan — filtruj plan na tydzień
   * ------------------------------------------------------- */

  function getWeekPlan(weekOffset = 0) {
    try {
      const plan = window.PLAN || [];
      const range = getWeekRange(weekOffset);
      return plan.filter((p) => {
        const d = dayStart(new Date(p.date));
        return d >= range.start && d <= range.end;
      });
    } catch (e) {
      console.warn(TAG, "Brak window.PLAN", e);
      return [];
    }
  }

  /* -------------------------------------------------------
   *  calcWeekStats — statystyki tygodnia
   * ------------------------------------------------------- */

  function calcWeekStats(weekActivities) {
    const acts = weekActivities || [];
    const totalKm = acts.reduce(
      (s, a) => s + parseFloat(a.distance_km || a.km || 0),
      0
    );
    const sessions = acts.length;

    const times = acts.map((a) => {
      return (
        parseFloat(a.duration_min || a.moving_time_min || 0) ||
        (a.moving_time ? a.moving_time / 60 : 0)
      );
    });
    const totalTimeMin = times.reduce((s, v) => s + v, 0);

    const paces = acts
      .map((a) => parsePace(a.pace || a.avg_pace))
      .filter((p) => p);
    const avgPace =
      paces.length > 0
        ? Math.round(paces.reduce((s, v) => s + v, 0) / paces.length)
        : null;

    const hrs = acts
      .map((a) => parseFloat(a.avg_hr || a.average_heartrate || 0))
      .filter((h) => h > 0);
    const avgHR =
      hrs.length > 0
        ? Math.round(hrs.reduce((s, v) => s + v, 0) / hrs.length)
        : null;

    const totalElevation = acts.reduce(
      (s, a) =>
        s + parseFloat(a.elevation_gain || a.total_elevation_gain || 0),
      0
    );

    const totalCalories = acts.reduce(
      (s, a) => s + parseFloat(a.calories || 0),
      0
    );

    return {
      totalKm: +totalKm.toFixed(1),
      sessions,
      totalTimeMin: +totalTimeMin.toFixed(0),
      avgPace,
      avgHR,
      totalElevation: +totalElevation.toFixed(0),
      totalCalories: +totalCalories.toFixed(0),
    };
  }

  /* -------------------------------------------------------
   *  calcAdherence — zgodność z planem
   * ------------------------------------------------------- */

  function calcAdherence(weekActivities, weekPlan) {
    const acts = weekActivities || [];
    const plan = weekPlan || [];

    if (plan.length === 0) {
      return {
        volumeAdherence: null,
        completionRate: null,
        typeMatch: null,
        hasPlan: false,
      };
    }

    // Volume: actual km vs planned km
    const actualKm = acts.reduce(
      (s, a) => s + parseFloat(a.distance_km || a.km || 0),
      0
    );
    const plannedKm = plan.reduce((s, p) => s + parseFloat(p.km || 0), 0);
    const volumeAdherence =
      plannedKm > 0
        ? +clamp(((actualKm / plannedKm) * 100), 0, 120).toFixed(1)
        : null;

    // Completion: done sessions / planned sessions
    const completionRate = +(
      (acts.length / plan.length) *
      100
    ).toFixed(1);

    // Type match: jak wiele zaplanowanych typów zostało zrealizowanych
    // Prosta heurystyka: dla każdego wpisu plan, sprawdź czy jest activity w tym dniu
    let matched = 0;
    plan.forEach((p) => {
      const planDate = dayStart(new Date(p.date)).getTime();
      const match = acts.find(
        (a) => dayStart(new Date(a.date || a.start_date)).getTime() === planDate
      );
      if (match) matched++;
    });
    const typeMatch = +((matched / plan.length) * 100).toFixed(1);

    return {
      volumeAdherence,
      completionRate: +clamp(completionRate, 0, 120).toFixed(1),
      typeMatch,
      hasPlan: true,
    };
  }

  /* -------------------------------------------------------
   *  calcQuality — jakość treningów
   * ------------------------------------------------------- */

  function calcQuality(weekActivities) {
    const acts = weekActivities || [];
    if (acts.length === 0) return 0;

    // Próbuj użyć TrainScore jeśli dostępny
    try {
      if (
        typeof window !== "undefined" &&
        window.TrainScore &&
        window.TrainScore.evaluate
      ) {
        const scores = acts
          .map((a) => {
            try {
              const result = window.TrainScore.evaluate(a);
              return result ? result.score || result.total || null : null;
            } catch (_) {
              return null;
            }
          })
          .filter((s) => s !== null);

        if (scores.length > 0) {
          return +(scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(
            1
          );
        }
      }
    } catch (e) {
      console.warn(TAG, "TrainScore niedostępny, fallback", e);
    }

    // Fallback — prosta heurystyka (0-100)
    // Bazujemy na obecności HR data + reasonable pace
    let qualitySum = 0;
    acts.forEach((a) => {
      let q = 50; // bazowy
      const hr = parseFloat(a.avg_hr || a.average_heartrate || 0);
      const pace = parsePace(a.pace || a.avg_pace);
      if (hr > 0) q += 20; // ma HR data
      if (pace && pace > 0 && pace < 480) q += 15; // realistyczny pace
      if (parseFloat(a.distance_km || a.km || 0) > 3) q += 15; // znaczący dystans
      qualitySum += clamp(q, 0, 100);
    });

    return +(qualitySum / acts.length).toFixed(1);
  }

  /* -------------------------------------------------------
   *  calcConsistency — regularność treningów
   * ------------------------------------------------------- */

  function calcConsistency(weekActivities) {
    const acts = weekActivities || [];
    if (acts.length === 0) return 0;
    if (acts.length === 1) return 40; // jeden trening = niska regularność

    // Policz unikalne dni treningowe
    const days = new Set();
    acts.forEach((a) => {
      const d = dayStart(new Date(a.date || a.start_date));
      days.add(d.getDay()); // 0-6
    });
    const uniqueDays = days.size;

    // Idealnie 3-5 unikalnych dni na 3-5 sesji
    // Penalizuj: wszystko w 1-2 dni, lub >6 dni (overtrain)
    let score;
    if (uniqueDays >= 3 && uniqueDays <= 5) {
      score = 100;
    } else if (uniqueDays === 2) {
      score = 60;
    } else if (uniqueDays === 1) {
      score = 30;
    } else if (uniqueDays === 6) {
      score = 80;
    } else if (uniqueDays === 7) {
      score = 60; // brak rest day
    } else {
      score = 50;
    }

    // Bonus za sesje ≈ unikalne dni (nie podwójne)
    if (acts.length === uniqueDays) score = Math.min(100, score + 10);

    return clamp(score, 0, 100);
  }

  /* -------------------------------------------------------
   *  calcGrade — ocena końcowa A–F
   * ------------------------------------------------------- */

  function calcGrade(adherence, completion, quality, consistency) {
    // Jeśli brak planu, uproszczona ocena (adherence = null)
    let score;
    if (adherence === null) {
      // Brak planu — bazuj na quality (60%) + consistency (40%)
      score = quality * 0.6 + consistency * 0.4;
    } else {
      score =
        Math.min(adherence, 100) * 0.4 +
        Math.min(completion, 100) * 0.3 +
        quality * 0.2 +
        consistency * 0.1;
    }

    score = +clamp(score, 0, 100).toFixed(1);

    let letter, color;
    if (score >= 90) {
      letter = "A";
      color = "#22c55e";
    } else if (score >= 80) {
      letter = "B";
      color = "#84cc16";
    } else if (score >= 70) {
      letter = "C";
      color = "#f59e0b";
    } else if (score >= 60) {
      letter = "D";
      color = "#f97316";
    } else {
      letter = "F";
      color = "#ef4444";
    }

    return { score, letter, color };
  }

  /* -------------------------------------------------------
   *  weekOverWeek — porównanie tygodni
   * ------------------------------------------------------- */

  function weekOverWeek(currentStats, prevStats) {
    if (!prevStats || prevStats.sessions === 0) return null;

    const delta = (cur, prev, name, unit, lowerBetter) => {
      if (cur === null || prev === null) return null;
      const d = +(cur - prev).toFixed(1);
      const pct =
        prev !== 0 ? +(((cur - prev) / Math.abs(prev)) * 100).toFixed(1) : null;
      return {
        name,
        unit,
        current: cur,
        previous: prev,
        delta: d,
        deltaPct: pct,
        improved: lowerBetter ? d < 0 : d > 0,
      };
    };

    return [
      delta(currentStats.totalKm, prevStats.totalKm, "Dystans", "km", false),
      delta(currentStats.sessions, prevStats.sessions, "Sesje", "", false),
      delta(currentStats.totalTimeMin, prevStats.totalTimeMin, "Czas", "min", false),
      delta(currentStats.avgPace, prevStats.avgPace, "Avg Pace", "/km", true),
      delta(currentStats.avgHR, prevStats.avgHR, "Avg HR", "bpm", true),
    ].filter((d) => d !== null);
  }

  /* -------------------------------------------------------
   *  render — renderowanie Weekly Report Card
   * ------------------------------------------------------- */

  async function render(containerId, weekOffset = 0) {
    console.log(TAG, `Rendering week report, offset=${weekOffset}`);
    _currentContainerId = containerId;
    _currentOffset = weekOffset;

    const container = document.getElementById(containerId);
    if (!container) {
      console.error(TAG, `Kontener #${containerId} nie istnieje`);
      return;
    }
    container.innerHTML = "";

    // Pobierz dane
    let allActivities = [];
    try {
      allActivities = await DB.getAll();
    } catch (e) {
      console.warn(TAG, "Nie udało się pobrać z DB", e);
    }

    const range = getWeekRange(weekOffset);
    const weekActs = getWeekActivities(allActivities, weekOffset);
    const weekPlan = getWeekPlan(weekOffset);

    // === Header z nawigacją ===
    const header = el("div", "weekly-header");
    const prevBtn = el("button", "weekly-nav-btn", "← Poprz.");
    prevBtn.addEventListener("click", () => render(containerId, weekOffset - 1));

    const title = el("h2", "weekly-title", `📋 Raport Tygodniowy — ${range.label}`);

    const nextBtn = el("button", "weekly-nav-btn", "Nast. →");
    if (weekOffset >= 0) {
      nextBtn.disabled = true;
      nextBtn.style.opacity = "0.4";
    }
    nextBtn.addEventListener("click", () => {
      if (weekOffset < 0) render(containerId, weekOffset + 1);
    });

    header.appendChild(prevBtn);
    header.appendChild(title);
    header.appendChild(nextBtn);
    container.appendChild(header);

    // === Brak treningów ===
    if (weekActs.length === 0) {
      const emptyCard = el("div", "weekly-empty");
      emptyCard.appendChild(
        el("p", "weekly-empty-msg", "🛌 Brak treningów w tym tygodniu")
      );
      if (weekPlan.length > 0) {
        emptyCard.appendChild(
          el(
            "p",
            "weekly-empty-sub",
            `Plan przewidywał ${weekPlan.length} sesji — ${weekPlan.reduce((s, p) => s + parseFloat(p.km || 0), 0).toFixed(1)} km`
          )
        );
      }
      container.appendChild(emptyCard);
      return;
    }

    // === Stats grid ===
    const stats = calcWeekStats(weekActs);
    const statsGrid = el("div", "weekly-stats-grid");

    const statItems = [
      ["🏃 Dystans", `${stats.totalKm} km`],
      ["📅 Sesje", `${stats.sessions}`],
      ["⏱️ Czas", formatTime(stats.totalTimeMin)],
      ["🏎️ Avg Pace", formatPace(stats.avgPace)],
      ["❤️ Avg HR", stats.avgHR ? `${stats.avgHR} bpm` : "--"],
      ["⛰️ Przewyż.", `${stats.totalElevation} m`],
    ];
    statItems.forEach(([label, value]) => {
      const card = el("div", "weekly-stat-card");
      card.appendChild(el("span", "weekly-stat-label", label));
      card.appendChild(el("span", "weekly-stat-value", value));
      statsGrid.appendChild(card);
    });
    container.appendChild(statsGrid);

    // === Adherence bars ===
    const adherence = calcAdherence(weekActs, weekPlan);

    if (adherence.hasPlan) {
      const adhCard = el("div", "weekly-card weekly-adherence");
      adhCard.appendChild(el("h3", "weekly-card-title", "📊 Zgodność z Planem"));

      const bars = [
        ["Volume", adherence.volumeAdherence, "#3b82f6"],
        ["Ukończenie", adherence.completionRate, "#8b5cf6"],
        ["Typ treningu", adherence.typeMatch, "#06b6d4"],
      ];
      bars.forEach(([name, val, color]) => {
        if (val === null) return;
        const barWrap = el("div", "adherence-bar-wrap");
        const barLabel = el("div", "adherence-bar-label");
        barLabel.appendChild(el("span", null, name));
        barLabel.appendChild(el("span", "adherence-pct", `${val}%`));
        barWrap.appendChild(barLabel);

        const track = el("div", "adherence-bar-track");
        const fill = el("div", "adherence-bar-fill");
        fill.style.width = `${clamp(val, 0, 100)}%`;
        fill.style.backgroundColor = color;
        track.appendChild(fill);
        barWrap.appendChild(track);
        adhCard.appendChild(barWrap);
      });

      container.appendChild(adhCard);
    }

    // === Grade ===
    const quality = calcQuality(weekActs);
    const consistency = calcConsistency(weekActs);
    const grade = calcGrade(
      adherence.volumeAdherence,
      adherence.completionRate || 0,
      quality,
      consistency
    );

    const gradeCard = el("div", "weekly-card weekly-grade-card");
    gradeCard.appendChild(el("h3", "weekly-card-title", "🎓 Ocena Tygodnia"));

    const gradeCircle = el("div", "grade-circle");
    gradeCircle.style.borderColor = grade.color;
    gradeCircle.style.color = grade.color;
    gradeCircle.appendChild(el("span", "grade-letter", grade.letter));
    gradeCircle.appendChild(
      el("span", "grade-score", `${grade.score}`)
    );
    gradeCard.appendChild(gradeCircle);

    // Breakdown
    const breakdown = el("div", "grade-breakdown");
    const breakdownItems = adherence.hasPlan
      ? [
          [`Adherence: ${adherence.volumeAdherence?.toFixed(0)}%`, "×0.4"],
          [`Ukończenie: ${adherence.completionRate?.toFixed(0)}%`, "×0.3"],
          [`Jakość: ${quality.toFixed(0)}`, "×0.2"],
          [`Regularność: ${consistency}`, "×0.1"],
        ]
      : [
          [`Jakość: ${quality.toFixed(0)}`, "×0.6"],
          [`Regularność: ${consistency}`, "×0.4"],
        ];
    breakdownItems.forEach(([text, weight]) => {
      const row = el("div", "grade-breakdown-row");
      row.appendChild(el("span", null, text));
      row.appendChild(el("span", "grade-weight", weight));
      breakdown.appendChild(row);
    });
    gradeCard.appendChild(breakdown);
    container.appendChild(gradeCard);

    // === Week-over-week ===
    const prevWeekActs = getWeekActivities(allActivities, weekOffset - 1);
    if (prevWeekActs.length > 0) {
      const prevStats = calcWeekStats(prevWeekActs);
      const deltas = weekOverWeek(stats, prevStats);

      if (deltas && deltas.length > 0) {
        const wowCard = el("div", "weekly-card weekly-wow");
        wowCard.appendChild(
          el("h3", "weekly-card-title", "📈 vs Poprzedni Tydzień")
        );

        deltas.forEach((d) => {
          const row = el("div", "weekly-wow-row");
          let cls = "wow-neutral";
          let icon = "➖";
          if (d.improved === true) {
            cls = "wow-improved";
            icon = "✅";
          } else if (d.improved === false) {
            cls = "wow-regressed";
            icon = "🔻";
          }
          row.classList.add(cls);

          row.appendChild(el("span", "wow-icon", icon));
          row.appendChild(el("span", "wow-name", d.name));

          const sign = d.delta > 0 ? "+" : "";
          let deltaStr;
          if (d.name === "Avg Pace") {
            deltaStr = `${sign}${d.delta}s`;
          } else {
            deltaStr = `${sign}${d.delta} ${d.unit}`;
          }
          row.appendChild(el("span", "wow-delta", deltaStr));
          if (d.deltaPct !== null) {
            row.appendChild(
              el(
                "span",
                "wow-pct",
                `${d.deltaPct > 0 ? "+" : ""}${d.deltaPct}%`
              )
            );
          }
          wowCard.appendChild(row);
        });

        container.appendChild(wowCard);
      }
    }

    console.log(TAG, "Raport tygodniowy gotowy ✅");
  }

  /* -------------------------------------------------------
   *  PUBLIC API
   * ------------------------------------------------------- */
  return {
    render,
    calcGrade,
    getWeekRange,
    _calcWeekStats: calcWeekStats,
    _calcAdherence: calcAdherence,
    _calcQuality: calcQuality,
    _calcConsistency: calcConsistency,
    _weekOverWeek: weekOverWeek,
  };
})();
