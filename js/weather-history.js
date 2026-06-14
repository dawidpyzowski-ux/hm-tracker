/* weather-history.js — Open-Meteo Historical Weather for Activities
 * Sprint 12 · HM Tracker PWA
 * Uses: https://archive-api.open-meteo.com (free, no API key)
 */
const WeatherHistory = (() => {
  "use strict";
  const TAG = "[Weather]";
  const CACHE_STORE = "weather_cache";
  const DEFAULT_LAT = 52.23;  // Warsaw fallback
  const DEFAULT_LNG = 21.01;

  // WMO Weather Code -> description + icon
  const WMO = {
    0:"Clear sky|☀️", 1:"Mainly clear|🌤️", 2:"Partly cloudy|⛅",
    3:"Overcast|☁️", 45:"Fog|🌫️", 48:"Rime fog|🌫️",
    51:"Light drizzle|🌦️", 53:"Moderate drizzle|🌦️", 55:"Dense drizzle|🌧️",
    56:"Light freezing drizzle|🌧️", 57:"Dense freezing drizzle|🌧️",
    61:"Slight rain|🌧️", 63:"Moderate rain|🌧️", 65:"Heavy rain|🌧️",
    66:"Light freezing rain|🌨️", 67:"Heavy freezing rain|🌨️",
    71:"Slight snow|🌨️", 73:"Moderate snow|❄️", 75:"Heavy snow|❄️",
    77:"Snow grains|❄️", 80:"Slight showers|🌦️", 81:"Moderate showers|🌧️",
    82:"Violent showers|🌧️", 85:"Slight snow showers|🌨️",
    86:"Heavy snow showers|❄️", 95:"Thunderstorm|⛈️",
    96:"Thunder + slight hail|⛈️", 99:"Thunder + heavy hail|⛈️"
  };

  function wmoDesc(code) {
    var entry = WMO[code] || "Unknown|❓";
    var parts = entry.split("|");
    return { description: parts[0], icon: parts[1] };
  }

  // IndexedDB cache helpers
  function openCache() {
    return new Promise(function(resolve, reject) {
      var req = indexedDB.open("hm_weather", 1);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(CACHE_STORE)) {
          db.createObjectStore(CACHE_STORE, { keyPath: "key" });
        }
      };
      req.onsuccess = function(e) { resolve(e.target.result); };
      req.onerror = function(e) { reject(e); };
    });
  }

  function cacheGet(db, key) {
    return new Promise(function(resolve) {
      var tx = db.transaction(CACHE_STORE, "readonly");
      var req = tx.objectStore(CACHE_STORE).get(key);
      req.onsuccess = function() { resolve(req.result ? req.result.data : null); };
      req.onerror = function() { resolve(null); };
    });
  }

  function cachePut(db, key, data) {
    return new Promise(function(resolve) {
      var tx = db.transaction(CACHE_STORE, "readwrite");
      tx.objectStore(CACHE_STORE).put({ key: key, data: data, ts: Date.now() });
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function() { resolve(); };
    });
  }

  // Build cache key from lat, lng, date
  function cacheKey(lat, lng, date) {
    return Math.round(lat*100) + "_" + Math.round(lng*100) + "_" + date;
  }

  // Fetch weather from Open-Meteo archive API
  function fetchFromAPI(lat, lng, date) {
    var url = "https://archive-api.open-meteo.com/v1/archive"
      + "?latitude=" + lat + "&longitude=" + lng
      + "&start_date=" + date + "&end_date=" + date
      + "&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,"
      + "wind_speed_10m,weather_code"
      + "&timezone=auto";

    return fetch(url).then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data || !data.hourly) return null;
        return data.hourly;
      })
      .catch(function(e) {
        console.warn(TAG, "API error:", e);
        return null;
      });
  }

  // Get weather for a specific date + hour at location
  // Returns: { temp, apparent, humidity, wind, code, description, icon }
  async function getForActivity(activity) {
    var date = (activity.date || "").slice(0, 10);
    if (!date) return null;

    // Get location: from activity or fallback to Warsaw
    var lat = DEFAULT_LAT, lng = DEFAULT_LNG;
    if (activity.start_latlng && activity.start_latlng.length === 2) {
      lat = activity.start_latlng[0];
      lng = activity.start_latlng[1];
    }

    // Get hour of training (from start_date or estimate 7:00)
    var hour = 7;
    if (activity.start_date) {
      var h = new Date(activity.start_date).getHours();
      if (h >= 0 && h <= 23) hour = h;
    } else if (activity.start_time) {
      var parts = String(activity.start_time).split(":");
      hour = parseInt(parts[0], 10) || 7;
    }

    var key = cacheKey(lat, lng, date);
    var db = await openCache();
    var cached = await cacheGet(db, key);

    var hourly;
    if (cached) {
      hourly = cached;
    } else {
      hourly = await fetchFromAPI(lat, lng, date);
      if (hourly) await cachePut(db, key, hourly);
    }

    if (!hourly || !hourly.time) return null;

    // Find closest hour
    var target = date + "T" + String(hour).padStart(2, "0") + ":00";
    var idx = hourly.time.indexOf(target);
    if (idx < 0) idx = Math.min(hour, hourly.time.length - 1);

    var code = hourly.weather_code ? hourly.weather_code[idx] : 0;
    var wmo = wmoDesc(code);

    return {
      temp: hourly.temperature_2m ? hourly.temperature_2m[idx] : null,
      apparent: hourly.apparent_temperature ? hourly.apparent_temperature[idx] : null,
      humidity: hourly.relative_humidity_2m ? hourly.relative_humidity_2m[idx] : null,
      wind: hourly.wind_speed_10m ? hourly.wind_speed_10m[idx] : null,
      code: code,
      description: wmo.description,
      icon: wmo.icon,
      hour: hour
    };
  }

  // Enrich array of activities with weather data (batch, with cache)
  async function enrichAll(activities) {
    var count = 0;
    for (var i = 0; i < activities.length; i++) {
      if (activities[i]._weather) continue; // already enriched
      var w = await getForActivity(activities[i]);
      if (w) {
        activities[i]._weather = w;
        count++;
      }
      // Small delay to respect rate limits (10k/day)
      if (count > 0 && count % 5 === 0) {
        await new Promise(function(r) { setTimeout(r, 200); });
      }
    }
    console.log(TAG, count + " activities enriched with weather");
    return activities;
  }

  // Get forecast for tomorrow (for Coach)
  async function getForecast(lat, lng) {
    if (!lat) lat = DEFAULT_LAT;
    if (!lng) lng = DEFAULT_LNG;
    var url = "https://api.open-meteo.com/v1/forecast"
      + "?latitude=" + lat + "&longitude=" + lng
      + "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,"
      + "wind_speed_10m_max,weather_code"
      + "&timezone=auto&forecast_days=3";

    try {
      var r = await fetch(url);
      var data = await r.json();
      if (!data || !data.daily) return null;
      var d = data.daily;
      var result = [];
      for (var i = 0; i < d.time.length; i++) {
        var wmo = wmoDesc(d.weather_code[i]);
        result.push({
          date: d.time[i],
          tempMax: d.temperature_2m_max[i],
          tempMin: d.temperature_2m_min[i],
          rain: d.precipitation_sum[i],
          windMax: d.wind_speed_10m_max[i],
          code: d.weather_code[i],
          description: wmo.description,
          icon: wmo.icon
        });
      }
      return result;
    } catch (e) {
      console.warn(TAG, "Forecast error:", e);
      return null;
    }
  }

  return {
    getForActivity: getForActivity,
    enrichAll: enrichAll,
    getForecast: getForecast,
    wmoDesc: wmoDesc,
    DEFAULT_LAT: DEFAULT_LAT,
    DEFAULT_LNG: DEFAULT_LNG
  };
})();
