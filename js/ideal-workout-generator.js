
/* ideal-workout-generator.js v1 — Sprint 31: Generate ideal workout profiles
   Based on: CP + VDOT/McMillan + HR zones + HM target pace
   Supports: Easy, Recovery, Long, Tempo, Intervals
*/
var IdealWorkoutGenerator = (function() {
  "use strict";
  var TAG = "[IdealGen]";
  
  // ============================================
  // ATHLETE PROFILE (auto-detected from data)
  // ============================================
  function getAthleteProfile() {
    var profile = {
      // Defaults dla biegacza HM target 4:59
      hm_target_pace: 299,     // 4:59 in seconds/km
      hm_target_time: 6314,    // 1:45:14 in seconds
      current_cp: 200,          // Watts
      target_cp: 220,           // For 4:59
      vo2max: 50.2,
      weight_kg: 74.7,
      max_hr: 185,              // 220 - age 35
      rhr: 56,
      hrv_baseline: 51,
      race_date: '2026-09-06',
      days_to_race: 60
    };
    
    // Update z real data jeśli dostępne
    if (typeof HealthImport !== "undefined") {
      var baselines = HealthImport.getBaselines();
      if (baselines.rhr) profile.rhr = baselines.rhr;
      if (baselines.hrv) profile.hrv_baseline = baselines.hrv;
    }
    
    if (typeof BodyTracker !== "undefined") {
      var w = BodyTracker.getCurrentWeight ? BodyTracker.getCurrentWeight() : null;
      if (w) profile.weight_kg = w;
    }
    
    // Compute days to race
    var raceD = new Date(profile.race_date);
    var today = new Date();
    profile.days_to_race = Math.floor((raceD - today) / 86400000);
    
    return profile;
  }
  
  // ============================================
  // TRAINING PACE CALCULATOR (McMillan-based)
  // Bazuje na HM target pace + fitness level
  // ============================================
  function calculateTrainingPaces(profile) {
    var hm = profile.hm_target_pace; // 299 s/km for 4:59
    
    // McMillan-inspired ratios (dostosowane dla amateur runner)
    return {
      // Recovery: 65-75% max HR, very easy
      recovery_pace: {
        min: hm + 100,   // 4:59 + 1:40 = 6:39
        max: hm + 120,   // 4:59 + 2:00 = 6:59
        target: hm + 110 // 6:49
      },
      // Easy: Z2, aerobic base
      easy_pace: {
        min: hm + 80,    // 6:19
        max: hm + 100,   // 6:39
        target: hm + 90  // 6:29
      },
      // Long run: aerobic endurance
      long_pace: {
        min: hm + 60,    // 5:59
        max: hm + 85,    // 6:24
        target: hm + 72  // 6:11
      },
      // Marathon pace (jeśli mielibyśmy)
      marathon_pace: {
        target: hm + 20  // 5:19
      },
      // HM pace (race pace)
      hm_pace: {
        target: hm       // 4:59
      },
      // Tempo/Threshold: 15-25 sec faster than HM
      tempo_pace: {
        min: hm + 6,     // 5:05
        max: hm + 11,    // 5:10
        target: hm + 8   // 5:07
      },
      // 10K pace
      pace_10k: {
        target: hm - 12  // 4:47
      },
      // Interval pace (VO2max, 3-5min efforts)
      interval_pace: {
        min: hm - 15,    // 4:44
        max: hm - 5,     // 4:54
        target: hm - 10  // 4:49
      },
      // 5K pace
      pace_5k: {
        target: hm - 20  // 4:39
      },
      // Speed work (1-2 min efforts)
      speed_pace: {
        min: hm - 30,    // 4:29
        max: hm - 20,    // 4:39
        target: hm - 25  // 4:34
      }
    };
  }
  
  // ============================================
  // HR ZONES (Karvonen method)
  // ============================================
  function calculateHRZones(profile) {
    var rhr = profile.rhr;
    var maxHR = profile.max_hr;
    var hrr = maxHR - rhr;
    
    return {
      z1: { min: rhr + Math.round(hrr * 0.50), max: rhr + Math.round(hrr * 0.60), label: 'Z1 Recovery' },
      z2: { min: rhr + Math.round(hrr * 0.60), max: rhr + Math.round(hrr * 0.70), label: 'Z2 Aerobic' },
      z3: { min: rhr + Math.round(hrr * 0.70), max: rhr + Math.round(hrr * 0.80), label: 'Z3 Tempo' },
      z4: { min: rhr + Math.round(hrr * 0.80), max: rhr + Math.round(hrr * 0.90), label: 'Z4 Threshold' },
      z5: { min: rhr + Math.round(hrr * 0.90), max: maxHR, label: 'Z5 VO2max' }
    };
  }
  
  // ============================================
  // POWER TARGETS (dla runningu, opcjonalne)
  // ============================================
  function calculatePowerTargets(profile) {
    var cp = profile.current_cp;
    return {
      recovery: { target: Math.round(cp * 0.55) },
      easy: { target: Math.round(cp * 0.65) },
      long: { target: Math.round(cp * 0.72) },
      marathon: { target: Math.round(cp * 0.85) },
      hm: { target: Math.round(cp * 0.90) },
      tempo: { target: Math.round(cp * 0.95) },
      threshold: { target: Math.round(cp * 1.00) },
      interval: { target: Math.round(cp * 1.05) },
      vo2: { target: Math.round(cp * 1.15) }
    };
  }
  
  // ============================================
  // GENERATE IDEAL WORKOUT PROFILE per KM
  // ============================================
  function generateEasyProfile(km, paces, hrZones, powers) {
    var profile = [];
    for (var i = 1; i <= Math.floor(km); i++) {
      // Progressive warmup pierwszej połowie
      var isWU = i <= Math.min(2, Math.floor(km / 4));
      var pace = isWU ? paces.easy_pace.max : paces.easy_pace.target;
      var hrRange = isWU ? [hrZones.z1.max - 5, hrZones.z2.min + 5] : [hrZones.z2.min, hrZones.z2.max];
      
      profile.push({
        km: i,
        segment: isWU ? 'warmup' : 'easy',
        pace_target: pace,
        pace_range: [paces.easy_pace.min, paces.easy_pace.max],
        hr_target: Math.round((hrRange[0] + hrRange[1]) / 2),
        hr_range: hrRange,
        power_target: isWU ? powers.recovery.target : powers.easy.target,
        zone: 'Z2',
        effort: 'easy conversational'
      });
    }
    return profile;
  }
  
  function generateRecoveryProfile(km, paces, hrZones, powers) {
    var profile = [];
    for (var i = 1; i <= Math.floor(km); i++) {
      profile.push({
        km: i,
        segment: 'recovery',
        pace_target: paces.recovery_pace.target,
        pace_range: [paces.recovery_pace.min, paces.recovery_pace.max],
        hr_target: Math.round((hrZones.z1.max + hrZones.z2.min) / 2),
        hr_range: [hrZones.z1.min, hrZones.z2.min + 5],
        power_target: powers.recovery.target,
        zone: 'Z1-Z2',
        effort: 'very easy conversational'
      });
    }
    return profile;
  }
  
  function generateLongRunProfile(km, paces, hrZones, powers) {
    var profile = [];
    var totalKm = Math.floor(km);
    
    // Warmup 2-3km slow
    var wuEnd = Math.min(3, Math.floor(totalKm / 6));
    
    // Progressive long: middle section might have marathon pace
    var hasMarathonSegment = totalKm >= 15;
    var marathonStart = hasMarathonSegment ? Math.floor(totalKm * 0.5) : totalKm + 1;
    var marathonEnd = hasMarathonSegment ? Math.floor(totalKm * 0.75) : totalKm + 1;
    
    for (var i = 1; i <= totalKm; i++) {
      var segment, pace, hrRange, power, zone, effort;
      
      if (i <= wuEnd) {
        segment = 'warmup';
        pace = paces.easy_pace.max;
        hrRange = [hrZones.z1.max, hrZones.z2.min + 10];
        power = powers.recovery.target;
        zone = 'Z1-Z2';
        effort = 'easy warmup';
      } else if (i >= marathonStart && i <= marathonEnd) {
        segment = 'marathon_pace';
        pace = paces.marathon_pace.target;
        hrRange = [hrZones.z3.min, hrZones.z3.min + 10];
        power = powers.marathon.target;
        zone = 'Z3';
        effort = 'controlled hard';
      } else if (i > totalKm - 2) {
        segment = 'cooldown';
        pace = paces.easy_pace.max;
        hrRange = [hrZones.z1.max, hrZones.z2.min];
        power = powers.easy.target;
        zone = 'Z2';
        effort = 'progressive slowdown';
      } else {
        segment = 'long_steady';
        pace = paces.long_pace.target;
        hrRange = [hrZones.z2.min + 5, hrZones.z2.max];
        power = powers.long.target;
        zone = 'Z2';
        effort = 'steady aerobic';
      }
      
      profile.push({
        km: i,
        segment: segment,
        pace_target: pace,
        pace_range: [pace - 15, pace + 15],
        hr_target: Math.round((hrRange[0] + hrRange[1]) / 2),
        hr_range: hrRange,
        power_target: power,
        zone: zone,
        effort: effort
      });
    }
    return profile;
  }
  
  function generateTempoProfile(km, paces, hrZones, powers, planDesc) {
    var profile = [];
    var totalKm = Math.floor(km);
    
    // Parse plan for structure
    var desc = String(planDesc || '').toLowerCase();
    var wuKm = 2, cdKm = 2, tempoKm = totalKm - 4;
    
    var wuMatch = desc.match(/(\d+\.?\d*)\s*km\s*wu/);
    if (wuMatch) wuKm = parseFloat(wuMatch[1]);
    
    var cdMatch = desc.match(/(\d+\.?\d*)\s*km\s*cd/);
    if (cdMatch) cdKm = parseFloat(cdMatch[1]);
    
    tempoKm = totalKm - wuKm - cdKm;
    if (tempoKm < 1) tempoKm = Math.floor(totalKm * 0.5);
    
    // Determine tempo pace from plan if specified
    var tempoTarget = paces.tempo_pace.target;
    var paceMatch = desc.match(/@\s*(\d+):(\d+)(?:\s*-\s*(\d+):(\d+))?/);
    if (paceMatch) {
      var p1 = parseInt(paceMatch[1]) * 60 + parseInt(paceMatch[2]);
      var p2 = paceMatch[3] ? (parseInt(paceMatch[3]) * 60 + parseInt(paceMatch[4])) : p1;
      tempoTarget = Math.round((p1 + p2) / 2);
    }
    
    var wuEnd = Math.floor(wuKm);
    var tempoEnd = wuEnd + Math.floor(tempoKm);
    
    for (var i = 1; i <= totalKm; i++) {
      var segment, pace, hrRange, power, zone, effort;
      
      if (i <= wuEnd) {
        // WU: progressive
        segment = 'warmup';
        pace = i === 1 ? paces.easy_pace.max : paces.easy_pace.target;
        hrRange = i === 1 ? [hrZones.z1.max - 5, hrZones.z2.min] : [hrZones.z2.min, hrZones.z2.min + 15];
        power = i === 1 ? powers.recovery.target : powers.easy.target;
        zone = 'Z1-Z2';
        effort = 'progressive warmup';
      } else if (i <= tempoEnd) {
        // TEMPO: threshold effort
        var tempoIdx = i - wuEnd;
        // Slight HR crescendo (max +7 bpm from start to end of tempo)
        var hrStart = hrZones.z4.min;
        var hrEnd = hrZones.z4.min + Math.min(7, Math.floor(tempoKm * 2));
        var hrProgress = tempoKm > 1 ? (tempoIdx - 1) / (tempoKm - 1) : 0;
        var hrTarget = Math.round(hrStart + (hrEnd - hrStart) * hrProgress);
        
        segment = 'tempo';
        pace = tempoTarget;
        hrRange = [hrTarget - 3, hrTarget + 3];
        power = powers.tempo.target;
        zone = 'Z4';
        effort = 'comfortably hard threshold';
      } else {
        // CD: progressive slowdown
        var cdIdx = i - tempoEnd;
        var cdKmCount = totalKm - tempoEnd;
        var slowdownRatio = cdKmCount > 1 ? cdIdx / cdKmCount : 1;
        // From tempo pace slowing progressive to easy
        pace = Math.round(tempoTarget + (paces.easy_pace.target - tempoTarget) * 0.7 + slowdownRatio * 40);
        
        segment = 'cooldown';
        hrRange = [hrZones.z2.min + 10 - cdIdx * 5, hrZones.z3.min - cdIdx * 5];
        power = powers.easy.target;
        zone = 'Z2-Z3';
        effort = 'progressive cooldown';
      }
      
      profile.push({
        km: i,
        segment: segment,
        pace_target: pace,
        pace_range: [pace - 5, pace + 5],
        hr_target: Math.round((hrRange[0] + hrRange[1]) / 2),
        hr_range: hrRange,
        power_target: power,
        zone: zone,
        effort: effort
      });
    }
    return profile;
  }
  
  function generateIntervalsProfile(km, paces, hrZones, powers, planDesc) {
    var profile = [];
    var totalKm = Math.floor(km);
    
    // Parse plan for structure
    var desc = String(planDesc || '').toLowerCase();
    var reps = 5, repDist = 1.0;
    
    var intMatch = desc.match(/(\d+)\s*x\s*(\d+\.?\d*)\s*km/);
    if (intMatch) {
      reps = parseInt(intMatch[1]);
      repDist = parseFloat(intMatch[2]);
    }
    
    var wuKm = 2, cdKm = 2;
    // Approximate rest distance ~0.5km per rep
    var restKmTotal = (reps - 1) * 0.5;
    var totalWorkKm = reps * repDist;
    
    // Determine interval pace
    var intPace = paces.interval_pace.target;
    var paceMatch = desc.match(/@\s*(\d+):(\d+)(?:\s*-\s*(\d+):(\d+))?/);
    if (paceMatch) {
      var p1 = parseInt(paceMatch[1]) * 60 + parseInt(paceMatch[2]);
      var p2 = paceMatch[3] ? (parseInt(paceMatch[3]) * 60 + parseInt(paceMatch[4])) : p1;
      intPace = Math.round((p1 + p2) / 2);
    }
    
    var wuEnd = Math.floor(wuKm);
    var workEnd = wuEnd + Math.floor(totalWorkKm + restKmTotal);
    
    for (var i = 1; i <= totalKm; i++) {
      var segment, pace, hrRange, power, zone, effort;
      
      if (i <= wuEnd) {
        segment = 'warmup';
        pace = i === 1 ? paces.easy_pace.max : paces.easy_pace.target;
        hrRange = [hrZones.z1.max - 5, hrZones.z2.min + 10];
        power = powers.easy.target;
        zone = 'Z1-Z2';
        effort = 'progressive warmup';
      } else if (i <= workEnd) {
        // Approximation: alternating work/rest
        segment = 'interval_mix';
        pace = intPace + 30; // Mix of work + rest ≈ +30s slower than pure work pace
        hrRange = [hrZones.z4.max - 5, hrZones.z5.min + 5];
        power = powers.threshold.target;
        zone = 'Z4-Z5';
        effort = 'work + short recovery';
      } else {
        segment = 'cooldown';
        pace = paces.easy_pace.max;
        hrRange = [hrZones.z2.min - 5, hrZones.z2.min + 15];
        power = powers.easy.target;
        zone = 'Z2';
        effort = 'progressive cooldown';
      }
      
      profile.push({
        km: i,
        segment: segment,
        pace_target: pace,
        pace_range: [pace - 10, pace + 10],
        hr_target: Math.round((hrRange[0] + hrRange[1]) / 2),
        hr_range: hrRange,
        power_target: power,
        zone: zone,
        effort: effort
      });
    }
    return profile;
  }
  
  // ============================================
  // MAIN: GENERATE for workout type
  // ============================================
  function generate(workoutType, km, planDesc) {
    var profile = getAthleteProfile();
    var paces = calculateTrainingPaces(profile);
    var hrZones = calculateHRZones(profile);
    var powers = calculatePowerTargets(profile);
    
    // Classify workout type
    var category = null;
    if (typeof TrainingClassifier !== 'undefined') {
      category = TrainingClassifier.classify(workoutType);
    }
    
    if (!category) {
      // Fallback detect
      var t = String(workoutType || '').toLowerCase();
      if (t.indexOf('interv') >= 0) category = 'intervals';
      else if (t.indexOf('tempo') >= 0) category = 'tempo';
      else if (t.indexOf('long') >= 0) category = 'long';
      else if (t.indexOf('recovery') >= 0 || t.indexOf('regen') >= 0) category = 'recovery';
      else category = 'easy';
    }
    
    var kmProfile;
    switch (category) {
      case 'intervals':
        kmProfile = generateIntervalsProfile(km, paces, hrZones, powers, planDesc);
        break;
      case 'tempo':
        kmProfile = generateTempoProfile(km, paces, hrZones, powers, planDesc);
        break;
      case 'long':
        kmProfile = generateLongRunProfile(km, paces, hrZones, powers);
        break;
      case 'recovery':
        kmProfile = generateRecoveryProfile(km, paces, hrZones, powers);
        break;
      default:
        kmProfile = generateEasyProfile(km, paces, hrZones, powers);
    }
    
    // Compute overall metrics
    var totalPaceTime = 0;
    var totalHR = 0;
    kmProfile.forEach(function(k) {
      totalPaceTime += k.pace_target;
      totalHR += k.hr_target;
    });
    var avgPace = Math.round(totalPaceTime / kmProfile.length);
    var avgHR = Math.round(totalHR / kmProfile.length);
    var totalTime = totalPaceTime; // seconds
    
    return {
      workout_type: workoutType,
      category: category,
      total_km: km,
      km_profile: kmProfile,
      overall: {
        total_time_sec: totalTime,
        avg_pace: avgPace,
        avg_hr: avgHR
      },
      paces: paces,
      hr_zones: hrZones,
      power_targets: powers,
      athlete_profile: profile
    };
  }
  
  return {
    generate: generate,
    getAthleteProfile: getAthleteProfile,
    calculateTrainingPaces: calculateTrainingPaces,
    calculateHRZones: calculateHRZones,
    calculatePowerTargets: calculatePowerTargets
  };
})();
