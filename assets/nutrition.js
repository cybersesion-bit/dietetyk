// Logika żywieniowa. Wszystkie progi są w jednym miejscu (CONFIG),
// żeby łatwo je było dostroić lub skonsultować z dietetykiem.
(function () {
  const CONFIG = {
    // Węglowodany g/kg/dzień wg łącznego czasu treningu (ogólne wytyczne sportu wytrzymałościowego)
    carbBands: [
      { maxHours: 0,        gPerKg: 3.5, label: "Odpoczynek" },
      { maxHours: 1,        gPerKg: 5,   label: "Lekki" },
      { maxHours: 2,        gPerKg: 6.5, label: "Umiarkowany" },
      { maxHours: 3,        gPerKg: 8,   label: "Ciężki" },
      { maxHours: Infinity, gPerKg: 10,  label: "Bardzo ciężki" }
    ],
    proteinGPerKg: { maintain: 1.7, cut: 2.0, gain: 1.8 },
    minFatGPerKg: 0.8,
    goalFactor: { maintain: 1.0, cut: 0.9, gain: 1.1 },
    // węglowodany w trakcie treningu (g/h) wg długości jednostki
    intraCarbs: [
      { minHours: 2.5,  gPerHour: 60 },
      { minHours: 1.25, gPerHour: 30 }
    ],
    // domyślne MET, gdy brak mocy (kJ) i kalorii
    defaultMet: { Bike: 8, Run: 10, Swim: 8, Strength: 5, Other: 6 }
  };

  // Mifflin–St Jeor
  function bmr({ sex, weight, height, age }) {
    return 10 * weight + 6.25 * height - 5 * age + (sex === "k" ? -161 : 5);
  }

  // Szacunek kcal jednego treningu
  function workoutKcal(w, weight) {
    if (w.kcal) return w.kcal;
    if (w.kj) return w.kj;                 // rower: ~1 kJ pracy ≈ 1 kcal wydatku
    const met = w.ifac ? 4 + 8 * w.ifac    // intensywność z IF
                       : (CONFIG.defaultMet[w.type] || CONFIG.defaultMet.Other);
    return met * weight * w.hours;
  }

  function carbBand(hours) {
    return CONFIG.carbBands.find(b => hours <= b.maxHours);
  }

  function planDay(profile, workouts) {
    const hours = workouts.reduce((s, w) => s + w.hours, 0);
    const trainKcal = workouts.reduce((s, w) => s + workoutKcal(w, profile.weight), 0);
    const tss = workouts.reduce((s, w) => s + (w.tss || 0), 0);
    const band = carbBand(hours);

    const target = (bmr(profile) * profile.neat + trainKcal) * CONFIG.goalFactor[profile.goal];
    const carbs = band.gPerKg * profile.weight;
    const protein = CONFIG.proteinGPerKg[profile.goal] * profile.weight;
    const fatFromRest = (target - carbs * 4 - protein * 4) / 9;
    const fat = Math.max(fatFromRest, CONFIG.minFatGPerKg * profile.weight);
    const kcal = carbs * 4 + protein * 4 + fat * 9;

    return {
      hours, tss, trainKcal, band: band.label,
      kcal: Math.round(kcal), carbs: Math.round(carbs),
      protein: Math.round(protein), fat: Math.round(fat),
      meals: buildMeals({ carbs, protein, fat }, workouts)
    };
  }

  function intraCarbsPerHour(hours) {
    const r = CONFIG.intraCarbs.find(x => hours >= x.minHours);
    return r ? r.gPerHour : 0;
  }

  // Rozkład makro na posiłki. Wokół treningu więcej węglowodanów, mniej tłuszczu.
  function buildMeals(m, workouts) {
    const main = workouts.slice().sort((a, b) => b.hours - a.hours)[0];
    const intra = main ? Math.round(intraCarbsPerHour(main.hours) * main.hours) : 0;
    const c = m.carbs - intra;

    const slots = main ? [
      { name: "Śniadanie",                 c: .20, p: .20, f: .25, foods: "płatki owsiane na mleku, banan, orzechy" },
      { name: "Przed treningiem (1–2 h)",  c: .15, p: .10, f: .05, training: true, foods: "bułka pszenna z miodem lub dżemem, jogurt" },
      { name: "Po treningu (do 1 h)",      c: .20, p: .25, f: .10, training: true, foods: "ryż lub makaron, kurczak/twaróg, owoce" },
      { name: "Obiad",                     c: .25, p: .25, f: .30, foods: "kasza lub ziemniaki, ryba/mięso, warzywa, oliwa" },
      { name: "Kolacja",                   c: .20, p: .20, f: .30, foods: "pieczywo żytnie, jajka, warzywa, awokado" }
    ] : [
      { name: "Śniadanie",                 c: .25, p: .25, f: .25, foods: "owsianka, owoce, masło orzechowe" },
      { name: "Drugie śniadanie",          c: .15, p: .15, f: .15, foods: "kanapki z twarożkiem, warzywa" },
      { name: "Obiad",                     c: .30, p: .30, f: .30, foods: "kasza, pierś z indyka, surówka z oliwą" },
      { name: "Kolacja",                   c: .30, p: .30, f: .30, foods: "makaron pełnoziarnisty, łosoś, warzywa" }
    ];

    const meals = slots.map(s => ({
      name: s.name, training: !!s.training, foods: s.foods,
      carbs: Math.round(c * s.c), protein: Math.round(m.protein * s.p), fat: Math.round(m.fat * s.f)
    }));

    if (intra > 0) {
      meals.splice(2, 0, {
        name: `W trakcie treningu (${main.title})`, training: true,
        carbs: intra, protein: 0, fat: 0,
        foods: `ok. ${Math.round(intra / main.hours)} g węglowodanów na godzinę: izotonik, żele, banany`
      });
    }
    meals.forEach(x => x.kcal = x.carbs * 4 + x.protein * 4 + x.fat * 9);
    return meals;
  }

  window.Nutrition = { CONFIG, planDay };
})();
