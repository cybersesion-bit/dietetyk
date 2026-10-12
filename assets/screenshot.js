// Zrzut ekranu treningu z TrainingPeaks -> OCR (Tesseract.js, w przeglądarce) -> formularz.
// OCR bywa omylny, więc wynik zawsze trafia do formularza do sprawdzenia przed dodaniem.
(function () {
  const TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
  const MONTHS = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    sty: 1, lut: 2, kwi: 4, maj: 5, cze: 6, lip: 7, sie: 8, wrz: 9, paz: 10, "paź": 10, lis: 11, gru: 12
  };

  const toNum = s => {
    if (s == null) return null;
    // "1,050" (separator tysięcy) vs "0,78" (przecinek dziesiętny)
    const t = String(s).replace(/\s/g, "");
    const clean = /^\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, "") : t.replace(",", ".");
    const n = parseFloat(clean);
    return Number.isFinite(n) ? n : null;
  };
  const pad = n => String(n).padStart(2, "0");

  // ---- Parsowanie rozpoznanego tekstu (czysta funkcja, łatwa do testowania) ----
  function parseWorkoutText(raw) {
    const text = raw.replace(/[|]/g, " ").replace(/[ \t]+/g, " ");
    const out = {};

    // Czas: najpierw po etykiecie, potem pierwszy zapis h:mm:ss
    const dur = text.match(/(?:duration|czas|time)[^\d\n]{0,20}(\d{1,2}:\d{2}(?::\d{2})?)/i)
             || text.match(/\b(\d{1,2}:\d{2}:\d{2})\b/);
    if (dur) out.duration = dur[1];

    const tss = text.match(/\bTSS\b[^\d\n]{0,12}(\d{1,3}(?:[.,]\d)?)/i)
             || text.match(/(\d{1,3}(?:[.,]\d)?)\s*TSS\b/i);
    if (tss) out.tss = toNum(tss[1]);

    // IF po etykiecie; gdy OCR rozdzieli kolumny etykiet i wartości –
    // samotna liczba 0.40–1.49 w osobnej linii
    const ifac = text.match(/\bIF\b[^\d\n]{0,12}(\d[.,]\d{1,3})/)
              || text.match(/^\s*((?:0[.,][4-9]|1[.,][0-4])\d{0,2})\s*$/m);
    if (ifac) out.ifac = toNum(ifac[1]);

    const kj = text.match(/(\d[\d,. ]{0,6}\d|\d)\s*kJ\b/i);
    if (kj) out.kj = toNum(kj[1]);

    const kcal = text.match(/(?:calories|kalorie)[^\d\n]{0,12}(\d[\d,. ]{0,6}\d)/i)
              || text.match(/(\d[\d,. ]{0,6}\d)\s*(?:kcal|cal)\b/i);
    if (kcal) out.kcal = toNum(kcal[1]);

    // Data: ISO, dd.mm.yyyy, mm/dd/yyyy, "October 5, 2026", "5 października 2026"
    let m;
    if ((m = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/))) out.date = `${m[1]}-${m[2]}-${m[3]}`;
    else if ((m = text.match(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/))) out.date = `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
    else if ((m = text.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/))) out.date = `${m[3]}-${pad(m[1])}-${pad(m[2])}`;
    else if ((m = text.match(/\b([A-Za-zżźćńółęąśŻŹĆŃÓŁĘĄŚ]{3,})\.?\s+(\d{1,2}),?\s+(20\d{2})\b/)) && MONTHS[m[1].slice(0, 3).toLowerCase()])
      out.date = `${m[3]}-${pad(MONTHS[m[1].slice(0, 3).toLowerCase()])}-${pad(m[2])}`;
    else if ((m = text.match(/\b(\d{1,2})\s+([A-Za-zżźćńółęąśŻŹĆŃÓŁĘĄŚ]{3,})\.?\s+(20\d{2})\b/)) && MONTHS[m[2].slice(0, 3).toLowerCase()])
      out.date = `${m[3]}-${pad(MONTHS[m[2].slice(0, 3).toLowerCase()])}-${pad(m[1])}`;

    // Typ po słowach kluczowych
    if (/\b(bike|ride|cycling|rower|kolarstwo)\b/i.test(text)) out.type = "Bike";
    else if (/\b(run|running|bieg)\b/i.test(text)) out.type = "Run";
    else if (/\b(swim|pływanie|basen)\b/i.test(text)) out.type = "Swim";
    else if (/\b(strength|siła|siłownia)\b/i.test(text)) out.type = "Strength";

    return out;
  }

  // ---- Przeglądarka ----
  if (typeof document === "undefined") { window.Screenshot = { parseWorkoutText }; return; }

  const $ = s => document.querySelector(s);
  const status = t => ($("#shot-status").textContent = t);
  let worker = null;

  function loadScript(src) {
    return new Promise((res, rej) => {
      if (window.Tesseract) return res();
      const s = document.createElement("script");
      s.src = src; s.onload = res;
      s.onerror = () => rej(new Error("Nie udało się wczytać biblioteki OCR."));
      document.head.appendChild(s);
    });
  }

  async function getWorker() {
    if (worker) return worker;
    status("Wczytuję moduł rozpoznawania tekstu (tylko za pierwszym razem, kilka MB)…");
    await loadScript(TESSERACT_URL);
    worker = await window.Tesseract.createWorker("eng");
    return worker;
  }

  // Powiększenie i skala szarości wyraźnie poprawiają OCR małych czcionek ze zrzutów
  async function prepareImage(file) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(2, 3000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    const ctx = c.getContext("2d");
    ctx.filter = "grayscale(1) contrast(1.3)";
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    return c;
  }

  function fillForm(data) {
    const f = $("#shot-form");
    f.reset();
    f.date.value = new Date().toISOString().slice(0, 10);
    f.querySelectorAll("input").forEach(i => i.classList.remove("ocr-filled"));
    for (const [k, v] of Object.entries(data)) {
      if (v == null || !f[k]) continue;
      f[k].value = v;
      f[k].classList?.add("ocr-filled");
    }
  }

  async function handleFile(file) {
    if (!file || !/^image\/(png|jpeg)$/.test(file.type)) {
      status("Obsługiwane są tylko pliki PNG i JPG.");
      return;
    }
    $("#shot-preview").src = URL.createObjectURL(file);
    $("#shot-result").hidden = false;
    try {
      const w = await getWorker();
      status("Rozpoznaję tekst…");
      const { data } = await w.recognize(await prepareImage(file));
      $("#shot-text").textContent = data.text;
      const parsed = parseWorkoutText(data.text);
      fillForm(parsed);
      const found = Object.keys(parsed).length;
      status(found
        ? `Odczytano ${found} pól (podświetlone). Sprawdź wartości i kliknij „Dodaj trening”.`
        : "Nie rozpoznałem wartości – uzupełnij formularz ręcznie.");
    } catch (e) {
      fillForm({});
      status(`${e.message} Możesz uzupełnić formularz ręcznie.`);
    }
  }

  // Wybór pliku, przeciągnij-upuść, wklejanie ze schowka
  $("#shot-input").addEventListener("change", e => handleFile(e.target.files[0]));
  const drop = $("#shot-drop");
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); handleFile(e.dataTransfer.files[0]); });
  document.addEventListener("paste", e => {
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith("image/"));
    if (item) handleFile(item.getAsFile());
  });

  $("#shot-cancel").addEventListener("click", () => { $("#shot-result").hidden = true; status(""); });

  $("#shot-form").addEventListener("submit", e => {
    e.preventDefault();
    const f = e.target;
    const p = f.duration.value.split(":").map(Number);
    while (p.length < 3) p.push(0);
    const hours = p[0] + p[1] / 60 + p[2] / 3600;
    if (!(hours > 0)) { status("Podaj czas treningu."); return; }
    const n = v => (v === "" ? null : +v);
    window.App.addWorkout({
      date: f.date.value, title: f.title.value || "Trening", type: f.type.value, hours,
      tss: n(f.tss.value), ifac: n(f.ifac.value), kj: n(f.kj.value), kcal: n(f.kcal.value)
    });
    $("#shot-result").hidden = true;
    status("");
  });

  window.Screenshot = { parseWorkoutText };
})();
