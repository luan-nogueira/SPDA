// Utilitários de geolocalização com múltiplos fallbacks.
// Ordem: Wi-Fi/rede (rápido, funciona em notebook) -> GPS alta precisão -> IP (aproximado).

const getPosition = (options) =>
  new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });

const fromPosition = (pos, source = 'gps') => ({
  lat: pos.coords.latitude,
  lng: pos.coords.longitude,
  accuracy: Math.round(pos.coords.accuracy || 0),
  source,
  capturedAt: new Date().toISOString(),
});

class GeoError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

const fetchWithTimeout = async (url, ms = 6000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
};

export async function locateByIp() {
  const providers = [
    async () => {
      const d = await fetchWithTimeout('https://get.geojs.io/v1/ip/geo.json');
      return { lat: parseFloat(d.latitude), lng: parseFloat(d.longitude) };
    },
    async () => {
      const d = await fetchWithTimeout('https://ipapi.co/json/');
      return { lat: parseFloat(d.latitude), lng: parseFloat(d.longitude) };
    },
  ];

  for (const provider of providers) {
    try {
      const { lat, lng } = await provider();
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng, accuracy: 5000, source: 'ip', capturedAt: new Date().toISOString() };
      }
    } catch (e) {
      console.warn('Provedor de IP falhou:', e);
    }
  }
  return null;
}

/**
 * Tenta obter a localização do dispositivo com vários fallbacks.
 * @param {(msg: string) => void} onStatus callback para mostrar o passo atual
 */
export async function locateDevice(onStatus = () => {}) {
  const hasGeo = 'geolocation' in navigator && window.isSecureContext;

  if (hasGeo) {
    // 1) Rápido: rede/Wi-Fi (notebooks resolvem por aqui)
    try {
      onStatus('Buscando sinal via Wi-Fi / rede...');
      const pos = await getPosition({ enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
      return fromPosition(pos, 'gps');
    } catch (e) {
      if (e.code === 1) throw new GeoError('Permissão negada. Clique no cadeado 🔒 ao lado do endereço e libere a Localização.', 1);
      console.warn('Localização rápida falhou:', e);
    }

    // 2) GPS de alta precisão (celulares)
    try {
      onStatus('Tentando GPS de alta precisão...');
      const pos = await getPosition({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
      return fromPosition(pos, 'gps');
    } catch (e) {
      if (e.code === 1) throw new GeoError('Permissão negada. Clique no cadeado 🔒 ao lado do endereço e libere a Localização.', 1);
      console.warn('GPS alta precisão falhou:', e);
    }
  }

  // 3) Fallback por IP (aproximado — o usuário ajusta o pino no mapa)
  onStatus('Usando localização aproximada pela internet...');
  const ipLoc = await locateByIp();
  if (ipLoc) return ipLoc;

  throw new GeoError(
    hasGeo
      ? 'Não foi possível obter a localização. Verifique se a Localização do Windows está ativada ou cole as coordenadas manualmente.'
      : 'Este navegador bloqueou a localização (é necessário HTTPS). Cole as coordenadas manualmente.',
    2
  );
}

/**
 * Continua ouvindo o GPS por alguns segundos para melhorar a precisão.
 * Retorna uma função para cancelar.
 */
export function refineLocation(onUpdate, durationMs = 20000) {
  if (!('geolocation' in navigator)) return () => {};
  let best = Infinity;
  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (pos.coords.accuracy < best) {
        best = pos.coords.accuracy;
        onUpdate(fromPosition(pos, 'gps'));
      }
    },
    () => {},
    { enableHighAccuracy: true, timeout: durationMs, maximumAge: 0 }
  );
  const timer = setTimeout(() => navigator.geolocation.clearWatch(watchId), durationMs);
  return () => {
    clearTimeout(timer);
    navigator.geolocation.clearWatch(watchId);
  };
}

/** Aceita "-23.55, -46.63" ou links do Google Maps. */
export function parseCoordinates(text) {
  if (!text) return null;
  const t = text.trim();
  const patterns = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, // pino exato em links do Google Maps
    /@(-?\d+\.\d+),\s*(-?\d+\.\d+)/, // centro do mapa em links do Google Maps
    /[?&](?:q|query|ll)=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/,
    /(-?\d{1,3}\.\d+)\s*[,;\s]\s*(-?\d{1,3}\.\d+)/, // "lat, lng"
  ];
  for (const p of patterns) {
    const m = t.match(p);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return { lat, lng, accuracy: null, source: 'manual', capturedAt: new Date().toISOString() };
      }
    }
  }
  return null;
}

export const mapsLink = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

export const sourceLabel = (loc) => {
  if (!loc) return '';
  if (loc.source === 'ip') return 'Aproximada (internet)';
  if (loc.source === 'manual') return 'Ajustada manualmente';
  return loc.accuracy ? `GPS ±${loc.accuracy} m` : 'GPS';
};
