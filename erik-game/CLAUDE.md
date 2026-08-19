# CLAUDE.md — Super-Erik (födelsedagsspelet)

Kontext för arbete i `erik-game/`. Läs detta innan du ändrar något i spelet.

## Vad det här är

Ett födelsedagspresent-spel från Karl till hans bror **Erik** (med K, aldrig "Eric").
Hela familjen ska kunna spela det. Ton: varm svensk familjehumor, all speltext på
svenska (åäö). Publiceras som Claude-artifact och som fristående fil.

- **`index.html` — TURBORUSNINGEN (v3, huvudspelet):** endless runner i
  90-talssommar (Erik född 1990): eurodance-sequencer 126 BPM, hoppa/glid
  (coyote-time + hoppbuffert), skruvar, krafter (magnet, knäck-rusch,
  balettglid=vals ×2, MIXTAPE 1990 = euroX + neonhimmel + keps/brillor),
  hållplatsräddningar av brorsbarnen (axelridning, ballong-hem vid träff,
  HELA GÄNGET +5000), hundräddning av sista hjärtat (en per hund, slow-mo),
  26 uppdrag → stjärnor → 8 albumkort (komponeras av sprites i `cardImg`).
  Rundstart-tutorial (fas 0–4 i `G.tut`): semipaus 0.1× med instruktionskort,
  avfärdas genom att UTFÖRA momentet (hopp → glid); spawns gated tills fas 3.
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
- **`fangaren.html` — FÅNGAREN (v2, klassikern):** fångarspelet med
  balettfeber, vågor och getingar. Rör den inte i onödan — den är klar.
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
- localStorage-nycklar: Fångaren: `erikTopplista`, `erikLastName`.
  Turborusningen: `erikRunnerTopplista`, `erikRunnerProfil` (stjärnor,
  klarade uppdrag, totalstatistik, personbästa, namn). Delad: `erikMuted`.
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

Foton på riktiga Lillen & Bernard → justera teckningar · engelsk språkväxel ·
delad topplista via backend · barnläge · fler albumkort/uppdrag ·
Turborusningen: fler hindertyper och en boss-våg.
