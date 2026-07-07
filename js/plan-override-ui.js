
/* plan-override-ui.js v1 — Sprint 30: Modal UI for plan override */
var PlanOverrideUI = (function() {
  "use strict";
  
  function open(activity, onSaved) {
    if (!activity) return;
    var activityId = activity.strava_id || activity.id;
    
    // Get current match info
    var effective = PlanMatcher.getEffectivePlan(activity);
    var candidates = effective && effective.all_candidates ? effective.all_candidates : [];
    
    // If no candidates from auto (skip), get top 6 from range
    if (!candidates.length) {
      var match = PlanMatcher.findBestMatch(activity, { daysRange: 5, minScore: 0 });
      if (match) candidates = match.all_candidates;
    }
    
    var currentOverride = typeof PlanOverridesStore !== 'undefined' 
      ? PlanOverridesStore.getForActivity(activityId) : null;
    
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    
    var h = '<div style="background:#111827;border-radius:12px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;border:1px solid #374151;">';
    
    // Header
    h += '<div style="padding:14px;border-bottom:1px solid #374151;display:flex;justify-content:space-between;align-items:center;">';
    h += '<h3 style="margin:0;color:#f9fafb;font-size:1em;">📌 Przypisz do planu</h3>';
    h += '<button onclick="this.closest(\'div[style*=\\\'fixed\\\']\').remove()" style="background:#374151;border:none;color:white;width:32px;height:32px;border-radius:50%;cursor:pointer;">✕</button>';
    h += '</div>';
    
    h += '<div style="padding:14px;">';
    
    // Activity info
    h += '<div style="background:#1f2937;border-radius:8px;padding:12px;margin-bottom:12px;">';
    h += '<div style="color:#9ca3af;font-size:0.75em;margin-bottom:4px;">Twój trening</div>';
    h += '<div style="color:#f9fafb;font-weight:600;">📅 ' + activity.date + '</div>';
    h += '<div style="color:#d1d5db;font-size:0.9em;">' + 
      (activity.type || 'Bez typu') + ' · ' + 
      (activity.km || 0) + 'km · ' +
      (activity.pace || '?') + '/km' +
      (activity.avg_hr ? ' · HR ' + activity.avg_hr : '') +
      '</div>';
    h += '</div>';
    
    // Current override state
    if (currentOverride) {
      var srcLabel = currentOverride.matched_by === 'manual' ? '✍️ Ręcznie' : '🤖 Auto';
      h += '<div style="background:#0f172a;border-left:3px solid #3b82f6;padding:10px;border-radius:6px;margin-bottom:12px;">';
      h += '<div style="color:#60a5fa;font-size:0.85em;font-weight:600;">Obecne przypisanie (' + srcLabel + '):</div>';
      if (currentOverride.skip_plan) {
        h += '<div style="color:#f9fafb;margin-top:4px;">⏭️ Poza planem (nie liczy do żadnego planu)</div>';
      } else {
        h += '<div style="color:#f9fafb;margin-top:4px;">' + 
          currentOverride.matched_plan_date + ' — ' + 
          currentOverride.matched_plan_type + ' (' + 
          currentOverride.matched_plan_km + 'km)</div>';
      }
      h += '</div>';
    }
    
    // Candidates list
    h += '<div style="color:#9ca3af;font-size:0.85em;margin-bottom:8px;font-weight:600;">Wybierz plan:</div>';
    h += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;">';
    
    candidates.forEach(function(cand, i) {
      var isCurrentSelection = currentOverride && 
        currentOverride.matched_plan_date === cand.plan.date &&
        currentOverride.matched_plan_type === cand.plan.type;
      
      var confColor = cand.total >= 85 ? '#22c55e' :
                     cand.total >= 70 ? '#84cc16' :
                     cand.total >= 50 ? '#f59e0b' : '#ef4444';
      
      var dateLabel = cand.plan.date === activity.date ? 'DZISIAJ' : cand.plan.date;
      var dateDiff = Math.round((new Date(cand.plan.date) - new Date(activity.date)) / 86400000);
      var dayDiffLabel = dateDiff === 0 ? '' : 
                        dateDiff > 0 ? ' (+' + dateDiff + 'd)' : ' (' + dateDiff + 'd)';
      
      var borderColor = isCurrentSelection ? '#3b82f6' : '#374151';
      var bgColor = isCurrentSelection ? '#1e3a8a' : '#374151';
      
      h += '<div onclick="PlanOverrideUI.selectCandidate(' + i + ')" ' +
        'style="background:' + bgColor + ';padding:10px;border-radius:8px;cursor:pointer;border:2px solid ' + borderColor + ';">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
      h += '<div style="color:#f9fafb;font-weight:600;font-size:0.9em;">' + 
        dateLabel + dayDiffLabel + '</div>';
      h += '<div style="background:' + confColor + ';color:white;padding:2px 8px;border-radius:4px;font-size:0.75em;font-weight:600;">' + 
        cand.total + '%</div>';
      h += '</div>';
      h += '<div style="color:#d1d5db;font-size:0.85em;">' + 
        cand.plan.type + ' · ' + (cand.plan.km || 0) + 'km · @ ' + 
        (cand.plan.pace || 'mieszane') + '</div>';
      
      // Score breakdown
      h += '<div style="color:#6b7280;font-size:0.7em;margin-top:4px;">';
      h += 'Km:' + cand.scores.km + '% · Pace:' + cand.scores.pace + 
        '% · Type:' + cand.scores.type + '% · Date:' + cand.scores.date + '%';
      h += '</div>';
      h += '</div>';
    });
    
    if (!candidates.length) {
      h += '<div style="color:#9ca3af;text-align:center;padding:20px;font-size:0.85em;">Brak planów w zakresie ±3 dni</div>';
    }
    
    h += '</div>';
    
    // Other options
    h += '<div style="border-top:1px solid #374151;padding-top:12px;">';
    h += '<button onclick="PlanOverrideUI.markExtra()" style="width:100%;padding:12px;background:#6b7280;color:white;border:none;border-radius:8px;font-weight:600;margin-bottom:6px;">⏭️ Poza planem (extra trening)</button>';
    
    if (currentOverride) {
      h += '<button onclick="PlanOverrideUI.removeOverride()" style="width:100%;padding:12px;background:#dc2626;color:white;border:none;border-radius:8px;font-weight:600;">🔄 Zresetuj do auto</button>';
    }
    
    h += '</div>';
    
    h += '</div>';
    h += '</div>';
    
    overlay.innerHTML = h;
    document.body.appendChild(overlay);
    
    // Store context for callbacks
    window._planOverrideContext = {
      activity: activity,
      activityId: activityId,
      candidates: candidates,
      overlay: overlay,
      onSaved: onSaved
    };
  }
  
  function selectCandidate(idx) {
    var ctx = window._planOverrideContext;
    if (!ctx) return;
    var cand = ctx.candidates[idx];
    if (!cand) return;
    
    var override = {
      activity_date: ctx.activity.date,
      matched_plan_date: cand.plan.date,
      matched_plan_type: cand.plan.type,
      matched_plan_km: cand.plan.km,
      matched_plan_pace: cand.plan.pace,
      confidence: cand.total,
      matched_by: 'manual',
      skip_plan: false,
      original_plan_marked_skipped: cand.plan.date !== ctx.activity.date
    };
    
    PlanOverridesStore.set(ctx.activityId, override);
    ctx.overlay.remove();
    
    if (ctx.onSaved) ctx.onSaved(override);
    else location.reload(); // fallback: refresh view
  }
  
  function markExtra() {
    var ctx = window._planOverrideContext;
    if (!ctx) return;
    
    var override = {
      activity_date: ctx.activity.date,
      matched_plan_date: null,
      matched_plan_type: null,
      matched_plan_km: null,
      matched_plan_pace: null,
      confidence: 100,
      matched_by: 'manual',
      skip_plan: true,
      original_plan_marked_skipped: false
    };
    
    PlanOverridesStore.set(ctx.activityId, override);
    ctx.overlay.remove();
    
    if (ctx.onSaved) ctx.onSaved(override);
    else location.reload();
  }
  
  function removeOverride() {
    var ctx = window._planOverrideContext;
    if (!ctx) return;
    if (!confirm('Zresetować do auto-match?')) return;
    
    PlanOverridesStore.remove(ctx.activityId);
    ctx.overlay.remove();
    
    if (ctx.onSaved) ctx.onSaved(null);
    else location.reload();
  }
  
  window.PlanOverrideUI = {
    open: open,
    selectCandidate: selectCandidate,
    markExtra: markExtra,
    removeOverride: removeOverride
  };
  
  return window.PlanOverrideUI;
})();
