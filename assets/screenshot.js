// Zrzuty ekranu z TrainingPeaks -> OCR (Tesseract.js, w przeglądarce) -> treningi w tabeli.
// Obsługuje podsumowanie pojedynczego treningu i widok kalendarza z kilkoma treningami
// (także zaplanowanymi). Wynik OCR zawsze trafia do tabeli do sprawdzenia.
(function () {
  const TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
  const L = "A-Za-zżźćńółęąśŻŹĆŃÓŁĘĄŚ";
  const MONTHS = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    sty: 1, lut: 2, kwi: 4, maj: 5, cze: 6, lip: 7, sie: 8, wrz: 9, paz: 10, "paź": 10, lis: 11, gru: 12
  };
  // skróty dni tygodnia -> getDay() (0 = niedziela)
  const WEEKDAYS = {
    sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
    nd: 0, nie: 0, pon: 1, wt: 2, wto: 2, "śr": 3, sr: 3, "śro": 3, czw: 4, pt: 5, "pią": 5, pia: 5, sob: 6
  };
  const LABEL = /^(duration|distance|tss|if|np|work|calories|elevation|avg|average|max|time|czas|dystans|kalorie|praca|planned|completed|plan)\b/i;

  const pad = n => String(n).padStart(2, "0");
  const toNum = s => {
    if (s == null) return null;
    const t = String(s).replace(/\s/g, "");
    const clean = /^\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, "") : t.replace(",", ".");
    const n = parseFloat(clean);
    return Number.isFinite(n) ? n : null;
  };
  const durToHours = v => {
    const p = v.split(":").map(Number);
    while (p.length < 3) p.push(0);
    return p[0] + p[1] / 60 + p[2] / 3600;
  };
  const monthOf = word => MONTHS[word.slice(0, 3).toLowerCase()];

  // ---- metryki z fragmentu tekstu ----
  function metrics(text) {
    const out = {};
    const tss = text.match(/\bTSS\b[^\d\n]{0,12}(\d{1,3}(?:[.,]\d)?)/i) || text.match(/(\d{1,3}(?:[.,]\d)?)\s*TSS\b/i);
    if (tss) out.tss = toNum(tss[1]);
    const ifac = text.match(/\bIF\b[^\d\n]{0,12}(\d[.,]\d{1,3})/)
              || text.match(/^\s*((?:0[.,][4-9]|1[.,][0-4])\d{0,2})\s*$/m);
    if (ifac) out.ifac = toNum(ifac[1]);
    const kj = text.match(/(\d[\d,. ]{0,6}\d|\d)\s*kJ\b/i);
    if (kj) out.kj = toNum(kj[1]);
    const kcal = text.match(/(?:calories|kalorie)[^\d\n]{0,12}(\d[\d,. ]{0,6}\d)/i)
              || text.match(/(\d[\d,. ]{0,6}\d)\s*(?:kcal|cal)\b/i);
    if (kcal) out.kcal = toNum(kcal[1]);
    return out;
  }

  function typeOf(text) {
    if (/\b(bike|ride|cycling|spin|rower|kolarstwo|jazda|mtb|zwift)\b/i.test(text)) return "Bike";
    if (/\b(run|running|bieg)\b/i.test(text)) return "Run";
    if (/\b(swim|pływanie|basen)\b/i.test(text)) return "Swim";
    if (/\b(strength|siła|siłownia|gym)\b/i.test(text)) return "Strength";
    return null;
  }

  // ---- daty: pełne ("October 5, 2026", "5 października 2026", 2026-10-05, 05.10.2026)
  //      albo skrócone z kalendarza ("Mon 12", "Pon 12") rozwiązywane względem dzisiaj ----
  function findDates(text, today) {
    const found = [];
    const push = (index, y, m, d) => {
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) found.push({ index, iso: `${y}-${pad(m)}-${pad(d)}` });
    };
    let m;
    const scan = (re, fn) => { re.lastIndex = 0; while ((m = re.exec(text))) fn(m); };
    scan(/\b(20\d{2})-(\d{2})-(\d{2})\b/g, x => push(x.index, x[1], +x[2], +x[3]));
    scan(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/g, x => push(x.index, x[3], +x[2], +x[1]));
    scan(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/g, x => push(x.index, x[3], +x[1], +x[2]));
    scan(new RegExp(`\\b([${L}]{3,})\\.?\\s+(\\d{1,2}),?\\s+(20\\d{2})\\b`, "g"), x => monthOf(x[1]) && push(x.index, x[3], monthOf(x[1]), +x[2]));
    scan(new RegExp(`\\b(\\d{1,2})\\s+([${L}]{3,})\\.?,?\\s+(20\\d{2})\\b`, "g"), x => monthOf(x[2]) && push(x.index, x[3], monthOf(x[2]), +x[1]));
    if (found.length) return dedupe(found);

    // widok kalendarza: "Mon 12" -> najbliższa pasująca data w oknie -14..+42 dni
    const base = new Date((today || new Date().toISOString().slice(0, 10)) + "T12:00");
    scan(new RegExp(`\\b([${L}]{2,})\\.?,?\\s+(\\d{1,2})\\b`, "g"), x => {
      const key = Object.keys(WEEKDAYS).find(k => x[1].toLowerCase().startsWith(k) && x[1].length <= 12);
      if (key == null) return;
      for (let i = -14; i <= 42; i++) {
        const d = new Date(base); d.setDate(d.getDate() + i);
        if (d.getDate() === +x[2] && d.getDay() === WEEKDAYS[key]) {
          found.push({ index: x.index, iso: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` });
          break;
        }
      }
    });
    return dedupe(found);
  }
  function dedupe(list) {
    const seen = new Set();
    return list.sort((a, b) => a.index - b.index).filter(x => !seen.has(x.iso) && seen.add(x.iso));
  }

  // tytuł: najbliższa wcześniejsza linia z tekstem, która nie jest etykietą ani datą
  function titleBefore(lines, lineIdx, stopIdx) {
    for (let i = lineIdx - 1; i > stopIdx; i--) {
      const s = lines[i].trim();
      if (s.length >= 4 && /[A-Za-zżźćńółęąś]{4,}/.test(s) && !LABEL.test(s) && !findDates(s).length) return s;
    }
    return null;
  }

  // ---- główny parser: zwraca listę treningów ----
  function parseWorkoutsText(raw, today) {
    const text = raw.replace(/[|]/g, " ").replace(/[ \t]+/g, " ");
    const lines = text.split("\n");
    const dates = findDates(text, today);

    // czasy: h:mm:ss, a h:mm tylko przy etykiecie
    const durRe = /\b(\d{1,2}:\d{2}:\d{2})\b|(?:duration|czas)[^\d\n]{0,20}(\d{1,2}:\d{2})\b/gi;
    const durs = [];
    let m;
    while ((m = durRe.exec(text))) {
      const v = m[1] || m[2];
      // pomiń tempo/czas okrążenia poniżej 3 minut
      if (durToHours(v) >= 0.05) durs.push({ index: m.index, end: m.index + m[0].length, v });
    }
    if (!durs.length) return [];

    const lineOf = idx => text.slice(0, idx).split("\n").length - 1;
    const pickDate = i => (dates.length === 1 ? dates[0].iso : dates.length === durs.length ? dates[i].iso : "");

    // jeden trening: bierzemy cały tekst (etykiety i wartości bywają w osobnych kolumnach)
    if (durs.length === 1) {
      const typeLine = lines.find(l => typeOf(l) && !LABEL.test(l.trim()));
      return [{
        date: pickDate(0),
        title: (typeLine || titleBefore(lines, lineOf(durs[0].index), -1) || "Trening ze zrzutu").trim(),
        type: typeOf(text) || "Other",
        hours: durToHours(durs[0].v),
        ...metrics(text)
      }];
    }

    // wiele treningów (kalendarz): metryki z fragmentu po danym czasie, tytuł z linii przed nim
    return durs.map((d, i) => {
      const seg = text.slice(d.end, i + 1 < durs.length ? durs[i + 1].index : text.length);
      const line = lineOf(d.index);
      const prevLine = i ? lineOf(durs[i - 1].index) : -1;
      const title = titleBefore(lines, line, prevLine) || `Trening ${i + 1}`;
      return {
        date: pickDate(i),
        title,
        type: typeOf(title) || typeOf(seg.split("\n").slice(0, 3).join(" ")) || "Other",
        hours: durToHours(d.v),
        ...metrics(seg)
      };
    });
  }

  window.Screenshot = { parseWorkoutsText, findDates };
  if (typeof document === "undefined") return;

  // ---- przeglądarka ----
  const $ = s => document.querySelector(s);
  const status = t => ($("#import-status").textContent = t);
  let worker = null;
  let queue = Promise.resolve();

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

  // powiększenie + skala szarości poprawiają OCR drobnych czcionek
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

  function addThumb(file, text, count) {
    const fig = document.createElement("figure");
    fig.className = "thumb";
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.alt = "Wgrany zrzut ekranu";
    const cap = document.createElement("figcaption");
    cap.textContent = count ? `Treningi: ${count}` : "Nic nie odczytano";
    const det = document.createElement("details");
    det.innerHTML = "<summary>tekst</summary>";
    const pre = document.createElement("pre");
    pre.textContent = text;
    det.appendChild(pre);
    fig.append(img, cap, det);
    $("#shot-gallery").appendChild(fig);
  }

  async function handleFile(file, n, total) {
    if (!file || !/^image\/(png|jpeg)$/.test(file.type)) {
      status("Obsługiwane są tylko pliki PNG i JPG.");
      return;
    }
    try {
      const w = await getWorker();
      status(`Rozpoznaję tekst… (${n}/${total})`);
      const { data } = await w.recognize(await prepareImage(file));
      const list = parseWorkoutsText(data.text);
      addThumb(file, data.text, list.length);
      if (list.length) window.App.addWorkouts(list, "zrzut");
      else window.App.addWorkouts([{ title: "Uzupełnij dane ze zrzutu" }], "zrzut");
      status(list.length
        ? `Ze zrzutu odczytano treningów: ${list.length}. Sprawdź podświetlone wiersze w tabeli.`
        : "Nie rozpoznałem treningu – dodałem pusty wiersz do uzupełnienia.");
    } catch (e) {
      status(`${e.message} Możesz dodać trening ręcznie.`);
    }
  }

  function handleFiles(files) {
    const list = [...files];
    list.forEach((f, i) => { queue = queue.then(() => handleFile(f, i + 1, list.length)); });
  }

  $("#shot-input").addEventListener("change", e => { handleFiles(e.target.files); e.target.value = ""; });
  const drop = $("#shot-drop");
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); handleFiles(e.dataTransfer.files); });
  document.addEventListener("paste", e => {
    const imgs = [...(e.clipboardData?.items || [])].filter(i => i.type.startsWith("image/")).map(i => i.getAsFile());
    if (imgs.length) handleFiles(imgs);
  });
})();
