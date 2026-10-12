// Spina interfejs: profil -> treningi -> plan.
(function () {
  const $ = s => document.querySelector(s);
  let workouts = [];

  function profile() {
    const f = new FormData($("#profile-form"));
    return {
      sex: f.get("sex"),
      age: +f.get("age"),
      weight: +f.get("weight"),
      height: +f.get("height"),
      goal: f.get("goal"),
      neat: +f.get("neat")
    };
  }

  const fmtH = h => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
  const fmtDate = d => new Date(d + "T12:00").toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "short" });
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Wszystkie dni od pierwszego do ostatniego treningu (z dniami odpoczynku pomiędzy)
  function days() {
    if (!workouts.length) return [];
    const out = [];
    const d = new Date(workouts[0].date + "T12:00");
    const end = new Date(workouts[workouts.length - 1].date + "T12:00");
    while (d <= end) {
      out.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  function renderWorkouts() {
    const p = profile();
    $("#workouts-table tbody").innerHTML = workouts.map(w => `
      <tr><td>${fmtDate(w.date)}</td><td>${esc(w.title)}</td><td>${esc(w.type)}</td>
      <td>${fmtH(w.hours)}</td><td>${w.tss ?? "–"}</td>
      <td>${Math.round(window.Nutrition.planDay(p, [w]).trainKcal)}</td></tr>`).join("");
    $("#workouts-table").hidden = !workouts.length;
  }

  function renderPlan() {
    const list = days();
    $("#plan").hidden = !list.length;
    if (!list.length) return;

    const sel = $("#day-select");
    const keep = sel.value;
    sel.innerHTML = list.map(d => `<option value="${d}">${fmtDate(d)}</option>`).join("");
    sel.value = list.includes(keep) ? keep : list[list.length - 1];

    const p = profile();
    const planFor = d => window.Nutrition.planDay(p, workouts.filter(w => w.date === d));

    const day = planFor(sel.value);
    $("#day-summary").innerHTML = `
      <div class="stat"><div class="label">Energia</div><div class="value">${day.kcal} kcal</div></div>
      <div class="stat carb"><div class="label">Węglowodany</div><div class="value">${day.carbs} g</div></div>
      <div class="stat protein"><div class="label">Białko</div><div class="value">${day.protein} g</div></div>
      <div class="stat fat"><div class="label">Tłuszcz</div><div class="value">${day.fat} g</div></div>
      <div class="stat"><div class="label">Obciążenie</div><div class="value">${day.band}</div></div>`;

    $("#meal-list").innerHTML = day.meals.map(m => `
      <li class="${m.training ? "training" : ""}">
        <div class="meal-head"><span>${esc(m.name)}</span><span>${m.kcal} kcal</span></div>
        <div class="macros">W ${m.carbs} g · B ${m.protein} g · T ${m.fat} g</div>
        <p class="foods">${esc(m.foods)}</p>
      </li>`).join("");

    $("#week-table tbody").innerHTML = list.slice(-7).map(d => {
      const x = planFor(d);
      return `<tr><td>${fmtDate(d)}</td><td>${x.band}${x.tss ? ` (TSS ${Math.round(x.tss)})` : ""}</td>
        <td>${x.kcal}</td><td>${x.carbs}</td><td>${x.protein}</td><td>${x.fat}</td></tr>`;
    }).join("");
  }

  function load(text, source) {
    try {
      workouts = window.TPCsv.parseTrainingPeaksCsv(text);
      $("#import-status").textContent = `Wczytano ${workouts.length} treningów (${source}).`;
    } catch (e) {
      workouts = [];
      $("#import-status").textContent = `Błąd: ${e.message}`;
    }
    renderWorkouts();
    renderPlan();
  }

  $("#csv-input").addEventListener("change", e => {
    const file = e.target.files[0];
    if (file) file.text().then(t => load(t, file.name));
  });

  $("#load-sample").addEventListener("click", () =>
    fetch("data/sample-workouts.csv").then(r => r.text()).then(t => load(t, "przykład")));

  // Dopisanie pojedynczego treningu (np. ze zrzutu ekranu) do już wczytanych
  function addWorkout(w) {
    workouts.push(w);
    workouts.sort((a, b) => a.date.localeCompare(b.date));
    $("#import-status").textContent = `Dodano „${w.title}” (${fmtDate(w.date)}). Treningów: ${workouts.length}.`;
    renderWorkouts();
    renderPlan();
    $("#day-select").value = w.date;
    renderPlan();
  }
  window.App = { addWorkout };

  $("#day-select").addEventListener("change", renderPlan);
  $("#profile-form").addEventListener("input", () => { renderWorkouts(); renderPlan(); });
})();
