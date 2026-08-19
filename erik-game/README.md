# SUPER-ERIK v2 — Superstjärnan

Ett födelsedagsspel för hela familjen, där alla får spela som **Erik**:
fixaren, lekproffset, osteopaten och balettdansören — i sin STAYHOT-batiktröja,
med hundarna **Lillen & Bernard** vid sin sida.

All grafik är handritad vektorgrafik (canvas + SVG) — inga emojis.

## Så spelar du

Fånga allt Erik älskar och samla poäng:

| Föremål | Poäng |
|---|---|
| Verktyg, lampor, stolar och STAYHOT-mässingsduschar | 100 |
| Brorsbarnen **Ruben, Juniper, Emma-Lo, Irma, Olof & Siri** (åker upp på axlarna!) | 150 · +300 första gången |
| Patienter med ryggskott — *KNAK!* | 200 |
| Balettsko → **BALETTFEBER**: ridå, strålkastare, tutu, piruetter, ×2 på allt | 300 |
| Födelsedagstårta (sällsynt) | 500 |

- **Samla alla sex brorsbarnen** i samma runda → **HELA GÄNGET! +1500**
- **Lillen** (liten, snabb) och **Bernard** (stor, lång räckvidd) rusar och räddar
  saker du tappar — kombon överlever! Tassen över huvudet visar att hunden är redo.
- **Undvik** stressmoln, tråkiga möten — och **getingarna** som jagar dig från våg 3.
- Vågor var ~30:e sekund höjer tempot: brantare fart, tätare regn, dubbelspawn.
- Kombo upp till ×5 · **LUFTFÅNGST** (+50 %) för hopp-fångster · 3 hjärtan.

**Styrning:** piltangenter/A–D + mellanslag (dator) · dra fingret + snabbtryck för hopp
(mobil/surfplatta) · `P` paus · `M` ljud av/på.

## Kör spelet

Allt är en enda fil — `index.html` — med inbäddade typsnitt och syntetiserat
ljud (WebAudio, popslinga + vals under balettfebern). Ingen uppkoppling behövs.

- **Öppna direkt:** dubbelklicka på `index.html` i valfri webbläsare.
- **Lokal server:** `npx serve erik-game` eller `python3 -m http.server` i den här mappen.
- **GitHub Pages:** aktivera Pages på repot och länka till `erik-game/index.html`.

Topplistan sparas per enhet (localStorage) — som på ett riktigt arkadspel:
den som håller i telefonen på kalaset försvarar rekordet.

*Med ❤ från familjen.*
