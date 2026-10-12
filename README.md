# Dieta pod trening

Statyczna strona (GitHub Pages), która na podstawie treningów z TrainingPeaks (zrzuty ekranu lub eksport CSV) układa **plan żywienia na 14 dni**, dzień po dniu: kalorie, węglowodany, białko, tłuszcz i rozkład na posiłki z uwzględnieniem jedzenia przed, w trakcie i po treningu.

## Struktura

```
index.html                 – strona (3 kroki: profil → treningi → plan na 14 dni)
assets/style.css           – wygląd (jasny/ciemny motyw, telefon, wydruk A4)
assets/screenshot.js       – zrzuty ekranu: OCR w przeglądarce + rozpoznawanie treningów i dat
assets/csv.js              – parser eksportu CSV z TrainingPeaks (zrealizowane i zaplanowane)
assets/nutrition.js        – logika żywieniowa (wszystkie progi w obiekcie CONFIG)
assets/app.js              – tabela treningów, plan 14 dni, druk, eksport CSV
data/sample-workouts.csv   – dane przykładowe (tydzień wstecz + 2 tygodnie planu)
.nojekyll                  – wyłącza przetwarzanie Jekyll na Pages
```

Bez frameworków i bez kroku budowania – wszystko edytujesz w przeglądarce na GitHubie.

## Uruchomienie na GitHub Pages

1. Utwórz repozytorium (np. `dieta-treningowa`).
2. *Add file → Upload files* – przeciągnij zawartość folderu (z podfolderami `assets` i `data`).
3. *Settings → Pages*: Source **Deploy from a branch**, branch **main**, folder **/ (root)**.
4. Strona działa pod `https://<login>.github.io/dieta-treningowa/`.

## Jak używać

1. Uzupełnij profil (masa ciała, cel itd.).
2. Wgraj zrzuty ekranu z TrainingPeaks:
   - **kalendarz z treningami zaplanowanymi** na najbliższe 2 tygodnie (najważniejsze),
   - opcjonalnie ostatni tydzień zrealizowanych treningów (do trybu „powtórz ostatni tydzień”).
   Można wgrać kilka plików naraz albo wkleić je Ctrl+V.
3. Sprawdź tabelę treningów: wiersze ze zrzutów są podświetlone na żółto, brak daty lub czasu – na czerwono. Wszystko można poprawić bezpośrednio w tabeli.
4. Wybierz datę początku planu i co zrobić z dniami bez treningu w danych.
5. Plan: dwa tygodnie, każdy dzień z nazwą dnia tygodnia, treningiem, kaloriami i makro; posiłki po rozwinięciu. **Drukuj / PDF** – wydruk A4 z rozpisanymi posiłkami, **Pobierz CSV** – plan do Excela.

## Rozpoznawanie zrzutów

OCR wykonuje Tesseract.js w przeglądarce (wczytywany z jsDelivr przy pierwszym użyciu); obrazy nigdzie nie są wysyłane. Parser szuka:
- czasu `h:mm:ss` (lub `h:mm` przy etykiecie Duration/Czas) – każdy czas to osobny trening,
- TSS, IF, kJ, kcal w tekście po danym czasie,
- dat pełnych (`October 5, 2026`, `5 października 2026`, `2026-10-05`, `05.10.2026`) lub skróconych z kalendarza (`Mon 12`, `Pon 12`),
- typu treningu po słowach kluczowych (bike/ride/rower, run/bieg, swim, strength).

Gdy liczba dat nie zgadza się z liczbą treningów, data zostaje pusta do uzupełnienia.

## Jak liczony jest plan

- Podstawowa przemiana materii: Mifflin–St Jeor × aktywność pozatreningowa.
- Wydatek treningowy: kJ (≈ kcal) → IF → IF wyliczony z TSS (`IF = √(TSS / (100 × h))`, dla treningów planowanych) → domyślny MET dyscypliny.
- Węglowodany: 3,5–10 g/kg wg łącznego czasu treningu w danym dniu; **+1,5 g/kg dzień przed treningiem ≥ 2,5 h** (ładowanie).
- Białko 1,7–2,0 g/kg wg celu; tłuszcz to reszta energii, min. 0,8 g/kg.
- W trakcie jednostek > 75 min: 30 g/h, > 2,5 h: 60 g/h węglowodanów.

## Plan rozwoju

- [ ] Zapamiętywanie profilu i treningów w przeglądarce (localStorage)
- [ ] Baza produktów z gramaturami zamiast przykładowych propozycji
- [ ] Lista zakupów na tydzień
- [ ] Automatyczne pobieranie treningów (Strava API lub API TrainingPeaks po uzyskaniu dostępu partnerskiego; wymaga małego backendu do OAuth)

## Zastrzeżenie

Wyliczenia to szacunki, nie porada medyczna ani dietetyczna. Projekt niezależny, niepowiązany z TrainingPeaks.
