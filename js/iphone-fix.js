/* iphone-fix.js - Fix duplicate cards + viewport meta */
(function(){"use strict";
var TAG="[iPhone-Fix]";

// 1. Ensure viewport-fit=cover
var meta = document.querySelector('meta[name="viewport"]');
if(meta){
  var content = meta.getAttribute('content') || '';
  if(content.indexOf('viewport-fit') < 0){
    meta.setAttribute('content', content + ', viewport-fit=cover');
    console.log(TAG, "viewport-fit=cover added");
  }
} else {
  meta = document.createElement('meta');
  meta.name = 'viewport';
  meta.content = 'width=device-width, initial-scale=1.0, viewport-fit=cover';
  document.head.appendChild(meta);
  console.log(TAG, "viewport meta created");
}

// 2. Fix duplicate last run card
function fixDuplicateCards(){
  var wlogs = document.querySelectorAll('.wlog');
  if(wlogs.length < 2) return;
  var seen = {};
  var removed = 0;
  wlogs.forEach(function(wlog){
    var dateEl = wlog.querySelector('.wlog-d');
    var kmEl = wlog.querySelector('.wlog-km');
    if(!dateEl || !kmEl) return;
    var key = dateEl.textContent.trim() + '|' + kmEl.textContent.trim();
    if(seen[key]){
      wlog.remove();
      removed++;
    } else {
      seen[key] = true;
    }
  });
  if(removed > 0) console.log(TAG, "Removed", removed, "duplicate card(s)");
}

setTimeout(fixDuplicateCards, 1500);
setTimeout(fixDuplicateCards, 3000);

var _iphoneObs = new MutationObserver(function(){
  setTimeout(fixDuplicateCards, 500);
});
_iphoneObs.observe(document.body, {childList:true, subtree:true});

// 3. Prevent double-tap zoom
document.addEventListener('dblclick', function(e){ e.preventDefault(); }, {passive:false});

console.log(TAG, "Init OK");
})();
