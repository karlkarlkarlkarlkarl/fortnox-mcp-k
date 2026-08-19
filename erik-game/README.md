# SUPER-ERIK — två spel i ett paket

Födelsedagsspel för hela familjen, med **Erik** i huvudrollen: fixaren,
lekproffset, osteopaten och balettdansören — i STAYHOT-batiktröja, med
hundarna **Lillen & Bernard** och alla sex brorsbarnen.

All grafik är handritad vektorgrafik (canvas + SVG). Allt ljud är
syntetiserat (WebAudio). Varje spel är en enda HTML-fil som funkar helt
offline — typsnitten är inbäddade.

## `index.html` — TURBORUSNINGEN (huvudspelet, v3)

Endless runner genom svensk 90-talssommar (Erik är född 1990 — därav
eurodance-loopen på 126 BPM, Volvo 245:an, glasskiosken och midsommarstången).

- **Styrning:** tryck/mellanslag = hoppa (håll = högre) · svep neråt/pil ner = glida.
  Coyote-time och hoppbuffert gör att det känns proffsigt tajt.
- **Samla skruvar** i banor och bågar. Undvik STAYHOT-kartonger, hängande
  mötesskyltar, rullande stressmoln och getingsvärmar.
- **Fyra krafter:** Magnetbältet (drar skruvar) · **KNÄCK-RUSCHEN** (krossa
  hinder, KNAK!) · **Balettglidet** (tutu, sväva på valsmusik, allt ×2) ·
  **MIXTAPE 1990** (eurodancen växlar upp, neonsolnedgång, bakåtvänd keps
  och solglasögon).
- **Brorsbarnen** väntar vid hållplatser längs vägen — spring förbi och de
  hoppar upp på axlarna (+500 och högre skruvvärde). Träffas du flyger de
  hem säkert med ballong. Alla sex i samma runda = **HELA GÄNGET, +5000**.
- **Lillen & Bernard** springer med. När sista hjärtat ryker offrar en av
  dem sin räddning — slow motion, skall och vidare i rusningen. En gång var.
- **Uppdrag & Familjealbum:** 24 uppdrag ger stjärnor som låser upp åtta
  ritade minneskort. Uppdrag, stjärnor och album sparas mellan rundorna.
- **Topplista** (topp 10 med namn, poäng och distans) per enhet.

## `fangaren.html` — FÅNGAREN (klassikern, v2)

Det ursprungliga fångarspelet: spring och fånga verktyg, brorsbarn,
patienter med ryggskott och balettskor — undvik stressmoln, tråkiga möten
och getingar. Balettfeber med ridå och strålkastare. Egen topplista.

## Kör spelen

- **Öppna direkt:** dubbelklicka på valfri HTML-fil.
- **Lokal server:** `npx serve erik-game` eller `python3 -m http.server`.
- **Publicera:** ladda upp båda filerna var som helst (Netlify Drop,
  itch.io, eget webbhotell). `index.html` blir startsidan.

All sparad data (topplistor, stjärnor, album) ligger i localStorage —
per enhet, som på ett riktigt arkadspel.

*Med ❤ från familjen.*
