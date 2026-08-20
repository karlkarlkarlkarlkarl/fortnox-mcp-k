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
  Coyote-time och hoppbuffert gör att det känns proffsigt tajt. Varje runda
  börjar med en snabb inbyggd skola: Erik tar fem steg, spelet semipausar och
  du lär dig hoppa och glida genom att göra det.
- **Byggplank i höjdled:** hoppa upp på STAYHOT-ställningarna — skruvrader,
  muttrar och krafter väntar på övervåningen. Trappmönster i senare skede.
- **Hoppa PÅ fienderna:** det tråkiga mötet har fått ben — platta till det
  med ett hopp uppifrån (+150 och studs). Stressmolnen går också att poffa.
  **Kedja studsarna** utan att nudda marken: 150 → 300 → 600 → 1200!
- **Vatten:** ta dig planka-till-planka över dammarna (badankan i mässing
  hejar på). Plask kostar ett hjärta — men Erik skimrar vidare över ytan.
- **JÄTTEMÖTET (boss var 1000:e meter):** en jätteportfölj som kastar
  pappersflygplan och stampar fram markskalv. När den lutar sig fram och
  RUSAR — hoppa på huvudet! Tre KNAK häver mötet: +2000 × rundan, ett
  hjärta och ett skruvregn. Varje nytt möte är segare och argare.
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
- **Topplista:** hela familjens gemensamma lista, synkad mellan alla enheter
  via familjens egen server (faller automatiskt tillbaka till enhetens lokala
  lista offline).

## `fangaren.html` — FÅNGAREN (klassikern, v2)

Det ursprungliga fångarspelet: spring och fånga verktyg, brorsbarn,
patienter med ryggskott och balettskor — undvik stressmoln, tråkiga möten
och getingar. Balettfeber med ridå och strålkastare. Egen topplista.

## Kör spelen

- **Öppna direkt:** dubbelklicka på valfri HTML-fil.
- **Lokal server:** `npx serve erik-game` eller `python3 -m http.server`.
- **Publicera:** ladda upp båda filerna var som helst (Netlify Drop,
  itch.io, eget webbhotell). `index.html` blir startsidan.

## Synkad topplista — REDAN PÅKOPPLAD

Den här `index.html` är färdigkopplad mot familjens server (en gratis
Cloudflare Worker som kör `api/worker.js`, alias `topplista-worker.js`):

    API_BAS = https://silent-base-a4be.workers-ff7.workers.dev

Spelet visar "HELA FAMILJENS LISTA — SYNKAD" när servern nås och faller
automatiskt tillbaka till enhetens lokala lista offline. Servern har
rimlighetskontroller och spam-broms; gratisnivån räcker till tusentals
rundor om dagen. Snabbtest av servern: öppna
`https://silent-base-a4be.workers-ff7.workers.dev/topplista?spel=runner`
— den ska svara med JSON (`{"lista": ...}`).

**Om servern någon gång flyttar** (ny worker eller nytt konto):

1. *Workers & Pages → Create → Worker* → "Start with Hello World" → *Deploy*,
   sedan *Edit code* → ersätt allt med innehållet i `topplista-worker.js` → *Deploy*.
2. *Storage & Databases → KV → Create namespace* — döp den `TOPPLISTA`.
3. På workern: *Settings → Bindings → Add → KV namespace* —
   Variable name `TOPPLISTA`, välj ditt namespace. *Save*.
4. Klistra in den nya worker-adressen i `index.html` på raden märkt **API_BAS**
   (sök på API_BAS) och ladda upp filen igen.

Stjärnor och album ligger kvar i localStorage per enhet.

*Med ❤ från familjen.*
