/* Offline-Kopie des Flugbuchs.

   Damit sich ein Check am Gipfel auch dann weiter ausfüllen lässt, wenn das Handy
   die Seite ohne Netz neu lädt, hält der Browser hier eine Kopie bereit:

   · die Seite selbst (index.html): mit Netz immer frisch vom Server, die Kopie
     springt nur ein, wenn keine Antwort kommt;
   · die Bibliotheken von unpkg.com und esm.sh (Leaflet, supabase-js): einmal
     geholt, dann aus der Kopie — die Adressen ändern sich nicht.

   Kartenkacheln, Höhen und die Datenbank gehen immer direkt ins Netz und werden
   hier nicht aufgehoben. Wer etwas an dieser Datei ändert, zählt CACHE hoch —
   dann wird die alte Kopie beim nächsten Öffnen weggeräumt. */

const CACHE = 'flugbuch-v1';
const SEITE = new URL('./', self.registration.scope).href;
const BIBLIOTHEKEN = ['unpkg.com', 'esm.sh'];
/* So lange wartet die Seite auf das Netz, bevor die Kopie einspringt. */
const GEDULD = 4000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.add(SEITE)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(namen => Promise.all(namen.filter(n => n !== CACHE).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' && url.origin === location.origin) e.respondWith(seite(req));
  else if (BIBLIOTHEKEN.includes(url.hostname)) e.respondWith(bibliothek(req));
});

/* Erst das Netz. Kommt in GEDULD Millisekunden nichts (Funkloch), die Kopie —
   das Netz darf trotzdem fertig laden und frischt die Kopie dann auf. */
async function seite(req){
  const cache = await caches.open(CACHE);
  const netz = fetch(req).then(res => {
    if (res.ok) cache.put(SEITE, res.clone());
    return res;
  });
  netz.catch(() => {});   /* schlägt es fehl, nachdem die Kopie schon geliefert ist: egal */
  const warten = new Promise(ok => setTimeout(ok, GEDULD));
  try {
    const erstes = await Promise.race([netz, warten]);
    if (erstes) return erstes;
    const kopie = await cache.match(SEITE);
    return kopie || await netz;
  } catch {
    const kopie = await cache.match(SEITE);
    if (kopie) return kopie;
    throw new Error('offline und keine Kopie');
  }
}

async function bibliothek(req){
  const cache = await caches.open(CACHE);
  const kopie = await cache.match(req);
  if (kopie) return kopie;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}
