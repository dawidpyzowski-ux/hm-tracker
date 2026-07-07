
/* plan-matcher.js v1 — Sprint 30: Fuzzy plan matcher with similarity scoring */
var PlanMatcher = (function() {
  "use strict";
  var TAG = "[PlanMatcher]";
  
  // Confidence thresholds
  var HIGH_CONFIDENCE = 85;
  var MEDIUM_CONFIDENCE = 70;
  var MAX_DAYS_RANGE = 3; // ±3 days
  
  function paceToSec(p) {
    if (!p) return 0;
    var parts = String(p).split(':');
    if (parts.length !== 2) return 0;
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  
  // Parse plan pace which can be:
  //   "5:05" → 305 (single value)
  //   "5:05-5:10" → 305-310 (range, use avg 307)
  //   "6:30-6:40" → 390-400 (avg 395)
  //   "mieszane" → null (no comparison)
  function parsePlanPace(planPace) {
    if (!planPace) return null;
    var pStr = String(planPace).toLowerCase();
    if (pStr.indexOf('mieszane') >= 0 || pStr.indexOf('mixed') >= 0) return null;
    
    var match = pStr.match(/(\d+):(\d+)(?:\s*[-–]\s*(\d+):(\d+))?/);
    if (!match) return null;
    
    var s1 = parseInt(match[1]) * 60 + parseInt(match[2]);
    if (match[3] && match[4]) {
      var s2 = parseInt(match[3]) * 60 + parseInt(match[4]);
      return (s1 + s2) / 2; // average
    }
    return s1;
  }
  
  // Detect training type from string
  function detectType(str) {
    if (!str) return null;
    var s = str.toLowerCase();
    if (s.match(/interv|interw/i)) return 'intervals';
    if (s.match(/tempo|threshold|prog/i)) return 'tempo';
    if (s.match(/long/i)) return 'long';
    if (s.match(/fartlek/i)) return 'fartlek';
    if (s.match(/recovery|regen/i)) return 'recovery';
    if (s.match(/easy|lekki/i)) return 'easy';
    if (s.match(/race/i)) return 'race';
    return null;
  }
  
  // ============================================
  // SIMILARITY SCORING — 0-100
  // ============================================
  function scoreMatch(activity, plan) {
    var scores = {
      km: 0,
      pace: 0,
      type: 0,
      date: 0,
      hr: 0
    };
    
    var actKm = parseFloat(activity.km || 0);
    var actPace = paceToSec(activity.pace);
    var actType = detectType(activity.type || activity.workout_type);
    var actHR = parseFloat(activity.avg_hr || activity.average_heartrate || 0);
    var actDate = activity.date;
    
    var planKm = parseFloat(plan.km || 0);
    var planPace = parsePlanPace(plan.pace);
    var planType = detectType(plan.type);
    var planDate = plan.date;
    
    // 1. KM SIMILARITY (35% weight)
    if (planKm > 0 && actKm > 0) {
      var kmDiff = Math.abs(actKm - planKm);
      var kmRatio = kmDiff / Math.max(actKm, planKm);
      if (kmRatio <= 0.05) scores.km = 100;      // <5% diff
      else if (kmRatio <= 0.10) scores.km = 90;  // <10%
      else if (kmRatio <= 0.20) scores.km = 75;
      else if (kmRatio <= 0.30) scores.km = 55;
      else if (kmRatio <= 0.50) scores.km = 30;
      else scores.km = 10;
    }
    
    // 2. PACE SIMILARITY (25% weight)
    if (planPace && actPace > 0) {
      var paceDiff = Math.abs(actPace - planPace);
      if (paceDiff <= 5) scores.pace = 100;        // <5 sec
      else if (paceDiff <= 15) scores.pace = 90;
      else if (paceDiff <= 25) scores.pace = 75;
      else if (paceDiff <= 40) scores.pace = 55;
      else if (paceDiff <= 60) scores.pace = 30;
      else scores.pace = 10;
    } else {
      // "mieszane" pace → neutral score (nie karać za brak)
      scores.pace = 60;
    }
    
    // 3. TYPE SIMILARITY (25% weight)
    if (planType && actType) {
      if (planType === actType) scores.type = 100;
      // Similar types:
      else if ((planType === 'intervals' || planType === 'tempo' || planType === 'fartlek') &&
               (actType === 'intervals' || actType === 'tempo' || actType === 'fartlek')) scores.type = 80;
      else if ((planType === 'easy' || planType === 'recovery') && 
               (actType === 'easy' || actType === 'recovery')) scores.type = 85;
      else scores.type = 20;
    } else {
      // Missing type info → neutral
      scores.type = 50;
    }
    
    // 4. DATE PROXIMITY (10% weight)
    var dateDiff = Math.abs(new Date(actDate) - new Date(planDate)) / 86400000;
    if (dateDiff === 0) scores.date = 100;
    else if (dateDiff <= 1) scores.date = 80;
    else if (dateDiff <= 2) scores.date = 60;
    else if (dateDiff <= 3) scores.date = 40;
    else scores.date = 15;
    
    // 5. HR CONTEXT (5% weight, optional)
    // Higher HR usually = harder workout
    if (actHR > 0) {
      if (planType === 'intervals' || planType === 'tempo') {
        if (actHR >= 165) scores.hr = 100;
        else if (actHR >= 155) scores.hr = 80;
        else if (actHR >= 145) scores.hr = 50;
        else scores.hr = 20;
      } else if (planType === 'easy' || planType === 'recovery') {
        if (actHR <= 140) scores.hr = 100;
        else if (actHR <= 150) scores.hr = 80;
        else if (actHR <= 160) scores.hr = 40;
        else scores.hr = 15;
      } else {
        scores.hr = 60;
      }
    } else {
      scores.hr = 50;
    }
    
    // Weighted total
    var total = 
      scores.km * 0.35 +
      scores.pace * 0.25 +
      scores.type * 0.25 +
      scores.date * 0.10 +
      scores.hr * 0.05;
    
    return {
      total: Math.round(total),
      scores: scores,
      plan: plan
    };
  }
  
  // ============================================
  // FIND BEST MATCH for activity
  // ============================================
  function findBestMatch(activity, options) {
    options = options || {};
    var daysRange = options.daysRange || MAX_DAYS_RANGE;
    var minScore = options.minScore || 0;
    
    if (!activity || !activity.date) return null;
    if (typeof window.PLAN_FLAT === 'undefined') return null;
    
    var actDate = new Date(activity.date);
    var candidates = window.PLAN_FLAT.filter(function(p) {
      if (!p.date) return false;
      var dateDiff = Math.abs(new Date(p.date) - actDate) / 86400000;
      return dateDiff <= daysRange;
    });
    
    var matches = candidates.map(function(plan) {
      return scoreMatch(activity, plan);
    });
    
    matches.sort(function(a, b) { return b.total - a.total; });
    
    var best = matches[0];
    if (!best || best.total < minScore) return null;
    
    return {
      match: best,
      all_candidates: matches.slice(0, 6), // top 6
      confidence_level: best.total >= HIGH_CONFIDENCE ? 'high' :
                       best.total >= MEDIUM_CONFIDENCE ? 'medium' : 'low'
    };
  }
  
  // ============================================
  // GET EFFECTIVE PLAN for activity
  // Sprawdza override, jeśli brak → auto match
  // ============================================
  function getEffectivePlan(activity) {
    if (!activity) return null;
    
    // 1. Check manual override
    if (typeof PlanOverridesStore !== 'undefined') {
      var override = PlanOverridesStore.getForActivity(
        activity.strava_id || activity.id
      );
     
      if (override) {
        if (override.skip_plan) {
          return { source: 'override_skip', plan: null };
        }
        
        // Enhance override plan by looking up FULL data from PLAN_FLAT (get notes/desc)
        var fullPlan = null;
        if (window.PLAN_FLAT && override.matched_plan_date) {
          fullPlan = window.PLAN_FLAT.find(function(p) {
            return p.date === override.matched_plan_date && 
                   p.type === override.matched_plan_type;
          });
        }
        
        return {
          source: 'override_manual',
          plan: fullPlan || {
            date: override.matched_plan_date,
            type: override.matched_plan_type,
            km: override.matched_plan_km,
            pace: override.matched_plan_pace
          },
          confidence: override.confidence,
          matched_by: override.matched_by
        };
      }

    }
    
    // 2. Auto-match
    var match = findBestMatch(activity, { minScore: MEDIUM_CONFIDENCE });
    if (match) {
      return {
        source: 'auto',
        plan: match.match.plan,
        confidence: match.match.total,
        confidence_level: match.confidence_level,
        all_candidates: match.all_candidates
      };
    }
    
    // 3. Fallback: exact date match if any
    if (window.PLAN_FLAT) {
      var exact = window.PLAN_FLAT.find(function(p) {
        return p.date === activity.date;
      });
      if (exact) {
        return {
          source: 'exact_date',
          plan: exact,
          confidence: 50,
          confidence_level: 'low'
        };
      }
    }
    
    return null;
  }

  // ============================================
  // GET EFFECTIVE CLASSIFICATION
  // Używa matched plan zamiast surowej Strava name
  // ============================================
  function getEffectiveClassification(activity) {
    if (!activity) return null;
    if (typeof TrainingClassifier === 'undefined') return null;
    
    // 1. Get effective plan (uses override or auto-match)
    var effective = getEffectivePlan(activity);
    
    // 2. Determine which type to classify
    var typeToClassify;
    var source;
    
    if (effective && effective.source === 'override_skip') {
      // User marked as "poza planem" — use raw activity type
      typeToClassify = activity.type || activity.workout_type;
      source = 'raw_extra';
    } else if (effective && effective.plan && effective.plan.type) {
      // Use matched plan type (bardziej trafne niż Strava name)
      typeToClassify = effective.plan.type;
      source = effective.source;
    } else {
      // Fallback: raw activity type
      typeToClassify = activity.type || activity.workout_type;
      source = 'raw_only';
    }
    
    // 3. Classify
    var classification = TrainingClassifier.classifyWithMetadata(typeToClassify);
    
    return {
      classification: classification,
      matched_plan: effective && effective.plan ? effective.plan : null,
      source: source,
      confidence: effective ? effective.confidence : null,
      raw_type: activity.type || activity.workout_type
    };
  }

  
  // ============================================
  // GET EFFECTIVE TYPE (simplest wrapper for other modules)
  // Returns string: matched plan type OR raw activity type
  // ============================================
  function getEffectiveType(activity) {
    if (!activity) return null;
    
    // Try PlanMatcher first
    try {
      var eff = getEffectivePlan(activity);
      if (eff && eff.plan && eff.plan.type && !eff.source.includes('skip')) {
        return eff.plan.type;
      }
    } catch(e) {}
    
    // Fallback: raw activity type
    return activity.type || activity.workout_type || null;
  }


  return {
    HIGH_CONFIDENCE: HIGH_CONFIDENCE,
    MEDIUM_CONFIDENCE: MEDIUM_CONFIDENCE,
    scoreMatch: scoreMatch,
    findBestMatch: findBestMatch,
    getEffectivePlan: getEffectivePlan,
    getEffectiveClassification: getEffectiveClassification,  // ← NEW
    parsePlanPace: parsePlanPace,
    getEffectiveType: getEffectiveType,
    detectType: detectType
  };

})();
