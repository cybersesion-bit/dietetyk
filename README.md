# Dieta pod trening

Statyczna strona (GitHub Pages), która na podstawie treningów zrealizowanych w TrainingPeaks proponuje dzienny plan żywienia: kalorie, makroskładniki i rozkład na posiłki, z uwzględnieniem jedzenia przed, w trakcie i po treningu.

## Struktura

```
index.html                 – strona (3 kroki: profil → treningi → plan)
assets/style.css           – wygląd (jasny/ciemny motyw)
assets/csv.js              – parser eksportu CSV z TrainingPeaks
assets/nutrition.js        – logika żywieniowa (progi w obiekcie CONFIG)
assets/app.js              – obsługa interfejsu
data/sample-workouts.csv   – dane przykładowe
.nojekyll                  – wyłącza przetwarzanie Jekyll na Pages
```

Bez frameworków i bez kroku budowania: wszystko edytujesz bezpośrednio w przeglądarce na GitHubie.

## Uruchomienie na GitHub Pages

1. Utwórz nowe repozytorium (np. `dieta-treningowa`).
2. *Add file → Upload files* – przeciągnij całą zawartość tego folderu (z podfolderami `assets` i `data`).
3. *Settings → Pages → Build and deployment*: Source **Deploy from a branch**, branch **main**, folder **/ (root)**.
4. Po ok. minucie strona działa pod `https://<login>.github.io/dieta-treningowa/`.

## Skąd dane z TrainingPeaks

API TrainingPeaks jest dostępne wyłącznie dla zatwierdzonych partnerów i nie jest udostępniane do użytku prywatnego. Dlatego wersja 1 używa ręcznego eksportu CSV (*Settings → Export Data → Workout Summary*). Plik jest przetwarzany tylko w przeglądarce użytkownika, nic nie trafia na serwer.

Druga droga to **zrzut ekranu** (PNG/JPG, także wklejany Ctrl+V) podsumowania jednego treningu. Tekst rozpoznaje Tesseract.js w przeglądarce (wczytywany z jsDelivr przy pierwszym użyciu), a odczytane wartości trafiają do formularza do sprawdzenia przed dodaniem. Logika: `assets/screenshot.js`.

Rozpoznawane kolumny CSV: `WorkoutDay`, `Title`, `WorkoutType`, `TimeTotalInHours`, `TSS`, `IF`, `Energy` (kJ). Aliasy można dopisać w `assets/csv.js`.

## Jak liczony jest plan

- Podstawowa przemiana materii: wzór Mifflin–St Jeor × współczynnik aktywności pozatreningowej.
- Wydatek treningowy: kJ z miernika mocy (≈ kcal), w innym wypadku szacunek z IF lub domyślnego MET dla dyscypliny.
- Węglowodany: 3,5–10 g/kg zależnie od łącznego czasu treningu w danym dniu.
- Białko: 1,7–2,0 g/kg zależnie od celu. Tłuszcz: reszta energii, min. 0,8 g/kg.
- W trakcie jednostek > 75 min: 30 g/h, > 2,5 h: 60 g/h węglowodanów.

Wszystkie progi są w `CONFIG` w `assets/nutrition.js`.

## Plan rozwoju

- [ ] Zapamiętywanie profilu w przeglądarce (localStorage)
- [ ] Obsługa plików .FIT / eksportu pełnego
- [ ] Baza produktów z gramaturami zamiast przykładowych propozycji
- [ ] Plan na jutro na podstawie treningów zaplanowanych w TP
- [ ] Integracja z API TrainingPeaks po uzyskaniu dostępu partnerskiego (wymaga backendu do OAuth, np. Cloudflare Worker, bo sekretu klienta nie można trzymać w statycznej stronie)

## Zastrzeżenie

Wyliczenia to szacunki, nie porada medyczna ani dietetyczna. Projekt niezależny, niepowiązany z TrainingPeaks.
