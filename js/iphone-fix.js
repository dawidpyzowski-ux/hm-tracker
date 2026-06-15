/* iphone-fix.js v2 */
(function(){"use strict";
var TAG="[iPhone-Fix]";
var meta=document.querySelector('meta[name="viewport"]');
if(meta){var c=meta.getAttribute("content")||"";if(c.indexOf("viewport-fit")<0)meta.setAttribute("content",c+", viewport-fit=cover");}
else{meta=document.createElement("meta");meta.name="viewport";meta.content="width=device-width, initial-scale=1.0, viewport-fit=cover";document.head.appendChild(meta);}
function addSpacer(){var ct=document.getElementById("content")||document.querySelector("main");if(ct&&!document.querySelector(".safe-area-spacer")){var s=document.createElement("div");s.className="safe-area-spacer";s.setAttribute("aria-hidden","true");ct.insertBefore(s,ct.firstChild);console.log(TAG,"Spacer added");}}
setTimeout(addSpacer,500);
function fixDups(){var wlogs=document.querySelectorAll(".wlog");if(wlogs.length<2)return;var cards=[];wlogs.forEach(function(w){var km=w.querySelector(".wlog-km");var pace=w.querySelector(".wlog-pace");var hr=w.querySelector(".wlog-hr");if(!km)return;cards.push({el:w,km:km.textContent.trim(),pace:pace?pace.textContent.trim():"",hr:hr?hr.textContent.trim():"",text:w.textContent||""});});
var removed=0;
for(var i=0;i<cards.length;i++){for(var j=i+1;j<cards.length;j++){if(cards[i].km===cards[j].km&&cards[i].pace===cards[j].pace&&cards[i].hr===cards[j].hr){if(cards[j].text.indexOf("Poza planem")>=0){cards[j].el.remove();removed++;}else if(cards[i].text.indexOf("Poza planem")>=0){cards[i].el.remove();removed++;}else{cards[j].el.remove();removed++;}}}}
if(removed>0)console.log(TAG,"Removed",removed,"duplicate(s)");}
setTimeout(fixDups,1500);setTimeout(fixDups,3000);
var _t=null;var _o=new MutationObserver(function(){clearTimeout(_t);_t=setTimeout(function(){if(document.querySelectorAll(".wlog").length>0)fixDups();},800);});_o.observe(document.body,{childList:true,subtree:true});
var lt=0;document.addEventListener("touchend",function(e){var n=Date.now();if(n-lt<=300)e.preventDefault();lt=n;},{passive:false});
console.log(TAG,"v2 OK");
})();
