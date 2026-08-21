# CLAUDE.md — Super-Erik (födelsedagsspelet)

Kontext för arbete i `erik-game/`. Läs detta innan du ändrar något i spelet.

## Vad det här är

Ett födelsedagspresent-spel från Karl till hans bror **Erik** (med K, aldrig "Eric").
Hela familjen ska kunna spela det. Ton: varm svensk familjehumor, all speltext på
svenska (åäö). Publiceras som Claude-artifact och som fristående fil.

- **`index.html` — TURBORUSNINGEN (v3.4, huvudspelet):** endless runner i
  90-talssommar (Erik född 1990): eurodance-sequencer 126 BPM, hoppa/glid
  (coyote-time 0.12 + hoppbuffert), skruvar, krafter (magnet, KNAK‑KRAFTEN
  — hette "knäck-ruschen" t.o.m. v3.3, interna nycklar heter fortfarande
  `knack`!, balettglid=vals ×2, MIXTAPE 1990 = euroX + neonhimmel + keps),
  hållplatsräddningar av brorsbarnen (axelridning, ballong-hem vid träff,
  HELA GÄNGET +5000), hundräddning av sista hjärtat (en per hund, slow-mo),
  32 uppdrag → stjärnor → 8 albumkort (komponeras av sprites i `cardImg`).
  **Hälsa (v3.4):** `MAXLIV=4` hjärtplatser, start 3, HALVA hjärtan — mjuka
  träffar (moln/geting/plane/wave/plask) = ½, hårda (låda/skylt/walker-sida/
  boss-sida) = 1, via `hitErik(label, dmg)`. Healing: `osteo`-pickup
  BEHANDLINGEN +½ (vanlig), `heart` +1 (bara i nödläge, lives ≤ 1.5).
  **Lådregeln (v3.4):** box1/box2 stompas ofarligt uppifrån (KARTONGSTUDS
  +50, ingen kedjeeffekt); framifrån = skada; under KNAK‑KRAFTEN mosas de
  (lyser/darrar i drawObstacles). **NÄRA ÖGAT** +25: expanderad hitbox-koll
  (`growBox`, U*0.09) sätter `o.near`, belönas när hindret passerats utan
  träff (kräver tut.phase ≥ 4). **GYLLENE SKRUVEN** `gscrew` +250 (×2 i
  glid): spawnas över vatten (30 %), på höga trappor (22 %) och vid bossseger.
  **Tutorial körs EN gång** (`prof.tutDone`, sätts i fas 3; "Kör skolan igen"
  i pausen nollar): resetRound sätter fas 4 direkt när tutDone. Spawns gated
  tills fas 3. **Touchinput (v3.4-fixen!):** pointerdown på touch väntar 70 ms
  (`ptr.timer`) innan hoppet — svep ner (tröskel max(16, U*0.13), 450 ms)
  vinner och ger glid/dyk; dyk i luften sätter `e.dive` → glid vid landning;
  svep upp = hoppa direkt; mus/penna hoppar utan fördröjning.
  **BARNLÄGE** (`prof.barn` → `G.barn` per runda, knapp #btn-barn på titeln):
  fart ×0.66, snällare spawnpool (inga getingar/skyltar/box2), ingen boss,
  bredare plankor + plask utan skada, all skada ½, hundräddning laddar om
  (20 s cooldown), sparar till `erikRunnerTopplistaBarn` LOKALT — postar
  ALDRIG till servern. HUD visar BARNLÄGE-chip.
  Byggplank (`G.plats`, envägsplattformar via `supportAt`, låg 1.15U/hög 1.95U,
  trappmönster, skruvar+krafter på toppen). Stompbara fiender: portfölj-
  vandraren `walker` och stressmolnet — hopp uppifrån = studs; KEDJOR utan
  landning dubblar 150→1200 (`G.stompChain`, reset vid landning/träff).
  Vatten (`G.waters`): mark försvinner via `supportAt`; plask = hjärta +
  hög studs, under invuln skimrar Erik ofarligt; torrskodd passage räknas
  (`prof.tot.dry`); plankor garanterar väg; hundarna skuttar över själva.
  BOSS `JÄTTEMÖTET` var 1000:e m (`G.nextBoss`, hp 3+runda max 6):
  attacker = pappersflygplan (`plane`), slam→markskalv (`wave`), telegraf →
  RUSNING (`charge`, lean=1, hastighet 4.6U/s) — SKADA ENDAST vid stomp
  under lean; annars ofarlig "HÅRT HUVUD"-studs; sidokontakt skadar Erik.
  Seger: +2000×runda, hjärta + skruvregn, `prof.tot.boss`. Bossmusik =
  euro-sequencern med dark-flaggan (Am Am F E).
  Parallax: stugor/björkar/granar (0.18×), buskar/Volvo 245/glasskiosk/
  midsommarstång (0.55×, mindre + upphöjda = bakgrundskänsla), grusstig (1×).
- **`fangaren.html` — FÅNGAREN (v2.1, klassikern):** fångarspelet med
  balettfeber, vågor och getingar. Sedan v2.1 synkad mot samma worker med
  `spel=fangaren` (egen API_BAS-rad + NET/refreshGlobal, samma mönster som
  runnern). Redigeras DIREKT i fangaren.html med riktade ankar-edits —
  aldrig global ersättning (inbäddade fonter!). I övrigt: rör den inte.
- **`api/worker.js` — familjens topplista:** Cloudflare Worker (KV-binding
  `TOPPLISTA`), `GET/POST /topplista?spel=runner|fangaren`, poster `{n,s,d,t}`,
  validering (s ≤ 500 000, d ≤ 50 000, namn ≤ 14), spam-broms 30/min/IP,
  topp 200 sparas / 100 returneras. ⚠️ **Deployade workern (t.o.m. v3.3-
  filen) läser `spel` ENBART ur URL-queryn** — därför postar klienterna
  alltid med `?spel=...` i URL:en (funkar mot gamla och nya servern);
  nya worker.js läser även `body.spel` som fallback (URL vinner).
  Klienten: konstanten **API_BAS** i BÅDA spelfilerna (sök på API_BAS;
  tom = lokalt läge), `window.ERIK_API` överstyr för test,
  `NET.hamta/spara` + `refreshGlobal()`; statusrad ("SYNKAD"/"OFFLINE"),
  lokal localStorage alltid fallback, listor visar topp 25.
  E2E: `test-sync.mjs` (runner) och `test-sync-fangaren.mjs` (Fångaren) kör
  RIKTIGA worker.js bakom lokal HTTP-server med fejk-KV; `test-live.mjs`
  patchar `window.fetch` och bevisar att den INBAKADE API_BAS-adressen
  används; `test-34.mjs` täcker v3.4-funktionerna (touchglid, skola-en-gång,
  namn-prefill, topp 25, kartongstuds, halva hjärtan, guldskruv, barnläge).
  **LIVE sedan 2026-08-20:** Karls worker kör på
  `https://silent-base-a4be.workers-ff7.workers.dev` och den adressen är
  inbakad i API_BAS (källa: `r-part2.js` i scratchpad). Sandlådan kan INTE
  nå workers.dev (proxypolicy) — verifiera live-servern via Karl/mobilen.
- **Filer är enskilda och offline:** typsnitt (Baloo 2 + Nunito, latin) är
  inbäddade som base64-`@font-face`. Inga beroenden, ingen backend.
- **Branch:** `claude/eric-character-game-8rqfjs`
- **Artifact-URL (behåll denna!):** `https://claude.ai/code/artifact/4f6fa3cb-dd13-4e52-a685-c36c450de138`
  (artifacten kör Turborusningen)

## Personerna (fakta från riktiga foton — ändra inte utan nya referenser)

**Erik** — fixaren, lekproffset, osteopaten, balettdansören. Jobbar med
STAYHOT (mässingsduschar, lager/verkstad). Utseende i spelet, ritat efter foton:
kort rufsigt mörkblont hår med öppen panna, **getabocksskägg** (mustasch + hakskägg)
plus lätt kindstubb, marinblå **STAYHOT-batiktröja** med rosa mönster och orange
"STAYHOT"-brösttryck, mörka arbetsbyxor. Fångar han ett verktyg blixtras hans
**gröna STAYHOT-mössa** fram. I balettfeber: rosa tutu + tåspetsskor.

**Hundarna** — två bruna australian shepherds som älskar och hjälper Erik:
- **Lillen** — mindre, tjej. Ljusare brun, rosa halsband, ögonfransar.
  Snabb cooldown (7,5 s), kortare räckvidd (0.28×W).
- **Bernard** — större, kille. Mörkare brun, blått halsband.
  Längre cooldown (10 s), lång räckvidd (0.44×W).
De räddar bra föremål som är på väg att missas (dash + fångst i munnen) →
kombon överlever, +50 p, "LILLEN/BERNARD RÄDDAR!". Tass över huvudet = redo.
Under balettfebern sitter de vid scenkanten och tittar (inga räddningar).

**Brorsbarnen** (yngst → äldst, ca 3–17 år) — nycklar i koden inom parentes:
Ruben (`ruben`, tofsigt ljust hår, röd tröja) · Juniper (`juniper`, tofsar/puffs,
grön) · Emma-Lo (`emmalo`, lugg + långt blont, rosa) · Irma (`irma`, brun page +
fräknar, gul) · Olof (`olof`, kort brunt, blå) · Siri (`siri`, hästsvans, teal,
störst). De faller som föremål, rider på Eriks axlar när de fångas, och samlas i
HUD-raden. Alla sex i samma runda → **HELA GÄNGET! +1500**.

## Spelmekanik & balans

- Poäng: verktyg 100 · barn 150 (+300 första gången per barn) · patient 200 ·
  balettsko 300 · tårta 500. Kombo-multiplikator upp till ×5 (steg var 6:e fångst).
  Luftfångst ×1,5. Balettfeber 8,5 s = allt ×2 + magnet + vals-musik + ridå/spotlight.
- Fienden: stressmoln + tråkiga möten (faller), **getingar** (sinusflygande, från
  55 s, max 2 samtidigt, hundarna kan INTE rädda från dem). 3 hjärtan.
- Vågor (banner + hornfanfar): 25 s, 55 s (getingar), 85 s, 115 s. Ramp:
  `ramp() = elapsed/115`. Spawnintervall 1,05→0,36 s, dubbel-/trippelspawn sent.
- Ranker: 1000/3000/6000/10500/16000/23000 → "DEN ÄKTA ERIK" högst.
- localStorage-nycklar: Fångaren: `erikTopplista`, `erikLastName` (delas —
  runnern speglar sitt namn hit). Turborusningen: `erikRunnerTopplista`,
  `erikRunnerTopplistaBarn` (v3.4), `erikRunnerProfil` (stjärnor, klarade
  uppdrag, totalstatistik, personbästa, namn, `tutDone`, `barn`).
  Delad: `erikMuted`.
  **Byt aldrig namn på dessa** — familjens rekord/album ska överleva uppdateringar.

## Grafikregler

- **Inga emojis någonstans** — all grafik är handritad vektor:
  - Canvas-sprites ritas i 100×100-rymd i `ICONS`/`kidSprite` och cachas via
    `sprite()`/`drawSpr()` (byggs om vid DPR-ändring).
  - UI-ikoner är inline-SVG `<symbol>` (`#i-wrench`, `#i-paw`, `#i-shoe` osv).
- Stil: fyllda former, varm mörk kontur `rgba(61,43,31,.85)`, rundade hörn.
- Palett: himmel `#6BC6F0`, faluröd `#9E3F2F`, guld `#FFC94B`, kräm `#FFF8EC`,
  bläck `#33261D`; kategorifärger fix `#E8842B`, barn `#FF6FA0`, osteo `#2FB7A6`,
  balett `#B07BE0`, hundbrun `#7A4A2E`.
- Typsnitt: Baloo 2 (rubriker/HUD), Nunito (brödtext).

## ⚠️ Fallgropar (dyrköpta lärdomar)

1. **Gör ALDRIG global sök-och-ersätt över hela `index.html`.** De inbäddade
   typsnitten är base64 och kan innehålla vilken bokstavssekvens som helst —
   en `Eric→Erik`-ersättning korrumperade en gång två fontfiler ("A network
   error occurred" på data-URI:er). Undanta font-`<style>`-blocket, eller använd
   ordgräns-regex som `/(^|[^a-zA-Z])eric/`.
2. **Google Fonts är blockerat i sandlådan** (och kan vara nere på kalaset) —
   därför är fonterna inbäddade. Återinför aldrig en extern `<link>`.
3. Kombinationen spegel-flip (`ctx.scale(sx,1)`) + text ⇒ spegelvänd text.
   STAYHOT-trycket ritas därför med `ctx.scale(1/sx, 1)`-neutralisering.
4. Smala skärmar: hjärtbrickan och brorsbarns-raden krockar med hörnknapparna
   om offsets ändras — testa alltid 390×844.
5. **Touchbuggen (fixad i v3.4, återinför den inte):** hoppa ALDRIG direkt
   på `pointerdown` för touch — då hinner svep-ner aldrig registreras och
   glid blir omöjligt på mobil/iPad. 70 ms-fönstret + hoppbufferten är
   lösningen; mus/penna får hoppa direkt.
6. **Workerns `spel`-parameter läses ur URL-queryn** (den deployade versionen
   ignorerar body.spel) — POST:a alltid till `/topplista?spel=...`.
7. Cloudflares dashboard-uppladdare ("Upload and deploy", dra-och-släpp) gör
   worker-JS till statiska filer — koden körs aldrig. Rätt väg: Create →
   Worker → "Start with Hello World" → Edit code → klistra in → Deploy.

## Testa (gör detta före varje push/publicering)

Playwright finns i scratchpad-mappen; Chromium: `/opt/pw-browsers/chromium`
(`chromium.launch({ executablePath: ... })`). Pulserande knappar behöver
`click('#btn-start', { force: true })`.

Debug-krokar i spelet: `window.__erik` = `{ G, start, startFever, spawn(typ),
spawnWasp, catchKid(nyckel), forceOver(poäng) }`.

Testflöde som ska vara grönt med **noll konsol-/sidfel**: titel → start →
spawna alla föremålstyper → hundräddning → geting → balettfeber → game over →
spara namn → topplista → mobil 390×844. Granska skärmdumpar visuellt —
"ser rätt ut" är ett releasekrav, inte bara "kör utan fel".

## Publicera

- **Artifact (samma länk!):** ta bort `<!doctype>`, `<html>`, `<head>`, `<body>`
  och `<meta charset>` ur en kopia (behåll `<title>`, viewport-metan, styles,
  markup, script) och publicera. Från den här konversationen: samma
  scratchpad-fil (`super-eric.html`). Från en NY konversation: skicka med
  `url:`-parametern med artifact-URL:en ovan — annars skapas en ny artifact.
- **Zip för webbhotell/Netlify/itch.io:** `index.html` + `README.md` i zippens rot.
- Favicon för artifacten: 🩰 (byt inte — fliken känns igen på den).

## Repot i övrigt

Resten av repot är en **Fortnox MCP-server** (TypeScript, `src/`, `api/`) och
har inget med spelet att göra. Rör den inte i spelärenden, och rör inte
`vercel.json` (dess rewrites pekar allt mot `/api`).

## Idéer som väntar på klartecken (gör inte oombedda)

**v4.0-planen (godkänd riktning, ej påbörjad):** 1) VÄLJ DIN SPELARE — hela
familjen spelbar, upplåses med stjärnor, egen superkraft per karaktär, kräver
karaktärsfält i servern · 2) VÄRLDAR — Sommarvägen → STAYHOT-verkstan →
Kliniken → Balettscenen, ny värld var ~2000 m med egen musik/parallax/boss ·
3) VECKANS LOPP + FAMILJESPÖKEN — seedad veckobana med egen lista (kräver
siffror i workerns spel-param) och spöken av bästa åken.

Mindre: foton på riktiga Lillen & Bernard → justera teckningar · engelsk
språkväxel · fler albumkort/uppdrag · snyggare adress typ `api.eriks.family`
om domänens DNS någon gång flyttas till Cloudflare.
