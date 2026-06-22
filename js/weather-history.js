/* weather-history.js v2 — Sprint 19: Real hour + location + Heat Index
 * Open-Meteo Historical Weather + smart fallbacks
 */
const WeatherHistory = (() => {
  "use strict";
  const TAG = "[Weather]";
  const CACHE_STORE = "weather_cache";
  const DEFAULT_LAT = 52.23;  // Warsaw
  const DEFAULT_LNG = 21.01;

  const WMO = {
    0:"Clear sky|☀️", 1:"Mainly clear|🌤️", 2:"Partly cloudy|⛅",
    3:"Overcast|☁️", 45:"Fog|🌫️", 48:"Rime fog|🌫️",
    51:"Light drizzle|🌦️", 53:"Moderate drizzle|🌦️", 55:"Dense drizzle|🌧️",
    56:"Light freezing drizzle|🌧️", 57:"Dense freezing drizzle|🌧️",
    61:"Slight rain|🌧️", 63:"Moderate rain|🌧️", 65:"Heavy rain|🌧️",
    66:"Light freezing rain|🌨️", 67:"Heavy freezing rain|🌨️",
    71:"Slight snow|🌨️", 73:"Moderate snow|❄️", 75:"Heavy snow|❄️",
    77:"Snow grains|❄️", 80:"Slight rain showers|🌦️",
    81:"Moderate rain showers|🌧️", 82:"Violent rain showers|⛈️",
    85:"Slight snow showers|🌨️", 86:"Heavy snow showers|❄️",
    95:"Thunderstorm|⛈️", 96:"Thunderstorm w/ slight hail|⛈️",
    99:"Thunderstorm w/ heavy hail|⛈️"
  };

  function wmoDesc(code) {
    var entry = WMO[code] || "Unknown|❓";
    var parts = entry.split("|");
    return { description: parts[0], icon: parts[1] };
  }

  function cacheKey(date, lat, lng, hour) {
    return date + "_" + Math.round(lat*100)/100 + "_" + Math.round(lng*100)/100 + "_" + hour;
  }

  function readCache(key) {
    try {
      var cache = JSON.parse(localStorage.getItem(CACHE_STORE) || "{}");
      return cache[key] || null;
    } catch(e) { return null; }
  }

  function writeCache(key, data) {
    try {
      var cache = JSON.parse(localStorage.getItem(CACHE_STORE) || "{}");
      cache[key] = data;
      localStorage.setItem(CACHE_STORE, JSON.stringify(cache));
    } catch(e) {}
  }

  // ===== HOUR DETECTION (priority: real → smart default) =====
  function getActivityHour(activity, detail) {
    // 1. Strava start_date_local from detail (PRIORITY)
    if (detail && detail.start_date_local) {
      try {
        var d = new Date(detail.start_date_local);
        if (!isNaN(d.getTime())) {
          var h = d.getHours();
          return { hour: h, source: "strava_local" };
        }
      } catch(e) {}
    }

    // 2. Strava start_date from activity (UTC, mniej dokładne)
    if (activity.start_date) {
      try {
        var d = new Date(activity.start_date);
        if (!isNaN(d.getTime()) && d.getHours() !== 0) {
          // Adjust UTC → Warsaw (+2 in summer, +1 in winter)
          var month = d.getMonth() + 1;
          var offset = (month >= 4 && month <= 10) ? 2 : 1;
          var h = (d.getUTCHours() + offset) % 24;
          return { hour: h, source: "strava_utc_adjusted" };
        }
      } catch(e) {}
    }

    // 3. SMART DEFAULT na podstawie dnia tygodnia
    var date = new Date(activity.date);
    var dayOfWeek = date.getDay(); // 0=Sun, 6=Sat
    var isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (isWeekend) {
      return { hour: 9, source: "default_weekend_morning" };
    } else {
      return { hour: 17, source: "default_weekday_evening" };
    }
  }

  // ===== LOCATION DETECTION =====
  function getActivityLocation(activity, detail) {
    if (detail && detail.start_latlng && detail.start_latlng.length >= 2) {
      return {
        lat: detail.start_latlng[0],
        lng: detail.start_latlng[1],
        source: "strava"
      };
    }
    return { lat: DEFAULT_LAT, lng: DEFAULT_LNG, source: "default_warsaw" };
  }

  // ===== HEAT INDEX (Steadman simplified) =====
  function calculateHeatIndex(temp_c, humidity_pct) {
    if (temp_c === null || humidity_pct === null) return null;
    if (temp_c < 20) return temp_c; // No heat index below 20°C
    
    // Approximation for °C
    var T = temp_c;
    var R = humidity_pct;
    var HI = -8.78469 + 1.61139*T + 2.33854*R 
             - 0.14611*T*R - 0.012308*T*T 
             - 0.016425*R*R + 0.002211*T*T*R
             + 0.000725*T*R*R - 0.00000358*T*T*R*R;
    return Math.round(HI * 10) / 10;
  }

  // ===== HEAT STRESS CLASSIFICATION =====
  function classifyHeatStress(temp_c, humidity_pct, feels_like_c) {
    var hi = feels_like_c || calculateHeatIndex(temp_c, humidity_pct) || temp_c;
    
    if (hi >= 32) {
      return {
        level: "extreme",
        hr_impact_bpm: "+15 to +25",
        pace_impact_sec: "+30 to +60",
        note: "Bardzo wysokie obciążenie termiczne - HR drastycznie podwyższone, tempo znacznie wolniejsze",
        warning: true
      };
    } else if (hi >= 28) {
      return {
        level: "high",
        hr_impact_bpm: "+8 to +15",
        pace_impact_sec: "+15 to +30",
        note: "Wysoka temperatura odczuwalna - HR i tempo naturalnie gorsze",
        warning: false
      };
    } else if (hi >= 23) {
      return {
        level: "moderate",
        hr_impact_bpm: "+4 to +8",
        pace_impact_sec: "+5 to +15",
        note: "Umiarkowane ciepło - HR mogło być lekko podwyższone",
        warning: false
      };
    } else if (temp_c <= 0) {
      return {
        level: "cold",
        hr_impact_bpm: "+2 to +5",
        pace_impact_sec: "+5 to +10",
        note: "Niska temperatura - HR i koszt wysiłku lekko wyższe",
        warning: false
      };
    } else if (temp_c <= 5) {
      return {
        level: "cool",
        hr_impact_bpm: "0 to +2",
        pace_impact_sec: "0 to +5",
        note: "Chłodno - bliskie warunki optymalne",
        warning: false
      };
    } else {
      return {
        level: "neutral",
        hr_impact_bpm: "0",
        pace_impact_sec: "0",
        note: "Komfortowe warunki - bez wpływu na wydolność",
        warning: false
      };
    }
  }

  // ===== MAIN: get weather for activity =====
  async function getForActivity(activity) {
    if (!activity || !activity.date) return null;

    // Get detail for location + hour
    var detail = null;
    if (activity.strava_id && typeof DB !== "undefined" && DB.getDetail) {
      try { detail = DB.getDetail(activity.strava_id); } catch(e) {}
    }

    var locInfo = getActivityLocation(activity, detail);
    var hourInfo = getActivityHour(activity, detail);

    var key = cacheKey(activity.date, locInfo.lat, locInfo.lng, hourInfo.hour);
    var cached = readCache(key);
    if (cached) return cached;

    // Fetch from Open-Meteo
    try {
      var url = "https://archive-api.open-meteo.com/v1/archive?" +
        "latitude=" + locInfo.lat +
        "&longitude=" + locInfo.lng +
        "&start_date=" + activity.date +
        "&end_date=" + activity.date +
        "&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code" +
        "&timezone=auto";

      var resp = await fetch(url);
      if (!resp.ok) return null;
      var data = await resp.json();
      
      if (!data.hourly) return null;
      
      var hour = hourInfo.hour;
      var temp = data.hourly.temperature_2m[hour];
      var apparent = data.hourly.apparent_temperature[hour];
      var humidity = data.hourly.relative_humidity_2m[hour];
      var wind = data.hourly.wind_speed_10m[hour];
      var code = data.hourly.weather_code[hour];

      var desc = wmoDesc(code);
      var heatIndex = calculateHeatIndex(temp, humidity);
      var heatStress = classifyHeatStress(temp, humidity, apparent);

      var result = {
        temp: temp,
        apparent: apparent,
        humidity: humidity,
        wind: wind,
        code: code,
        description: desc.description,
        icon: desc.icon,
        hour: hour,
        hour_source: hourInfo.source,
        lat: locInfo.lat,
        lng: locInfo.lng,
        location_source: locInfo.source,
        heat_index: heatIndex,
        heat_stress: heatStress
      };

      writeCache(key, result);
      return result;
    } catch(e) {
      console.warn(TAG, "fetch failed:", e);
      return null;
    }
  }

  // ===== BATCH enrichment =====
  async function enrichAll(activities, onProgress) {
    var enriched = 0;
    for (var i = 0; i < activities.length; i++) {
      var a = activities[i];
      var w = await getForActivity(a);
      if (w) {
        a._weather = w;
        enriched++;
      }
      if (onProgress) onProgress(i + 1, activities.length);
    }
    console.log(TAG, enriched + " activities enriched with weather");
    return enriched;
  }

  async function getForecast(lat, lng) {
    lat = lat || DEFAULT_LAT;
    lng = lng || DEFAULT_LNG;
    try {
      var url = "https://api.open-meteo.com/v1/forecast?" +
        "latitude=" + lat +
        "&longitude=" + lng +
        "&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code" +
        "&forecast_days=3&timezone=auto";
      var resp = await fetch(url);
      if (!resp.ok) return null;
      return await resp.json();
    } catch(e) { return null; }
  }

  return {
    getForActivity: getForActivity,
    enrichAll: enrichAll,
    getForecast: getForecast,
    wmoDesc: wmoDesc,
    classifyHeatStress: classifyHeatStress,
    calculateHeatIndex: calculateHeatIndex,
    DEFAULT_LAT: DEFAULT_LAT,
    DEFAULT_LNG: DEFAULT_LNG
  };
})();
