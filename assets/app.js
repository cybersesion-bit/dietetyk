// Interfejs: profil -> treningi (edytowalna tabela) -> plan na 14 dni.
(function () {
  const $ = s => document.querySelector(s);
  const DAYS = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];
  const TYPES = { Bike: "Rower", Run: "Bieg", Swim: "Pływanie", Strength: "Siła", Other: "Inne" };
  const SOURCES = { zrzut: "zrzut", csv: "CSV", "przykład": "przykład", ręcznie: "ręcznie" };
  const PLAN_DAYS = 14;
  const state = { workouts: [], nextId: 1, lastPlan: [] };

  // ---- pomocnicze ----
  const pad = n => String(n).padStart(2, "0");
  const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromISO = s => new Date(s + "T12:00");
  const addDays = (s, n) => { const d = fromISO(s); d.setDate(d.getDate() + n); return toISO(d); };
  const todayISO = () => toISO(new Date());
  const weekday = s => fromISO(s).getDay();
  const fmtShort = s => fromISO(s).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  const fmtLong = s => fromISO(s).toLocaleDateString("pl-PL", { day: "numeric", month: "long" });
  const fmtH = h => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}:${pad(m % 60)}`; };
  const fmtN = n => Math.round(n).toLocaleString("pl-PL");
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const numOrNull = v => { const n = parseFloat(String(v).replace(",", ".")); return v === "" || !Number.isFinite(n) ? null : n; };
  const parseDur = v => {
    if (!v) return 0;
    if (String(v).includes(":")) {
      const p = String(v).split(":").map(Number);
      while (p.length < 3) p.push(0);
      return p[0] + p[1] / 60 + p[2] / 3600;
    }
    return numOrNull(v) || 0;
  };
  const sum = (list, f) => list.reduce((s, x) => s + (f(x) || 0), 0);

  function profile() {
    const f = new FormData($("#profile-form"));
    return {
      sex: f.get("sex"), age: +f.get("age"), weight: +f.get("weight"),
      height: +f.get("height"), goal: f.get("goal"), neat: +f.get("neat")
    };
  }

  // ---- model treningów ----
  function addWorkouts(list, source, replaceSource = false) {
    if (replaceSource) state.workouts = state.workouts.filter(w => w.source !== source);
    for (const w of list) {
      state.workouts.push({
        date: "", title: "Trening", type: "Other", hours: 0,
        tss: null, ifac: null, kj: null, kcal: null, ...w,
        id: state.nextId++, source, review: source === "zrzut"
      });
    }
    state.workouts.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
    renderWorkouts();
    renderPlan();
  }
  window.App = { addWorkouts };

  const rowClass = w => [w.review ? "review" : "", !w.date || !(w.hours > 0) ? "incomplete" : ""].join(" ");

  function renderWorkouts() {
    const ws = state.workouts;
    $("#workouts-box").hidden = !ws.length;
    $("#workouts-table tbody").innerHTML = ws.map(w => `
      <tr data-id="${w.id}" class="${rowClass(w)}">
        <td><input type="date" data-f="date" value="${w.date}" aria-label="Data"></td>
        <td><input type="text" data-f="title" value="${esc(w.title)}" aria-label="Nazwa"></td>
        <td><select data-f="type" aria-label="Typ">${Object.entries(TYPES).map(([k, v]) =>
          `<option value="${k}"${k === w.type ? " selected" : ""}>${v}</option>`).join("")}</select></td>
        <td><input type="text" data-f="hours" class="w-s" value="${w.hours > 0 ? fmtH(w.hours) : ""}" placeholder="1:30" aria-label="Czas"></td>
        <td><input type="number" data-f="tss" class="w-s" step="any" value="${w.tss ?? ""}" aria-label="TSS"></td>
        <td><input type="number" data-f="ifac" class="w-s" step="0.01" value="${w.ifac ?? ""}" aria-label="IF"></td>
        <td><input type="number" data-f="kj" class="w-s" value="${w.kj ?? ""}" aria-label="kJ"></td>
        <td><input type="number" data-f="kcal" class="w-s" value="${w.kcal ?? ""}" aria-label="kcal"></td>
        <td><span class="src">${SOURCES[w.source] || w.source}${w.planned ? " · plan" : ""}</span></td>
        <td><button type="button" class="del" title="Usuń trening" aria-label="Usuń">✕</button></td>
      </tr>`).join("");
    updateReviewUi();
  }

  function updateReviewUi() {
    const any = state.workouts.some(w => w.review || !w.date || !(w.hours > 0));
    $("#mark-reviewed").hidden = !state.workouts.some(w => w.review);
    $("#review-hint").hidden = !any;
  }

  $("#workouts-table").addEventListener("change", e => {
    const tr = e.target.closest("tr");
    const f = e.target.dataset.f;
    const w = tr && state.workouts.find(x => x.id === +tr.dataset.id);
    if (!w || !f) return;
    const v = e.target.value;
    if (f === "hours") w.hours = parseDur(v);
    else if (["tss", "ifac", "kj", "kcal"].includes(f)) w[f] = numOrNull(v);
    else w[f] = v;
    w.review = false;
    tr.className = rowClass(w);
    updateReviewUi();
    renderPlan();
  });

  $("#workouts-table").addEventListener("click", e => {
    if (!e.target.classList.contains("del")) return;
    const id = +e.target.closest("tr").dataset.id;
    state.workouts = state.workouts.filter(w => w.id !== id);
    renderWorkouts();
    renderPlan();
  });

  $("#mark-reviewed").addEventListener("click", () => {
    state.workouts.forEach(w => (w.review = false));
    renderWorkouts();
  });

  $("#add-row").addEventListener("click", () =>
    addWorkouts([{ date: $("#start-date").value || todayISO(), title: "Nowy trening" }], "ręcznie"));

  // ---- plan na 14 dni ----
  function buildDays() {
    const valid = state.workouts.filter(w => w.date && w.hours > 0);
    const start = $("#start-date").value || todayISO();
    const mode = document.querySelector('input[name="fill"]:checked').value;
    const byDate = {};
    valid.forEach(w => (byDate[w.date] ||= []).push(w));

    // wzorzec = 7 dni przed początkiem planu, wg dnia tygodnia
    const pattern = {};
    for (let i = 1; i <= 7; i++) {
      const d = addDays(start, -i);
      pattern[weekday(d)] = byDate[d] || [];
    }

    const days = [];
    for (let i = 0; i <= PLAN_DAYS; i++) {  // +1 dzień, żeby znać jutro dla ostatniego dnia
      const date = addDays(start, i);
      let ws = byDate[date] || [];
      let projected = false;
      if (!ws.length && mode === "repeat" && pattern[weekday(date)].length) {
        ws = pattern[weekday(date)];
        projected = true;
      }
      days.push({ date, ws, projected });
    }
    const p = profile();
    return days.slice(0, PLAN_DAYS).map((d, i) => ({
      ...d,
      plan: window.Nutrition.planDay(p, d.ws, { nextDayHours: sum(days[i + 1].ws, w => w.hours) })
    }));
  }

  function dayHtml(d) {
    const p = d.plan;
    const isToday = d.date === todayISO();
    const training = d.ws.length
      ? d.ws.map(w => `<div class="t-item"><span class="t-name">${esc(w.title)}</span>
          <span class="t-meta">${TYPES[w.type] || w.type} · ${fmtH(w.hours)} h${w.tss ? ` · TSS ${Math.round(w.tss)}` : ""}</span></div>`).join("")
      : `<div class="t-item t-rest">Dzień wolny od treningu</div>`;
    const tags = [
      `<span class="pill lvl-${p.level}">${p.band}</span>`,
      d.projected ? `<span class="pill pill-proj">wzorzec</span>` : "",
      p.preload ? `<span class="pill pill-load">ładowanie</span>` : ""
    ].join("");
    const kc = p.carbs * 4, kp = p.protein * 4, kf = p.fat * 9, tot = kc + kp + kf;

    return `
      <article class="day${isToday ? " is-today" : ""}${d.ws.length ? "" : " is-rest"}">
        <div class="day-row">
          <div class="d-name">
            <strong>${DAYS[weekday(d.date)]}</strong>
            <span>${fmtLong(d.date)}${isToday ? " · dziś" : ""}</span>
          </div>
          <div class="d-train">${training}<div class="tags">${tags}</div></div>
          <div class="d-num d-kcal"><span class="lbl">Energia</span><b>${fmtN(p.kcal)}</b><small>kcal</small></div>
          <div class="d-num c"><span class="lbl">Węglowodany</span><b>${p.carbs}</b><small>g</small></div>
          <div class="d-num pr"><span class="lbl">Białko</span><b>${p.protein}</b><small>g</small></div>
          <div class="d-num f"><span class="lbl">Tłuszcz</span><b>${p.fat}</b><small>g</small></div>
        </div>
        <div class="macro-bar" title="Udział energii: węglowodany / białko / tłuszcz">
          <span class="c" style="width:${(kc / tot * 100).toFixed(1)}%"></span>
          <span class="pr" style="width:${(kp / tot * 100).toFixed(1)}%"></span>
          <span class="f" style="width:${(kf / tot * 100).toFixed(1)}%"></span>
        </div>
        <details class="d-meals">
          <summary>Posiłki na ten dzień (${p.meals.length})</summary>
          <table class="meal-table">
            <thead><tr><th>Posiłek</th><th>Przykładowe produkty</th><th>kcal</th><th>W</th><th>B</th><th>T</th></tr></thead>
            <tbody>${p.meals.map(m => `
              <tr class="${m.training ? "m-train" : ""}">
                <td>${esc(m.name)}</td><td>${esc(m.foods)}</td>
                <td>${fmtN(m.kcal)}</td><td>${m.carbs}</td><td>${m.protein}</td><td>${m.fat}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </details>
      </article>`;
  }

  function weekHtml(days, n) {
    const plans = days.map(d => d.plan);
    const hours = sum(plans, p => p.hours);
    const tss = sum(plans, p => p.tss);
    const avg = k => Math.round(sum(plans, p => p[k]) / plans.length);
    return `
      <section class="week">
        <header class="week-head">
          <h3>Tydzień ${n} <span>${fmtShort(days[0].date)} – ${fmtShort(days[days.length - 1].date)}</span></h3>
          <dl class="week-stats">
            <div><dt>Trening</dt><dd>${fmtH(hours)} h</dd></div>
            <div><dt>TSS</dt><dd>${fmtN(tss)}</dd></div>
            <div><dt>Średnio dziennie</dt><dd>${fmtN(avg("kcal"))} kcal</dd></div>
            <div><dt>W / B / T</dt><dd>${avg("carbs")} / ${avg("protein")} / ${avg("fat")} g</dd></div>
          </dl>
        </header>
        <div class="day-cols" aria-hidden="true">
          <span>Dzień</span><span>Trening</span><span>Energia</span><span>Węglowodany</span><span>Białko</span><span>Tłuszcz</span>
        </div>
        ${days.map(dayHtml).join("")}
      </section>`;
  }

  function renderPlan() {
    const hasData = state.workouts.some(w => w.date && w.hours > 0);
    $("#plan").hidden = !hasData;
    if (!hasData) return;
    const days = buildDays();
    state.lastPlan = days;
    const open = new Set([...document.querySelectorAll(".d-meals[open]")].map(d => d.closest(".day")?.dataset.date));
    $("#weeks").innerHTML = weekHtml(days.slice(0, 7), 1) + weekHtml(days.slice(7, 14), 2);
    document.querySelectorAll("#weeks .day").forEach((el, i) => {
      el.dataset.date = days[i].date;
      if (open.has(days[i].date)) el.querySelector(".d-meals").open = true;
    });
  }

  // ---- eksport i druk ----
  function exportCsv() {
    const rows = [["Data", "Dzień", "Trening", "Czas (h)", "TSS", "Obciążenie", "kcal", "Węglowodany (g)", "Białko (g)", "Tłuszcz (g)", "Posiłki"]];
    for (const d of state.lastPlan) {
      const p = d.plan;
      rows.push([
        d.date, DAYS[weekday(d.date)],
        d.ws.map(w => w.title).join(" + ") || "odpoczynek",
        p.hours.toFixed(2).replace(".", ","), Math.round(p.tss), p.band + (p.preload ? " + ładowanie" : ""),
        p.kcal, p.carbs, p.protein, p.fat,
        p.meals.map(m => `${m.name}: W${m.carbs}/B${m.protein}/T${m.fat}`).join(" | ")
      ]);
    }
    const csv = "﻿" + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `plan-diety-${state.lastPlan[0].date}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  let openBeforePrint = [];
  window.addEventListener("beforeprint", () => {
    openBeforePrint = [...document.querySelectorAll(".d-meals")].map(d => d.open);
    document.querySelectorAll(".d-meals").forEach(d => (d.open = true));
  });
  window.addEventListener("afterprint", () => {
    document.querySelectorAll(".d-meals").forEach((d, i) => (d.open = !!openBeforePrint[i]));
  });

  // ---- import CSV / przykład ----
  function loadCsv(text, source, label, shiftDays = 0) {
    try {
      const list = window.TPCsv.parseTrainingPeaksCsv(text)
        .map(w => (shiftDays ? { ...w, date: addDays(w.date, shiftDays) } : w));
      addWorkouts(list, source, true);
      $("#import-status").textContent = `Wczytano treningów: ${list.length} (${label}).`;
    } catch (e) {
      $("#import-status").textContent = `Błąd: ${e.message}`;
    }
  }

  $("#csv-input").addEventListener("change", e => {
    const file = e.target.files[0];
    if (file) file.text().then(t => loadCsv(t, "csv", file.name));
    e.target.value = "";
  });
  $("#load-sample").addEventListener("click", () =>
    fetch("data/sample-workouts.csv").then(r => r.text()).then(t => {
      // przykład zaczyna plan 2026-10-12 (poniedziałek); przesuwamy go o pełne tygodnie
      // tak, by plan startował w poniedziałek bieżącego tygodnia
      const now = fromISO(todayISO());
      const monday = addDays(todayISO(), -((now.getDay() + 6) % 7));
      const shift = Math.round((fromISO(monday) - fromISO("2026-10-12")) / 864e5);
      $("#start-date").value = monday;
      loadCsv(t, "przykład", "dane przykładowe", shift);
    }));

  $("#start-date").value = todayISO();
  $("#start-date").addEventListener("change", renderPlan);
  document.querySelectorAll('input[name="fill"]').forEach(r => r.addEventListener("change", renderPlan));
  $("#profile-form").addEventListener("input", renderPlan);
  $("#print-plan").addEventListener("click", () => window.print());
  $("#export-plan").addEventListener("click", exportCsv);
})();
