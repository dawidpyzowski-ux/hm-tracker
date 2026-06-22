/* training-classifier.js v1 — Sprint 19: Universal Training Type Classifier
   Mapuje wszystkie warianty (PL/EN/snake_case/Title Case) do 5 kategorii:
   long, tempo, intervals, easy, recovery
*/
var TrainingClassifier = (function() {
  "use strict";

  function classify(rawType) {
    var t = String(rawType || "").toLowerCase().trim();
    if (!t) return null;

    // ===== LONG RUN =====
    if (t.indexOf("long") >= 0 || 
        t === "lr" || 
        t.indexOf("dluzszy") >= 0 ||
        t.indexOf("dłuższy") >= 0) {
      return "long";
    }

    // ===== INTERVALS (priority over tempo, bo "race pace intervals" zawiera tempo-like words) =====
    if (t.indexOf("interv") >= 0 || 
        t.indexOf("interw") >= 0 ||
        t.indexOf("vo2") >= 0 ||
        t.indexOf("threshold") >= 0 ||
        t.indexOf("cruise") >= 0 ||
        t.indexOf("vo2max") >= 0 ||
        t.indexOf("repeats") >= 0 ||
        t.indexOf("intervals") >= 0 ||
        t.indexOf("ostre") >= 0 && t.indexOf("piatka") < 0) {
      return "intervals";
    }

    // ===== TEMPO =====
    if (t.indexOf("tempo") >= 0 ||
        t.indexOf("fartlek") >= 0 ||
        t.indexOf("hm pace") >= 0 ||
        t.indexOf("race pace") >= 0 ||
        t.indexOf("progresywny") >= 0 ||
        t.indexOf("progresywne") >= 0 ||
        t === "ostra piatka" ||
        t.indexOf("symulacja") >= 0) {
      return "tempo";
    }

    // ===== RECOVERY =====
    if (t.indexOf("recovery") >= 0 ||
        t.indexOf("regener") >= 0 ||
        t.indexOf("activation") >= 0) {
      return "recovery";
    }

    // ===== EASY (default for any "easy" or no match) =====
    if (t.indexOf("easy") >= 0 ||
        t.indexOf("rytm") >= 0 ||
        t.indexOf("lekk") >= 0 ||
        t.indexOf("luzn") >= 0 ||
        t === "e" ||
        t.indexOf("opcj") >= 0) {
      return "easy";
    }

    // ===== UNKNOWN — return "easy" as safe default =====
    return null;
  }

  function classifyWithMetadata(rawType) {
    var category = classify(rawType);
    return {
      raw: rawType || "",
      category: category,
      is_hard: category === "intervals" || category === "tempo" || category === "long",
      is_quality: category === "intervals" || category === "tempo",
      is_easy: category === "easy" || category === "recovery",
      label_pl: getLabelPL(category)
    };
  }

  function getLabelPL(category) {
    switch (category) {
      case "long": return "Long Run";
      case "tempo": return "Tempo";
      case "intervals": return "Interwały";
      case "easy": return "Easy";
      case "recovery": return "Recovery";
      default: return "Nieznany";
    }
  }

  // Test method - sprawdza klasyfikację na podstawie tablicy nazw
  function test() {
    var samples = [
      "Long Run", "long_run", "Long Run progr.", "Long Run z tempem", "Long Run ostatni",
      "Interwaly", "intervals", "Interwaly VO2max", "Interwaly mieszane", "Cruise Intervals",
      "Race pace intervals", "Lekkie interwaly", "Interwaly ostre",
      "Tempo Run", "tempo", "Mini tempo", "Tempo HM pace", "Tempo progresywny", "Lekkie tempo",
      "easy", "Easy", "Easy + Rytmy", "Easy (opcj.)",
      "Recovery Run", "recovery", "Regeneracja", "Activation Run",
      "Fartlek", "Symulacja wyscigu", "WYSCIG!", "Ostra piatka", ""
    ];
    console.log("[TrainingClassifier] Test:");
    console.table(samples.map(function(s) {
      var m = classifyWithMetadata(s);
      return { raw: s || "(empty)", category: m.category, is_hard: m.is_hard };
    }));
  }

  return {
    classify: classify,
    classifyWithMetadata: classifyWithMetadata,
    test: test
  };
})();
