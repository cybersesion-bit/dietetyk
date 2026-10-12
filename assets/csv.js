// Parsowanie eksportu "Workout Summary" z TrainingPeaks (CSV).
// Nazwy kolumn bywają różne, więc szukamy po kilku aliasach.
(function () {
  const ALIASES = {
    date:   ["WorkoutDay", "Date", "Data"],
    title:  ["Title", "Name", "Nazwa"],
    type:   ["WorkoutType", "Type", "Sport"],
    hours:  ["TimeTotalInHours", "Duration", "Hours"],
    tss:    ["TSS"],
    ifac:   ["IF"],
    kj:     ["Energy", "EnergyKJ", "Work"],
    kcal:   ["Calories", "Kcal"]
  };

  // Prosty parser CSV obsługujący cudzysłowy i przecinki w polach.
  function parseRows(text) {
    const rows = [];
    let row = [], field = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') inQuotes = false;
        else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.some(v => v.trim() !== "")) rows.push(row);
        row = [];
      } else field += c;
    }
    row.push(field);
    if (row.some(v => v.trim() !== "")) rows.push(row);
    return rows;
  }

  function num(v) {
    if (v == null || v === "") return null;
    const n = parseFloat(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  // "1:30:00" lub "1.5" -> godziny
  function hoursFrom(v) {
    if (v == null || v === "") return null;
    if (String(v).includes(":")) {
      const p = String(v).split(":").map(Number);
      while (p.length < 3) p.unshift(0);
      return p[0] + p[1] / 60 + p[2] / 3600;
    }
    return num(v);
  }

  function parseTrainingPeaksCsv(text) {
    const rows = parseRows(text.replace(/^﻿/, ""));
    if (rows.length < 2) throw new Error("Plik nie zawiera danych.");
    const header = rows[0].map(h => h.trim());
    const idx = {};
    for (const [key, names] of Object.entries(ALIASES)) {
      idx[key] = header.findIndex(h => names.some(n => n.toLowerCase() === h.toLowerCase()));
    }
    if (idx.date < 0) throw new Error("Brak kolumny z datą (WorkoutDay).");

    const get = (r, k) => (idx[k] >= 0 ? r[idx[k]] : null);
    return rows.slice(1).map(r => ({
      date: String(get(r, "date") || "").slice(0, 10),
      title: get(r, "title") || "Trening",
      type: get(r, "type") || "Other",
      hours: hoursFrom(get(r, "hours")) || 0,
      tss: num(get(r, "tss")),
      ifac: num(get(r, "ifac")),
      kj: num(get(r, "kj")),
      kcal: num(get(r, "kcal"))
    }))
    // pomijamy treningi tylko zaplanowane (bez zrealizowanego czasu)
    .filter(w => w.date && w.hours > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  }

  window.TPCsv = { parseTrainingPeaksCsv };
})();
