/* coach.js — Intelligent Running Coach (Level 3-5)
 * Sprint 12 · HM Tracker PWA
 * Progressive Intelligence: falls back to simpler levels when data is limited
 */
const Coach = (() => {
  "use strict";
  const TAG = "[Coach]";

  // === SAFETY RULES (never overridden) ===
  const SAFETY = {
    maxHardPerWeek: 3,
    minRestPerWeek: 1,
    maxWeeklyIncrease: 10, // %
    acwrDangerOverride: 1.5,
    maxConsecutiveDays: 5,
    tsbFloorForHard: -30,
    taperAutoStartDays: 14,
    minPatternConfidence: 60
  };

  // Race target
  const RACE = {
    name: "Wizz Air Prague Night HM",
    date: "2026-09-06",
    targetPace: "4:59",
    distance: 21.097
  };

  var dayMs = 86400000;
  function dayStart(d) { var r = new Date(d); r.setHours(0,0,0,0); return r; }
  function todayISO() { var d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
  function diffDays(a,b) { return Math.round(Math.abs(dayStart(a)-dayStart(b))/dayMs); }
  function parsePace(p) { if(!p) return null; var pp=String(p).split(":"); if(pp.length!==2) return null; return parseInt(pp[0],10)*60+parseInt(pp[1],10); }
  function fmtPace(s) { if(!s||!isFinite(s)) return "--:--"; return Math.floor(s/60)+":"+String(Math.round(s%60)).padStart(2,"0"); }
  function clamp(v,lo,hi) { return Math.max(lo,Math.min(hi,v)); }

  // === LAYER 1: FITNESS-FATIGUE MODEL ===

  function activityLoad(act) {
    var km = parseFloat(act.distance_km||act.km||0);
    var dur = parseFloat(act.duration_min||act.moving_time_min||0)||(act.moving_time?act.moving_time/60:0);
    var hr = parseFloat(act.avg_hr||act.average_heartrate||0);
    if (hr > 0 && dur > 0) return +(dur * clamp((hr-55)/(190-55), 0.5, 1.0)).toFixed(1);
    return +(km * 10).toFixed(1);
  }

  // Exponential Moving Average
  function calcEMA(dailyLoads, days) {
    var alpha = 2.0 / (days + 1);
    var ema = 0;
    for (var i = 0; i < dailyLoads.length; i++) {
      ema = alpha * dailyLoads[i] + (1 - alpha) * ema;
    }
    return +ema.toFixed(1);
  }

  function calcFitnessFatigue(activities) {
    if (!activities || activities.length < 3) return null;

    // Build daily load map for last 60 days
    var now = dayStart(new Date());
    var loadMap = {};
    activities.forEach(function(a) {
      var d = (a.date || a.start_date || "").slice(0, 10);
      if (!d) return;
      if (!loadMap[d]) loadMap[d] = 0;
      loadMap[d] += activityLoad(a);
    });

    // Build array of daily loads (60 days, oldest first)
    var dailyLoads = [];
    for (var i = 59; i >= 0; i--) {
      var d = new Date(now); d.setDate(d.getDate() - i);
      var key = d.toISOString().slice(0, 10);
      dailyLoads.push(loadMap[key] || 0);
    }

    var ctl = calcEMA(dailyLoads, 42);   // Fitness (chronic)
    var atl = calcEMA(dailyLoads, 7);    // Fatigue (acute)
    var tsb = +(ctl - atl).toFixed(1);   // Form (balance)

    // Monotony & Strain (last 7 days)
    var last7 = dailyLoads.slice(-7);
    var avg7 = last7.reduce(function(s,v){return s+v;}, 0) / 7;
    var variance = last7.reduce(function(s,v){return s + Math.pow(v-avg7, 2);}, 0) / 7;
    var stdev = Math.sqrt(variance) || 0.01;
    var monotony = +(avg7 / stdev).toFixed(2);
    var strain = +(last7.reduce(function(s,v){return s+v;}, 0) * monotony).toFixed(1);

    // Trend (CTL direction over last 14 days)
    var loads14 = dailyLoads.slice(-14);
    var loads14a = dailyLoads.slice(-28, -14);
    var sum14 = loads14.reduce(function(s,v){return s+v;}, 0);
    var sum14a = loads14a.reduce(function(s,v){return s+v;}, 0);
    var trend = sum14 > sum14a * 1.05 ? "building" : sum14 < sum14a * 0.95 ? "recovering" : "maintaining";

    return {
      ctl: ctl, atl: atl, tsb: tsb,
      monotony: monotony, strain: strain,
      trend: trend
    };
  }

  // === LAYER 2: CONTEXT ENGINE ===

  function getPhase(daysToRace) {
    if (daysToRace <= 0) return "race_done";
    if (daysToRace <= 14) return "taper";
    if (daysToRace <= 28) return "peak";
    if (daysToRace <= 56) return "build";
    return "base";
  }

  function getContext(activities, planFlat) {
    var today = todayISO();
    var raceDate = new Date(RACE.date);
    var daysToRace = diffDays(raceDate, new Date());
    if (new Date() > raceDate) daysToRace = -daysToRace;
    var phase = getPhase(daysToRace);

    // Yesterday's activity
    var yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
    var yesterdayISO = yesterday.toISOString().slice(0,10);
    var yesterdayAct = null;
    activities.forEach(function(a) {
      if ((a.date||"").slice(0,10) === yesterdayISO) yesterdayAct = a;
    });

    // Today's plan
    var todayPlan = null, tomorrowPlan = null;
    if (planFlat) {
      todayPlan = planFlat.find(function(p){return p.date===today;}) || null;
      var tom = new Date(); tom.setDate(tom.getDate()+1);
      var tomISO = tom.toISOString().slice(0,10);
      tomorrowPlan = planFlat.find(function(p){return p.date===tomISO;}) || null;
    }

    // Week stats
    var now = dayStart(new Date());
    var monday = new Date(now); monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
    var weekKm = 0, weekSessions = 0, weekHardCount = 0;
    var hardTypes = ["Intervals","Tempo","Fartlek","Long Run","Race"];
    activities.forEach(function(a) {
      var d = dayStart(new Date(a.date||a.start_date));
      if (d >= monday && d <= now) {
        weekKm += parseFloat(a.distance_km||a.km||0);
        weekSessions++;
        var t = a.type || a.workout_type || "";
        if (hardTypes.indexOf(t) >= 0) weekHardCount++;
      }
    });

    // Consecutive days
    var dateSet = {};
    activities.forEach(function(a) {
      var d = (a.date||a.start_date||"").slice(0,10);
      if (d) dateSet[d] = true;
    });
    var consecutive = 0;
    for (var i = 0; i < 365; i++) {
      var ch = new Date(now); ch.setDate(ch.getDate()-i);
      if (dateSet[ch.toISOString().slice(0,10)]) consecutive++;
      else break;
    }

    return {
      today: today,
      phase: phase,
      daysToRace: daysToRace,
      weekInPlan: Math.max(1, Math.ceil((84 - daysToRace) / 7)),
      yesterdayAct: yesterdayAct,
      todayPlan: todayPlan,
      tomorrowPlan: tomorrowPlan,
      weekKm: +weekKm.toFixed(1),
      weekSessions: weekSessions,
      weekHardCount: weekHardCount,
      consecutive: consecutive
    };
  }

  // === LAYER 3: PATTERN LEARNING (Level 5) ===

  function learnPatterns(activities) {
    var patterns = { confidence: 0, insights: [] };
    if (!activities || activities.length < 5) {
      patterns.confidence = 20;
      return patterns;
    }

    // --- Recovery Time Pattern ---
    var hardTypes = ["intervals","Interwaly","tempo","long_run","Long Run","race","fartlek","Race","Intervals","Tempo","Fartlek"];
    var recoveryTimes = [];
    var sorted = activities.slice().sort(function(a,b){
      return (a.date||"").localeCompare(b.date||"");
    });
    for (var i = 0; i < sorted.length - 1; i++) {
      var t = sorted[i].type || sorted[i].workout_type || "";
      if (hardTypes.indexOf(t) < 0) continue;
      var nextIdx = -1;
      for (var j = i+1; j < sorted.length; j++) {
        var nt = sorted[j].type || sorted[j].workout_type || "";
        if (hardTypes.indexOf(nt) >= 0) { nextIdx = j; break; }
      }
      if (nextIdx > 0) {
        var days = diffDays(new Date(sorted[nextIdx].date), new Date(sorted[i].date));
        recoveryTimes.push({ type: t, days: days });
      }
    }
    if (recoveryTimes.length >= 3) {
      var avgRecovery = recoveryTimes.reduce(function(s,r){return s+r.days;},0) / recoveryTimes.length;
      patterns.recoveryDays = +avgRecovery.toFixed(1);
      patterns.insights.push({
        type: "recovery",
        text: "Po ciezkim treningu potrzebujesz ok. " + avgRecovery.toFixed(0) + " dni do nastepnego hard",
        confidence: Math.min(90, 50 + recoveryTimes.length * 5)
      });
    }

    // --- Pace Trend ---
    var easyRuns = sorted.filter(function(a){
      var t = a.type||a.workout_type||"";
      return t === "Easy" || t === "Easy Run" || t === "Recovery";
    });
    if (easyRuns.length >= 4) {
      var first = easyRuns.slice(0, Math.ceil(easyRuns.length/2));
      var second = easyRuns.slice(Math.ceil(easyRuns.length/2));
      var avgFirst = first.reduce(function(s,a){return s+(parsePace(a.pace||a.avg_pace)||0);},0)/first.length;
      var avgSecond = second.reduce(function(s,a){return s+(parsePace(a.pace||a.avg_pace)||0);},0)/second.length;
      if (avgFirst > 0 && avgSecond > 0) {
        var diff = avgFirst - avgSecond; // positive = improving (faster)
        patterns.paceTrend = { first: avgFirst, second: avgSecond, diff: +diff.toFixed(1) };
        if (diff > 3) {
          patterns.insights.push({
            type: "pace",
            text: "Easy pace poprawilo sie: " + fmtPace(Math.round(avgFirst)) + " -> " + fmtPace(Math.round(avgSecond)),
            confidence: Math.min(85, 50 + easyRuns.length * 4)
          });
        }
      }
    }

    // --- Weather Effect on HR (Level 5) ---
    var weatherHR = [];
    activities.forEach(function(a) {
      var hr = parseFloat(a.avg_hr||a.average_heartrate||0);
      if (hr > 0 && a._weather && a._weather.temp !== null) {
        weatherHR.push({ temp: a._weather.temp, hr: hr, pace: parsePace(a.pace||a.avg_pace) });
      }
    });
    if (weatherHR.length >= 6) {
      var hot = weatherHR.filter(function(w){return w.temp > 22;});
      var cool = weatherHR.filter(function(w){return w.temp <= 22;});
      if (hot.length >= 2 && cool.length >= 2) {
        var avgHRHot = hot.reduce(function(s,w){return s+w.hr;},0)/hot.length;
        var avgHRCool = cool.reduce(function(s,w){return s+w.hr;},0)/cool.length;
        var hrDiff = avgHRHot - avgHRCool;
        if (hrDiff > 2) {
          patterns.heatEffect = { hrDiff: +hrDiff.toFixed(1), threshold: 22, samples: weatherHR.length };
          patterns.insights.push({
            type: "weather",
            text: "Twoje HR jest srednie +" + hrDiff.toFixed(0) + " bpm w temp >22C",
            confidence: Math.min(85, 40 + weatherHR.length * 5)
          });
        }
      }
    }

    // --- Cardiac Drift on Long Runs ---
    var longRuns = activities.filter(function(a){
      var t = a.type||a.workout_type||"";
      return t === "Long Run" && parseFloat(a.distance_km||a.km||0) > 12;
    });
    if (longRuns.length >= 3) {
      // Use max_hr vs avg_hr as drift proxy
      var drifts = longRuns.map(function(a) {
        var avg = parseFloat(a.avg_hr||a.average_heartrate||0);
        var max = parseFloat(a.max_hr||0);
        if (avg > 0 && max > avg) return +((max - avg) / avg * 100).toFixed(1);
        return null;
      }).filter(function(d){return d !== null;});

      if (drifts.length >= 2) {
        var avgDrift = drifts.reduce(function(s,v){return s+v;},0)/drifts.length;
        patterns.cardiacDrift = { avg: +avgDrift.toFixed(1), runs: drifts.length };
        patterns.insights.push({
          type: "drift",
          text: "Cardiac drift na Long Run: sredni " + avgDrift.toFixed(1) + "%",
          confidence: Math.min(80, 50 + drifts.length * 10)
        });
      }
    }

    // Overall confidence
    patterns.confidence = patterns.insights.length > 0
      ? Math.round(patterns.insights.reduce(function(s,i){return s+i.confidence;},0) / patterns.insights.length)
      : 30;

    return patterns;
  }

  // === LAYER 4: RACE PREDICTOR ===

  function predictRace(activities) {
    // Find best recent race-like effort (tempo/race/fast run)
    var efforts = [];
    activities.forEach(function(a) {
      var km = parseFloat(a.distance_km||a.km||0);
      var pace = parsePace(a.pace||a.avg_pace);
     
    var type = (a.type||a.workout_type||"").toLowerCase();
    var isHard = type.indexOf("interval")>=0 || type.indexOf("tempo")>=0 || type.indexOf("fartlek")>=0 || type.indexOf("race")>=0;
    if (km >= 3 && pace && pace > 0 && (isHard || pace < 360)) {
      efforts.push({ km: km, pace: pace, date: a.date, type: type });
    }

    });

    if (efforts.length < 3) return null;

    // Sort by date, take recent
    efforts.sort(function(a,b){return (b.date||"").localeCompare(a.date||"");});
    var recent = efforts.slice(0, 10);

    // Riegel formula: T2 = T1 * (D2/D1)^1.06
    var predictions = [];
    recent.forEach(function(e) {
      var timeSeconds = e.km * e.pace;
      var predicted = timeSeconds * Math.pow(RACE.distance / e.km, 1.06);
      predictions.push(predicted);
    });

    var avgPrediction = predictions.reduce(function(s,v){return s+v;},0) / predictions.length;
    var hours = Math.floor(avgPrediction / 3600);
    var mins = Math.floor((avgPrediction % 3600) / 60);
    var secs = Math.round(avgPrediction % 60);
    var predictedTime = hours + ":" + String(mins).padStart(2,"0") + ":" + String(secs).padStart(2,"0");
    var predictedPace = fmtPace(Math.round(avgPrediction / RACE.distance));

    var targetSec = parsePace(RACE.targetPace) * RACE.distance;
    var status;
    if (avgPrediction <= targetSec * 0.98) status = "ahead";
    else if (avgPrediction <= targetSec * 1.02) status = "on_track";
    else if (avgPrediction <= targetSec * 1.08) status = "behind";
    else status = "at_risk";

    return {
      predictedTime: predictedTime,
      predictedPace: predictedPace,
      targetTime: "1:45:10",
      targetPace: RACE.targetPace,
      status: status,
      basedOn: recent.length + " recent efforts"
    };
  }

  // === LAYER 5: DECISION ENGINE ===

  function classifyType(type) {
    var t = (type || "").toLowerCase();
    if (t.indexOf("interval") >= 0 || t.indexOf("tempo") >= 0 || t.indexOf("fartlek") >= 0 || t.indexOf("race") >= 0) return "hard";
    if (t.indexOf("long") >= 0) return "hard";
    if (t.indexOf("rest") >= 0 || t.indexOf("off") >= 0) return "rest";
    return "easy";
  }

  function getAdvice(activities, planFlat) {
    var ff = calcFitnessFatigue(activities);
    var ctx = getContext(activities, planFlat || window.PLAN_FLAT || []);
    var patterns = learnPatterns(activities);
    var race = predictRace(activities);

    // Determine data level
    var dataLevel = 3;
    if (patterns.confidence >= SAFETY.minPatternConfidence) dataLevel = 5;
    else if (patterns.confidence >= 40) dataLevel = 4;

    // --- Build recommendation ---
    var headline = "";
    var suggestion = { type: "as_planned", km: 0, pace: null, hrCap: null, reason: "" };
    var tips = [];
    var warnings = [];

    // Check yesterday
    var yesterdayType = ctx.yesterdayAct ? classifyType(ctx.yesterdayAct.type || ctx.yesterdayAct.workout_type) : "rest";
    var yesterdayKm = ctx.yesterdayAct ? parseFloat(ctx.yesterdayAct.distance_km||ctx.yesterdayAct.km||0) : 0;

    // === SAFETY CHECKS (always override) ===

    // 1. Max consecutive days
    if (ctx.consecutive >= SAFETY.maxConsecutiveDays) {
      headline = "OBOWIAZKOWY ODPOCZYNEK";
      suggestion = { type: "rest", km: 0, pace: null, hrCap: null, reason: ctx.consecutive + " dni z rzedu bez rest day" };
      warnings.push("Zasada bezpieczenstwa: max " + SAFETY.maxConsecutiveDays + " dni z rzedu");
      tips.push("Rozciaganie, foam rolling, spacer");
    }

    // 2. ACWR danger
    else if (ff && ff.atl > 0 && (ff.atl / Math.max(ff.ctl, 1)) > SAFETY.acwrDangerOverride) {
      headline = "OGRANICZENIE OBCIAZENIA";
      suggestion = { type: "easy", km: Math.min(5, ctx.todayPlan ? ctx.todayPlan.km * 0.5 : 5), pace: null, hrCap: 140, reason: "ACWR niebezpiecznie wysoki" };
      warnings.push("ACWR > " + SAFETY.acwrDangerOverride + " — strefa danger");
    }

    // 3. TSB floor for hard
    else if (ff && ff.tsb < SAFETY.tsbFloorForHard && ctx.todayPlan && classifyType(ctx.todayPlan.type) === "hard") {
      headline = "MODYFIKACJA: zamien hard -> easy";
      suggestion = {
        type: "easy",
        km: ctx.todayPlan.km || 8,
        pace: null,
        hrCap: 145,
        reason: "TSB " + ff.tsb + " za niskie na hard session"
      };
      warnings.push("TSB < " + SAFETY.tsbFloorForHard + " — za duze zmeczenie na ciezki trening");
      tips.push("Przesun hard session o 1-2 dni");
    }

    // 4. Max hard per week
    else if (ctx.weekHardCount >= SAFETY.maxHardPerWeek && ctx.todayPlan && classifyType(ctx.todayPlan.type) === "hard") {
      headline = "MODYFIKACJA: wyczerpany limit hard";
      suggestion = {
        type: "easy",
        km: ctx.todayPlan.km || 8,
        pace: null,
        hrCap: 145,
        reason: "Juz " + ctx.weekHardCount + " hard sessions w tym tygodniu"
      };
    }

    // === TAPER MODE ===
    else if (ctx.phase === "taper") {
      headline = "TAPER — " + ctx.daysToRace + " dni do wyscigu";
      var taperKm = ctx.todayPlan ? Math.round(ctx.todayPlan.km * 0.7) : 5;
      suggestion = {
        type: "easy",
        km: taperKm,
        pace: null,
        hrCap: 145,
        reason: "Faza taper — redukcja objetosci 30%"
      };
      tips.push("Utrzymaj intensywnosc, redukuj objetosc");
      tips.push("Sen 8h+ priorytetem!");
    }

    // === NORMAL RECOMMENDATIONS ===
    else if (!headline) {
      // Today plan is done/moved
      if (ctx.todayPlan && ctx.todayPlan._status === "done") {
        headline = "Trening wykonany dzis";
        suggestion = { type: "done", km: 0, pace: null, hrCap: null, reason: "Plan zaliczony" };
      } else if (ctx.todayPlan && ctx.todayPlan._status === "moved") {
        headline = "Trening wykonany wczesniej (" + ctx.todayPlan._logDate + ")";
        // After hard yesterday, suggest rest
        if (yesterdayType === "hard" || yesterdayKm > 14) {
          suggestion = { type: "rest", km: 0, pace: null, hrCap: null, reason: "Po ciezkim treningu wczoraj (" + yesterdayKm.toFixed(1) + " km)" };
          tips.push("Foam rolling 15 min");
          tips.push("Nawodnienie 2.5L");
        } else {
          suggestion = { type: "easy", km: 5, pace: null, hrCap: 140, reason: "Lekka aktywnosc mozliwa" };
        }
      }
      // Plan pending
      else if (ctx.todayPlan && ctx.todayPlan._status === "pending") {
        var planType = classifyType(ctx.todayPlan.type);
        if (planType === "hard" && yesterdayType === "hard") {
          headline = "UWAGA: hard po hard";
          suggestion = {
            type: "easy",
            km: ctx.todayPlan.km,
            pace: null,
            hrCap: 145,
            reason: "Wczoraj tez byl ciezki trening — przesun lub zamien na easy"
          };
        } else {
          headline = "Trening zgodnie z planem";
          suggestion = {
            type: "as_planned",
            km: ctx.todayPlan.km,
            pace: ctx.todayPlan.pace,
            hrCap: null,
            reason: ctx.todayPlan.type + " " + ctx.todayPlan.km + " km"
          };
        }
      }
      // No plan today
      else {
        if (yesterdayType === "hard" || ctx.consecutive >= 3) {
          headline = "Dzien odpoczynku";
          suggestion = { type: "rest", km: 0, pace: null, hrCap: null, reason: "Regeneracja po " + ctx.consecutive + " dniach treningowych" };
        } else {
          headline = "Dzien bez planu";
          suggestion = { type: "easy", km: 6, pace: null, hrCap: 140, reason: "Opcjonalny lekki bieg" };
        }
      }
    }

    // === ADD CONTEXT TIPS ===
    if (ctx.tomorrowPlan) {
      var tomType = classifyType(ctx.tomorrowPlan.type);
      if (tomType === "hard") {
        tips.push("Jutro: " + ctx.tomorrowPlan.type + " " + (ctx.tomorrowPlan.km||"") + " km — oszczedzaj sily");
      }
    }

    // Weather tip from yesterday
    if (ctx.yesterdayAct && ctx.yesterdayAct._weather) {
      var w = ctx.yesterdayAct._weather;
      if (w.temp > 25) tips.push("Wczoraj " + w.temp + "C — HR moglby byc podwyzszony, to normalne");
      if (w.humidity > 70) tips.push("Wilgotnosc wczoraj " + w.humidity + "% — dodatkowe obciazenie");
    }

    // Phase tip
    if (ctx.phase === "build") tips.push("Faza Build — stopniowo zwiekszaj objetosc");
    if (ctx.phase === "peak") tips.push("Faza Peak — max intensywnosc, unikaj przetrenowania");
    if (ctx.phase === "base") tips.push("Faza Base — buduj wytrzymalosc, wiecej easy km");

    // Build result
    return {
      headline: headline,
      suggestion: suggestion,
      context: {
        phase: ctx.phase,
        daysToRace: ctx.daysToRace,
        weekInPlan: ctx.weekInPlan,
        fitness: ff,
        trend: ff ? ff.trend : "unknown",
        weekKm: ctx.weekKm,
        weekSessions: ctx.weekSessions,
        consecutive: ctx.consecutive
      },
      patterns: patterns,
      insights: patterns.insights || [],
      tips: tips,
      warnings: warnings,
      race: race ? {
        name: RACE.name,
        daysLeft: ctx.daysToRace,
        prediction: race.predictedTime,
        predictedPace: race.predictedPace,
        targetPace: RACE.targetPace,
        status: race.status,
        basedOn: race.basedOn
      } : null,
      confidence: Math.round(
        (ff ? 30 : 0) +
        (ctx.todayPlan ? 15 : 0) +
        (patterns.confidence > 50 ? 25 : 10) +
        (race ? 15 : 5) +
        (ctx.yesterdayAct ? 10 : 0)
      ),
      dataLevel: dataLevel,
      safety: SAFETY
    };
  }

  return {
    getAdvice: getAdvice,
    calcFitnessFatigue: calcFitnessFatigue,
    predictRace: predictRace,
    learnPatterns: learnPatterns,
    RACE: RACE,
    SAFETY: SAFETY,
    _activityLoad: activityLoad
  };
})();
