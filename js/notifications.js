/* =========================================================
 *  notifications.js — Smart Notifications
 *  Sprint 11 · HM Tracker PWA
 *  Po syncu, rano, PR, injury risk, buty
 * ========================================================= */
const SmartNotifications = (() => {
  "use strict";

  const TAG = "[Notif]";
  const STORAGE_KEY = "hmtracker_notifications";
  const MORNING_KEY = "hmtracker_morning_last";
  const SHOES_KEY = "hmtracker_shoes_km";

  /* -------------------------------------------------------
   *  HELPERS
   * ------------------------------------------------------- */

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

  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /** Czas relatywny: "2h temu", "wczoraj", "3 dni temu" */
  function relativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const min = Math.floor(diff / 60000);
    const hr = Math.floor(diff / 3600000);
    const day = Math.floor(diff / 86400000);

    if (min < 1) return "przed chwilą";
    if (min < 60) return `${min}m temu`;
    if (hr < 24) return `${hr}h temu`;
    if (day === 1) return "wczoraj";
    if (day < 7) return `${day} dni temu`;
    return new Date(timestamp).toLocaleDateString("pl-PL", {
      day: "numeric",
      month: "short",
    });
  }

  /* -------------------------------------------------------
   *  A) NOTIFICATION CENTER — localStorage
   * ------------------------------------------------------- */

  function loadAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn(TAG, "Błąd odczytu notyfikacji z localStorage", e);
      return [];
    }
  }

  function saveAll(notifs) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs));
    } catch (e) {
      console.warn(TAG, "Błąd zapisu notyfikacji", e);
    }
  }

  function addNotification(type, title, body) {
    const notifs = loadAll();
    const notif = {
      id: Date.now() + Math.random().toString(36).slice(2, 6),
      type,
      title,
      body,
      timestamp: Date.now(),
      read: false,
    };
    notifs.unshift(notif); // najnowsze na górze

    // Limit do 100 notyfikacji
    if (notifs.length > 100) notifs.length = 100;

    saveAll(notifs);
    console.log(TAG, `Nowa notyfikacja [${type}]: ${title}`);

    // Update badge w DOM
    updateBadge();

    // Browser notification
    showBrowserNotification(title, body);

    return notif;
  }

  function getUnread() {
    return loadAll().filter((n) => !n.read).length;
  }

  function markRead(id) {
    const notifs = loadAll();
    const n = notifs.find((x) => x.id === id);
    if (n) {
      n.read = true;
      saveAll(notifs);
      updateBadge();
    }
  }

  function markAllRead() {
    const notifs = loadAll();
    notifs.forEach((n) => (n.read = true));
    saveAll(notifs);
    updateBadge();
    // Re-render panel jeśli otwarty
    const panel = document.querySelector(".notif-panel");
    if (panel && panel.style.display !== "none") {
      renderPanelContent(panel);
    }
  }

  function clearOld(daysToKeep = 14) {
    const cutoff = Date.now() - daysToKeep * 86400000;
    const notifs = loadAll().filter((n) => n.timestamp > cutoff);
    saveAll(notifs);
    console.log(TAG, `Wyczyszczono stare notyfikacje (>$ {daysToKeep}d)`);
  }

  /* -------------------------------------------------------
   *  B) BROWSER NOTIFICATIONS
   * ------------------------------------------------------- */

  async function requestPermission() {
    if (!("Notification" in window)) {
      console.warn(TAG, "Browser Notifications API niedostępne");
      return false;
    }
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;

    try {
      const result = await Notification.requestPermission();
      console.log(TAG, `Notification permission: ${result}`);
      return result === "granted";
    } catch (e) {
      console.warn(TAG, "Błąd requestPermission", e);
      return false;
    }
  }

  function showBrowserNotification(title, body, icon) {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }
    try {
    
      var opts = {
        body: body || "",
        icon: icon || "🏃",
        badge: "🏃",
        tag: "hmtracker-" + Date.now(),
      };
      var n = null;
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(function(reg) {
          reg.showNotification(title, opts);
        });
      } else {
        n = new Notification(title, opts);
      }

     
      if (n) { n.onclick = () => {
        window.focus();
        n.close();

      };
      // Auto-close po 8s
      setTimeout(() => n.close(), 8000);
    } catch (e) {
      console.warn(TAG, "Błąd browser notification", e);
    }
  }

  /* -------------------------------------------------------
   *  C) NOTIFICATION TYPES
   * ------------------------------------------------------- */

  /** Po synchronizacji nowej aktywności */
  function onSync(newActivity) {
    if (!newActivity) return;
    const km = parseFloat(newActivity.distance_km || newActivity.km || 0).toFixed(1);
    const pace = newActivity.pace || newActivity.avg_pace || "--";
    const type = newActivity.type || newActivity.sport_type || "Bieg";

    let body = `${type} • ${km} km @ ${pace}/km`;

    // TrainScore jeśli dostępny
    try {
      if (window.TrainScore && window.TrainScore.evaluate) {
        const score = window.TrainScore.evaluate(newActivity);
        if (score && (score.score || score.total)) {
          body += ` • TrainScore: ${score.score || score.total}`;
        }
      }
    } catch (e) {
      // OK, brak TrainScore
    }

    addNotification("sync", "🔄 Nowy trening zsynchronizowany", body);
  }

  /** Poranne powiadomienie */
  function checkMorning() {
    const hour = new Date().getHours();
    if (hour >= 11) return; // tylko przed 11:00

    // Sprawdź czy już pokazano dziś
    try {
      const last = localStorage.getItem(MORNING_KEY);
      if (last === todayISO()) return;
    } catch (_) {}

    let bodyParts = [];

    // Plan na dziś
    try {
      const plan = (window.PLAN || []).find((p) => p.date === todayISO());
      if (plan) {
        bodyParts.push(
          `📋 Plan: ${plan.type || "--"} ${plan.km ? plan.km + "km" : ""} ${plan.pace ? "@ " + plan.pace : ""}`
        );
        if (plan.notes) bodyParts.push(`📝 ${plan.notes}`);
      } else {
        bodyParts.push("😴 Dziś dzień odpoczynku (brak planu)");
      }
    } catch (_) {}

    // Pogoda
    try {
      if (typeof Weather !== "undefined" && Weather.getCurrent) {
        // Weather.getCurrent() jest async, ale checkMorning nie czeka
        Weather.getCurrent().then((w) => {
          if (w && w.temp !== undefined) {
            const weatherStr = `🌤️ ${w.temp}°C ${w.description || ""}`;
            // Dodaj do istniejącej notyfikacji — update body
            const notifs = loadAll();
            const morning = notifs.find(
              (n) =>
                n.type === "morning" &&
                new Date(n.timestamp).toDateString() ===
                  new Date().toDateString()
            );
            if (morning) {
              morning.body += `\n${weatherStr}`;
              saveAll(notifs);
            }
          }
        });
      }
    } catch (_) {}

    // Injury risk
    try {
      if (typeof Briefing !== "undefined" && Briefing.getInjuryRisk) {
        // Potrzebuje activities — spróbuj asynchronicznie
        if (typeof DB !== "undefined" && DB.getAll) {
          DB.getAll().then((acts) => {
            const risk = Briefing.getInjuryRisk(acts);
            if (risk.level === "high" || risk.level === "critical") {
              const notifs = loadAll();
              const morning = notifs.find(
                (n) =>
                  n.type === "morning" &&
                  new Date(n.timestamp).toDateString() ===
                    new Date().toDateString()
              );
              if (morning) {
                morning.body += `\n⚠️ Ryzyko kontuzji: ${risk.level.toUpperCase()}`;
                saveAll(notifs);
              }
            }
          });
        }
      }
    } catch (_) {}

    if (bodyParts.length === 0) bodyParts.push("Miłego dnia treningowego! 💪");

    addNotification("morning", "☀️ Dzień dobry, Dawid!", bodyParts.join("\n"));

    // Zapisz że pokazano dziś
    try {
      localStorage.setItem(MORNING_KEY, todayISO());
    } catch (_) {}
  }

  /** Sprawdź rekordy osobiste */
  async function checkPR(activity, allActivities) {
    if (!activity || !allActivities || allActivities.length < 2) return;

    const currentSid = activity.sid || activity.id;
    const prevActivities = allActivities.filter(
      (a) => String(a.sid || a.id) !== String(currentSid)
    );
    if (prevActivities.length === 0) return;

    const prs = [];

    // --- Najdłuższy bieg ---
    const currentKm = parseFloat(activity.distance_km || activity.km || 0);
    const maxPrevKm = Math.max(
      ...prevActivities.map((a) =>
        parseFloat(a.distance_km || a.km || 0)
      )
    );
    if (currentKm > maxPrevKm && currentKm > 0) {
      prs.push(`📏 Najdłuższy bieg: ${currentKm.toFixed(1)} km (poprz. ${maxPrevKm.toFixed(1)} km)`);
    }

    // --- Najlepszy EF ---
    try {
      if (typeof Efficiency !== "undefined" && Efficiency.calcEF) {
        const curEF = Efficiency.calcEF(activity);
        if (curEF !== null) {
          const prevEFs = prevActivities
            .map((a) => Efficiency.calcEF(a))
            .filter((e) => e !== null);
          const maxEF = prevEFs.length > 0 ? Math.max(...prevEFs) : 0;
          if (curEF > maxEF) {
            prs.push(`⚡ Najlepszy EF: ${curEF.toFixed(1)} (poprz. ${maxEF.toFixed(1)})`);
          }
        }
      }
    } catch (_) {}

    // --- Splits PR (1km, 5km, 10km) ---
    try {
      if (typeof DB !== "undefined" && DB.getDetail) {
        const currentDetail = await DB.getDetail(currentSid);
        if (currentDetail && currentDetail.splits) {
          const curSplitPaces = currentDetail.splits
            .map((s) => parsePace(s.pace) || s.average_speed_sec_per_km || null)
            .filter((p) => p !== null);

          // Najszybszy 1km split
          if (curSplitPaces.length > 0) {
            const cur1k = Math.min(...curSplitPaces);

            // Porównaj z wszystkimi poprzednimi splitami
            let bestPrev1k = Infinity;
            for (const pAct of prevActivities.slice(0, 50)) {
              // limit do 50 ostatnich
              try {
                const pd = await DB.getDetail(pAct.sid || pAct.id);
                if (pd && pd.splits) {
                  const pPaces = pd.splits
                    .map(
                      (s) =>
                        parsePace(s.pace) ||
                        s.average_speed_sec_per_km ||
                        null
                    )
                    .filter((p) => p !== null);
                  const pMin = pPaces.length > 0 ? Math.min(...pPaces) : Infinity;
                  if (pMin < bestPrev1k) bestPrev1k = pMin;
                }
              } catch (_) {}
            }
            if (cur1k < bestPrev1k && bestPrev1k < Infinity) {
              prs.push(
                `🥇 Najszybszy 1km split: ${formatPace(cur1k)} (poprz. ${formatPace(bestPrev1k)})`
              );
            }
          }

          // Najszybsze 5km (5 kolejnych splitów)
          if (curSplitPaces.length >= 5) {
            let best5k = Infinity;
            for (let i = 0; i <= curSplitPaces.length - 5; i++) {
              const sum5 = curSplitPaces
                .slice(i, i + 5)
                .reduce((s, v) => s + v, 0);
              if (sum5 < best5k) best5k = sum5;
            }

            let bestPrev5k = Infinity;
            for (const pAct of prevActivities.slice(0, 30)) {
              try {
                const pd = await DB.getDetail(pAct.sid || pAct.id);
                if (pd && pd.splits && pd.splits.length >= 5) {
                  const pPaces = pd.splits
                    .map(
                      (s) =>
                        parsePace(s.pace) ||
                        s.average_speed_sec_per_km ||
                        null
                    )
                    .filter((p) => p !== null);
                  for (let i = 0; i <= pPaces.length - 5; i++) {
                    const sum5 = pPaces
                      .slice(i, i + 5)
                      .reduce((s, v) => s + v, 0);
                    if (sum5 < bestPrev5k) bestPrev5k = sum5;
                  }
                }
              } catch (_) {}
            }
            if (best5k < bestPrev5k && bestPrev5k < Infinity) {
              const best5kPace = best5k / 5;
              const prevPace = bestPrev5k / 5;
              prs.push(
                `🥇 Najszybsze 5km: avg ${formatPace(best5kPace)}/km (poprz. ${formatPace(prevPace)}/km)`
              );
            }
          }

          // Najszybsze 10km (10 kolejnych splitów)
          if (curSplitPaces.length >= 10) {
            let best10k = Infinity;
            for (let i = 0; i <= curSplitPaces.length - 10; i++) {
              const sum10 = curSplitPaces
                .slice(i, i + 10)
                .reduce((s, v) => s + v, 0);
              if (sum10 < best10k) best10k = sum10;
            }

            let bestPrev10k = Infinity;
            for (const pAct of prevActivities.slice(0, 20)) {
              try {
                const pd = await DB.getDetail(pAct.sid || pAct.id);
                if (pd && pd.splits && pd.splits.length >= 10) {
                  const pPaces = pd.splits
                    .map(
                      (s) =>
                        parsePace(s.pace) ||
                        s.average_speed_sec_per_km ||
                        null
                    )
                    .filter((p) => p !== null);
                  for (let i = 0; i <= pPaces.length - 10; i++) {
                    const sum10 = pPaces
                      .slice(i, i + 10)
                      .reduce((s, v) => s + v, 0);
                    if (sum10 < bestPrev10k) bestPrev10k = sum10;
                  }
                }
              } catch (_) {}
            }
            if (best10k < bestPrev10k && bestPrev10k < Infinity) {
              const best10kPace = best10k / 10;
              const prevPace = bestPrev10k / 10;
              prs.push(
                `🥇 Najszybsze 10km: avg ${formatPace(best10kPace)}/km (poprz. ${formatPace(prevPace)}/km)`
              );
            }
          }
        }
      }
    } catch (e) {
      console.warn(TAG, "Błąd sprawdzania split PR", e);
    }

    // Wyślij notyfikacje
    if (prs.length > 0) {
      addNotification(
        "pr",
        `🏆 ${prs.length === 1 ? "Nowy rekord osobisty!" : `${prs.length} nowe rekordy osobiste!`}`,
        prs.join("\n")
      );
    }
  }

  /** Sprawdź ryzyko kontuzji */
  function checkInjuryRisk(activities) {
    try {
      if (typeof Briefing === "undefined" || !Briefing.getInjuryRisk) return;
      const risk = Briefing.getInjuryRisk(activities);
      if (risk.level === "high" || risk.level === "critical") {
        addNotification(
          "injury",
          `⚠️ Ryzyko kontuzji: ${risk.level.toUpperCase()}`,
          risk.alerts.join("\n")
        );
      }
    } catch (e) {
      console.warn(TAG, "Błąd checkInjuryRisk", e);
    }
  }

  /** Sprawdź zużycie butów */
  async function checkShoes(activities, details) {
    const gearKm = {};

    // Agreguj km per gear
    for (const act of activities || []) {
      const sid = act.sid || act.id;
      let detail = details ? details[sid] : null;

      // Pobierz detail jeśli nie przekazano
      if (!detail) {
        try {
          if (typeof DB !== "undefined" && DB.getDetail) {
            detail = await DB.getDetail(sid);
          }
        } catch (_) {}
      }

      const gearId = (detail && (detail.gear_id || detail.gear)) ||
                      act.gear_id || act.gear || null;
      if (!gearId) continue;

      const km = parseFloat(act.distance_km || act.km || 0);
      if (!gearKm[gearId]) {
        gearKm[gearId] = {
          km: 0,
          name: (detail && detail.gear_name) || gearId,
        };
      }
      gearKm[gearId].km += km;
    }

    // Sprawdź progi + porównaj z poprzednim stanem
    let prevState = {};
    try {
      const raw = localStorage.getItem(SHOES_KEY);
      if (raw) prevState = JSON.parse(raw);
    } catch (_) {}

    const THRESHOLDS = [
      { km: 800, label: "🔴 WYMIANA", level: "danger" },
      { km: 700, label: "🟡 UWAGA", level: "warning" },
      { km: 500, label: "🔵 INFO", level: "info" },
    ];

    Object.entries(gearKm).forEach(([gearId, data]) => {
      const totalKm = Math.round(data.km);
      const prevKm = prevState[gearId] || 0;

      for (const thresh of THRESHOLDS) {
        if (totalKm >= thresh.km && prevKm < thresh.km) {
          addNotification(
            "shoes",
            `👟 ${thresh.label}: ${data.name}`,
            `${data.name} ma ${totalKm} km — ${
              thresh.level === "danger"
                ? "czas na nowe buty!"
                : thresh.level === "warning"
                ? "zbliżasz się do limitu żywotności"
                : "monitoruj stan butów"
            }`
          );
          break; // Tylko najwyższy przekroczony próg
        }
      }

      // Update stanu
      prevState[gearId] = totalKm;
    });

    try {
      localStorage.setItem(SHOES_KEY, JSON.stringify(prevState));
    } catch (_) {}
  }

  /* -------------------------------------------------------
   *  D) IN-APP BELL + PANEL
   * ------------------------------------------------------- */

  /** Type → ikona */
  const TYPE_ICONS = {
    sync: "🔄",
    morning: "☀️",
    pr: "🏆",
    injury: "⚠️",
    shoes: "👟",
    general: "🔔",
  };

  /** Aktualizuj badge na dzwonku */
  function updateBadge() {
    const badge = document.querySelector(".notif-badge");
    if (!badge) return;
    const count = getUnread();
    badge.textContent = count > 99 ? "99+" : count;
    badge.style.display = count > 0 ? "flex" : "none";
  }

  /** Renderuj dzwonek z badge */
  function renderBell(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(TAG, `Kontener #${containerId} nie istnieje`);
      return;
    }
    container.innerHTML = "";

    const bellWrap = el("div", "notif-bell-wrap");

    // Bell icon
    const bell = el("button", "notif-bell", "🔔");
    bell.setAttribute("aria-label", "Powiadomienia");
    bellWrap.appendChild(bell);

    // Badge
    const badge = el("span", "notif-badge");
    const count = getUnread();
    badge.textContent = count > 99 ? "99+" : count;
    badge.style.display = count > 0 ? "flex" : "none";
    bellWrap.appendChild(badge);

    // Panel (ukryty)
    const panel = el("div", "notif-panel");
    panel.style.display = "none";
    renderPanelContent(panel);
    bellWrap.appendChild(panel);

    // Toggle
    bell.addEventListener("click", (e) => {
      e.stopPropagation();
      const isVisible = panel.style.display !== "none";
      panel.style.display = isVisible ? "none" : "block";
      if (!isVisible) renderPanelContent(panel);
    });

    // Zamknij na klik poza panelem
    document.addEventListener("click", (e) => {
      if (!bellWrap.contains(e.target)) {
        panel.style.display = "none";
      }
    });

    container.appendChild(bellWrap);
    console.log(TAG, "Bell renderowany");
  }

  /** Renderuj zawartość panelu notyfikacji */
  function renderPanelContent(panel) {
    panel.innerHTML = "";

    // Header
    const header = el("div", "notif-panel-header");
    header.appendChild(el("span", "notif-panel-title", "Powiadomienia"));
    const markAllBtn = el("button", "notif-mark-all", "Oznacz przeczytane");
    markAllBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      markAllRead();
    });
    header.appendChild(markAllBtn);
    panel.appendChild(header);

    // Lista
    const notifs = loadAll();
    if (notifs.length === 0) {
      panel.appendChild(el("p", "notif-empty", "Brak powiadomień"));
      return;
    }

    const list = el("div", "notif-list");
    notifs.slice(0, 30).forEach((n) => {
      const item = el("div", `notif-item ${n.read ? "notif-read" : "notif-unread"}`);

      // Ikona typu
      const icon = el("span", "notif-item-icon", TYPE_ICONS[n.type] || TYPE_ICONS.general);
      item.appendChild(icon);

      // Treść
      const content = el("div", "notif-item-content");
      content.appendChild(el("span", "notif-item-title", n.title));
      // Body — multi-line support
      if (n.body) {
        const bodyEl = el("span", "notif-item-body");
        bodyEl.textContent = n.body;
        content.appendChild(bodyEl);
      }
      content.appendChild(
        el("span", "notif-item-time", relativeTime(n.timestamp))
      );
      item.appendChild(content);

      // Klik = mark as read
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        markRead(n.id);
        item.classList.remove("notif-unread");
        item.classList.add("notif-read");
      });

      list.appendChild(item);
    });

    panel.appendChild(list);
  }

  /* -------------------------------------------------------
   *  E) SCHEDULER
   * ------------------------------------------------------- */

  /** init() — wywoływane na starcie aplikacji */
  async function init() {
    console.log(TAG, "Inicjalizacja Smart Notifications…");

    clearOld(14);
    await requestPermission();
    checkMorning();

    // Sprawdź injury risk + buty
    try {
      if (typeof DB !== "undefined" && DB.getAll) {
        const activities = await DB.getAll();
        if (activities && activities.length > 0) {
          checkInjuryRisk(activities);
          await checkShoes(activities);
        }
      }
    } catch (e) {
      console.warn(TAG, "Błąd init checks", e);
    }

    console.log(TAG, `Inicjalizacja zakończona ✅ (${getUnread()} nieprzeczytanych)`);
  }

  /** onActivitySync — wywoływane po synchronizacji ze Strava */
  async function onActivitySync(activity) {
    console.log(TAG, "onActivitySync", activity?.sid || activity?.id);

    if (!activity) return;

    // Sync notification
    onSync(activity);

    // Check PRs
    try {
      if (typeof DB !== "undefined" && DB.getAll) {
        const allActivities = await DB.getAll();
        await checkPR(activity, allActivities);
      }
    } catch (e) {
      console.warn(TAG, "Błąd onActivitySync PR check", e);
    }
  }

  /* -------------------------------------------------------
   *  PUBLIC API
   * ------------------------------------------------------- */
  return {
    init,
    onActivitySync,
    renderBell,
    getUnread,
    // Dodatkowe eksporty do testów / debugowania
    _addNotification: addNotification,
    _markRead: markRead,
    _markAllRead: markAllRead,
    _checkMorning: checkMorning,
    _checkPR: checkPR,
    _checkInjuryRisk: checkInjuryRisk,
    _checkShoes: checkShoes,
    _loadAll: loadAll,
  };
})();
