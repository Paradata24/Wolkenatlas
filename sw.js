// Hintergrund-Helfer („Service Worker“) der Web-App Wolkenatlas (Nov. 2026,
// nach dem Vorbild des Helfers von SISOSIG).
//
// Angemeldet wird er nur, wenn die Seite als App läuft (vom Home-Bildschirm
// geöffnet; siehe „Den Hintergrund-Helfer anmelden“ unten in index.html).
// Aufgaben:
//   1. Die App startet auch OHNE NETZ: Seite, Symbole und die Programmteile von
//      unpkg.com (Leaflet) und esm.sh (supabase-js) werden gespeichert.
//   2. Jedes angesehene Kartenstück wird gespeichert (OpenTopoMap und die
//      Höhenkacheln der Gelände-Farben). Wer ein Gebiet vorher einmal in den
//      gebrauchten Zoomstufen anschaut, hat es am Berg auch ohne Empfang.
//
// Die Daten selbst (Flüge, Orte, Ausrüstung) speichert NICHT dieser Helfer,
// sondern die Seite: Sie legt nach jedem Laden eine Kopie im Handy ab und zeigt
// sie ohne Netz an (siehe „WEB-APP: OHNE NETZ“ in index.html). Anfragen an
// Supabase und Open Topo Data gehen deshalb hier unberührt durch.
//
// Grundregel wie bei SISOSIG: MIT Netz verhält sich alles wie die normale
// Website — die Seite kommt immer zuerst frisch aus dem Netz, der Speicher ist
// nur Ersatz bei Netzausfall. Wichtig, weil der Helfer bei Android auch für die
// Website in Chrome gilt, sobald die App installiert ist. Als Netzausfall zählt
// auch ein Netz, das nicht rechtzeitig antwortet (SEITE_WARTEN_MS): typisch
// bei schwachem Empfang am Berg.
//
// Bewusst KEIN Knopf „ganzes Gebiet herunterladen“: OpenTopoMap verbietet
// Massen-Downloads in seinen Nutzungsregeln. Gespeichert wird nur, was man sich
// ohnehin ansieht.

// Bei einer grundlegenden Änderung an diesem Helfer hochzählen: Die alten
// Speicher werden dann beim nächsten Start gelöscht.
const VERSION = "v1";
const SEITE = `wolkenatlas-seite-${VERSION}`;
const PROGRAMM = `wolkenatlas-programm-${VERSION}`;
const KARTE = `wolkenatlas-karte-${VERSION}`;
const ALLE = [SEITE, PROGRAMM, KARTE];

// Obergrenzen, damit das Handy nicht vollläuft. Ein Kartenstück hat rund
// 10–30 KB (Höhenkacheln bis ~100 KB), 4000 Stück sind also etwa 100–150 MB.
// Darüber fliegen die ältesten zuerst raus.
const MAX_KARTE = 4000;
// Programmteile: supabase-js besteht aus gut einem Dutzend Dateien; bei einer
// neuen Version kommen neue dazu, die alten fliegen irgendwann raus.
const MAX_PROGRAMM = 120;
// Kartenstücke werden nach so langer Zeit (mit Netz) neu geholt, damit
// Änderungen an der Karte irgendwann ankommen.
const KARTE_MAX_ALTER_MS = 30 * 24 * 60 * 60 * 1000;

// So lange wartet die App höchstens auf das Netz, bevor sie die gespeicherte
// Fassung zeigt. Mit normalem Netz kommt alles in 0,5–2 s, es ändert sich also
// nichts. Kommt die Antwort später doch noch, wird sie trotzdem gespeichert.
const SEITE_WARTEN_MS = 5000;

// Kopfzeile mit dem Zeitpunkt, an dem ein Kartenstück gespeichert wurde.
const GESPEICHERT = "x-wolkenatlas-gespeichert";

// Woher die Programmteile kommen (siehe <script>/<link> in index.html).
const PROGRAMM_HOSTS = ["unpkg.com", "esm.sh"];

// Kartenstücke: OpenTopoMap (a., b., c.tile.opentopomap.org) und die freien
// Höhenkacheln auf Amazon, aus denen die Seite Hangneigung und -ausrichtung
// rechnet. Beide erlauben den Abruf von fremden Seiten (CORS) — nur so lassen
// sich die Stücke sinnvoll speichern. Kommt ein Kartendienst dazu, muss er hier
// ergänzt werden.
function istKartenstueck(url) {
  return (
    /(^|\.)tile\.opentopomap\.org$/.test(url.hostname) ||
    (url.hostname === "s3.amazonaws.com" && url.pathname.startsWith("/elevation-tiles-prod/"))
  );
}

// Eine Adresse mit fester Versionsnummer (z. B. „leaflet@1.9.4“) ändert ihren
// Inhalt nie — einmal gespeichert, gilt sie für immer. Ohne feste Nummer (etwa
// „supabase-js@2“, das auf die jeweils neueste 2er-Fassung zeigt) wird zuerst
// im Netz nachgesehen.
const MIT_FESTER_VERSION = /@\d+\.\d+\.\d+/;

self.addEventListener("install", () => {
  // Neue Version sofort übernehmen statt erst nach dem Schließen aller Fenster.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const namen = await caches.keys();
      await Promise.all(
        namen
          .filter((n) => n.startsWith("wolkenatlas-") && !ALLE.includes(n))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

// Beim ersten Start war der Helfer noch nicht da, als Seite und Programmteile
// geladen wurden. Die Seite schickt deshalb nach der Anmeldung die Liste der
// schon geladenen Dateien, die hier nachträglich gespeichert werden.
self.addEventListener("message", (event) => {
  const daten = event.data;
  if (!daten || daten.type !== "dateien-merken" || !Array.isArray(daten.urls)) return;
  event.waitUntil(
    (async () => {
      for (const adresse of daten.urls) {
        try {
          const url = new URL(adresse, self.registration.scope);
          if (url.origin === self.location.origin) {
            const speicher = await caches.open(SEITE);
            const schluessel = istStartseite(url) ? self.registration.scope : ohneSuche(url);
            if (!(await speicher.match(schluessel, { ignoreVary: true }))) {
              const antwort = await fetch(url.href);
              if (antwort.ok) await speicher.put(schluessel, antwort);
            }
          } else if (PROGRAMM_HOSTS.includes(url.hostname)) {
            const speicher = await caches.open(PROGRAMM);
            if (!(await speicher.match(url.href, { ignoreVary: true }))) {
              const antwort = await fetch(url.href, { mode: "cors", credentials: "omit" });
              if (antwort.ok) await speicher.put(url.href, antwort);
            }
          }
        } catch {
          // Einzelne Datei nicht zu holen: egal, sie kommt beim nächsten Mal.
        }
      }
      await kuerze(PROGRAMM, MAX_PROGRAMM);
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const anfrage = event.request;
  if (anfrage.method !== "GET") return;
  const url = new URL(anfrage.url);

  if (url.origin === self.location.origin) {
    if (anfrage.mode === "navigate") {
      // Die Seite selbst, auch mit „?sos“ (Abkürzung aufs S.o.S.) — gespeichert
      // wird sie immer unter derselben Adresse.
      event.respondWith(netzZuerst(event, self.registration.scope));
    } else {
      // Logo, Symbole, App-Beschreibung.
      event.respondWith(netzZuerst(event, ohneSuche(url)));
    }
    return;
  }

  if (PROGRAMM_HOSTS.includes(url.hostname)) {
    event.respondWith(
      MIT_FESTER_VERSION.test(url.pathname) ? programmteil(anfrage) : programmNetzZuerst(event),
    );
    return;
  }

  if (istKartenstueck(url)) {
    event.respondWith(kartenstueck(anfrage));
  }
  // Alles andere (Supabase, Open Topo Data …) geht unverändert ans Netz.
});

function istStartseite(url) {
  const scope = new URL(self.registration.scope);
  return url.pathname === scope.pathname || url.pathname === scope.pathname + "index.html";
}

function ohneSuche(url) {
  return url.origin + url.pathname;
}

// Seite und eigene Dateien: frisch aus dem Netz und dabei speichern; ohne Netz
// (oder nach SEITE_WARTEN_MS) die zuletzt gespeicherte Fassung.
function netzZuerst(event, schluessel) {
  const netz = fetch(event.request).then(async (antwort) => {
    if (antwort.ok) {
      try {
        const speicher = await caches.open(SEITE);
        await speicher.put(schluessel, antwort.clone());
      } catch {
        // Speicher voll o. ä.: Die Antwort kommt trotzdem an.
      }
    }
    return antwort;
  });
  return netzOderGespeichert(event, netz, async () => {
    const speicher = await caches.open(SEITE);
    return speicher.match(schluessel, { ignoreVary: true });
  });
}

// Programmteil ohne feste Versionsnummer: wie die Seite zuerst aus dem Netz.
function programmNetzZuerst(event) {
  const adresse = event.request.url;
  const netz = fetch(adresse, { mode: "cors", credentials: "omit" }).then(async (antwort) => {
    if (antwort.ok) {
      try {
        const speicher = await caches.open(PROGRAMM);
        await speicher.put(adresse, antwort.clone());
      } catch {
        // Speicher voll o. ä.: Die Antwort kommt trotzdem an.
      }
    }
    return antwort;
  });
  return netzOderGespeichert(event, netz, async () => {
    const speicher = await caches.open(PROGRAMM);
    return speicher.match(adresse, { ignoreVary: true });
  });
}

// Gemeinsamer Ablauf: auf das Netz warten, höchstens SEITE_WARTEN_MS lang.
// Danach (oder bei Netzfehler) die gespeicherte Fassung, falls es eine gibt —
// sonst weiter auf das Netz warten bzw. dessen Fehler weitergeben. Die
// Netzantwort läuft im Hintergrund weiter und wird noch gespeichert, wenn sie
// nach dem Zeitlimit eintrifft (waitUntil hält den Helfer dafür wach; es muss
// vor dem ersten await aufgerufen werden).
async function netzOderGespeichert(event, netz, ladeGespeichert) {
  event.waitUntil(netz.catch(() => {}));
  let uhr;
  const zeitlimit = new Promise((_, nein) => {
    uhr = setTimeout(() => nein(new Error("Zeitlimit")), SEITE_WARTEN_MS);
  });
  try {
    return await Promise.race([netz, zeitlimit]);
  } catch {
    const gespeichert = await ladeGespeichert();
    if (gespeichert) return gespeichert;
    return netz;
  } finally {
    clearTimeout(uhr);
  }
}

// Programmteil mit fester Versionsnummer: aus dem Speicher, sonst holen und
// speichern. Selbst im CORS-Modus abgerufen (auch wenn die Seite die Datei als
// einfaches <script>/<link> anfordert): Eine „offene“ Antwort zählt nur mit
// ihrer echten Größe gegen das Speicherlimit, eine verschlossene mit mehreren MB.
async function programmteil(anfrage) {
  const speicher = await caches.open(PROGRAMM);
  const gespeichert = await speicher.match(anfrage.url, { ignoreVary: true });
  if (gespeichert) return gespeichert;
  const antwort = await fetch(anfrage.url, { mode: "cors", credentials: "omit" });
  if (antwort.ok) {
    try {
      await speicher.put(anfrage.url, antwort.clone());
      void kuerze(PROGRAMM, MAX_PROGRAMM);
    } catch {
      // Speicher voll o. ä.
    }
  }
  return antwort;
}

// Kartenstücke: aus dem Speicher, wenn vorhanden (schneller, spart Akku und
// Datenvolumen); sonst aus dem Netz holen und speichern. Sehr alte Stücke
// werden mit Netz erneuert.
let gespeichertSeitKuerzen = 0;
async function kartenstueck(anfrage) {
  const speicher = await caches.open(KARTE);
  const gespeichert = await speicher.match(anfrage.url);
  if (gespeichert && !aelterAls(gespeichert, KARTE_MAX_ALTER_MS)) return gespeichert;

  try {
    const antwort = await fetch(anfrage.url, { mode: "cors", credentials: "omit" });
    if (antwort.ok) {
      await speicher.put(anfrage.url, await mitZeitstempel(antwort.clone()));
      gespeichertSeitKuerzen += 1;
      if (gespeichertSeitKuerzen >= 100) {
        gespeichertSeitKuerzen = 0;
        void kuerze(KARTE, MAX_KARTE);
      }
    }
    return antwort;
  } catch {
    if (gespeichert) return gespeichert;
    // CORS-Abruf gescheitert (z. B. ein Dienst ändert seine Regeln): ganz
    // normal weiterreichen, dann eben ohne Speichern.
    return fetch(anfrage);
  }
}

async function mitZeitstempel(antwort) {
  const kopf = new Headers(antwort.headers);
  kopf.set(GESPEICHERT, new Date().toISOString());
  const inhalt = await antwort.blob();
  return new Response(inhalt, { status: antwort.status, statusText: antwort.statusText, headers: kopf });
}

function aelterAls(antwort, ms) {
  const zeit = Date.parse(antwort.headers.get(GESPEICHERT) || "");
  return Number.isNaN(zeit) || Date.now() - zeit > ms;
}

// Die ältesten Einträge löschen (der Speicher liefert sie in der Reihenfolge,
// in der sie gespeichert wurden).
async function kuerze(name, hoechstens) {
  const speicher = await caches.open(name);
  const schluessel = await speicher.keys();
  for (let i = 0; i < schluessel.length - hoechstens; i++) {
    await speicher.delete(schluessel[i]);
  }
}
