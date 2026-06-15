/* iphone-fix.js v3 */
(function(){"use strict";
var TAG="[iPhone-Fix]";
var meta=document.querySelector('meta[name="viewport"]');
if(meta){var c=meta.getAttribute("content")||"";if(c.indexOf("viewport-fit")<0)meta.setAttribute("content",c+", viewport-fit=cover");}
function fixDups(){
  var wlogs=document.querySelectorAll(".wlog");
  if(wlogs.length<2)return;
  var seen=[],removed=0;
  wlogs.forEach(function(w){
    var km=w.querySelector(".wlog-km");
    var pace=w.querySelector(".wlog-pace");
    var hr=w.querySelector(".wlog-hr");
    if(!km)return;
    var key=km.textContent.trim()+"|"+(pace?pace.textContent.trim():"")+"|"+(hr?hr.textContent.trim():"");
    var isDup=false;
    for(var i=0;i<seen.length;i++){if(seen[i]===key){isDup=true;break;}}
    if(isDup){w.remove();removed++;}
    else{seen.push(key);}
  });
  if(removed>0)console.log(TAG,"Removed",removed,"duplicate(s)");
}
setTimeout(fixDups,2000);
setTimeout(fixDups,4000);
console.log(TAG,"v3 OK");
})();
