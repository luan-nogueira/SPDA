import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const makeIcon = (color, label) =>
  L.divIcon({
    className: 'map-pin-wrapper',
    html: `<div class="map-pin" style="--pin-color:${color}"><span>${escapeHtml(label ?? '')}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 39],
    popupAnchor: [0, -36],
  });

/**
 * Mapa Leaflet reutilizável.
 * markers: [{ id, lat, lng, label, color, popupHtml }]
 */
export default function MapView({ markers = [], height = 260, draggable = false, accuracy = null, onMarkerDrag, onMarkerClick }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const groupRef = useRef(null);
  const lastCountRef = useRef(-1);
  const callbacksRef = useRef({ onMarkerDrag, onMarkerClick });
  callbacksRef.current = { onMarkerDrag, onMarkerClick };

  // Inicializa o mapa uma única vez
  useEffect(() => {
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true });

    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Tiles &copy; Esri' }
    );
    const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    });

    satellite.addTo(map);
    L.control.layers({ '🛰️ Satélite': satellite, '🗺️ Mapa': dark }, null, { position: 'topright' }).addTo(map);

    groupRef.current = L.layerGroup().addTo(map);
    map.setView([-15.78, -47.93], 4);
    mapRef.current = map;

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const markersKey = JSON.stringify(markers.map((m) => [m.id, m.lat, m.lng, m.label, m.color, m.popupHtml]));

  // Atualiza os marcadores
  useEffect(() => {
    const map = mapRef.current;
    const group = groupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    const valid = markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));

    valid.forEach((m) => {
      const marker = L.marker([m.lat, m.lng], {
        icon: makeIcon(m.color || '#3b82f6', m.label),
        draggable,
        autoPan: true,
      });
      if (m.popupHtml) marker.bindPopup(m.popupHtml);
      marker.on('click', () => callbacksRef.current.onMarkerClick?.(m.id));
      if (draggable) {
        marker.on('dragend', (e) => {
          const p = e.target.getLatLng();
          callbacksRef.current.onMarkerDrag?.(p.lat, p.lng);
        });
      }
      marker.addTo(group);
    });

    if (accuracy && valid.length === 1 && accuracy < 3000) {
      L.circle([valid[0].lat, valid[0].lng], {
        radius: accuracy,
        color: '#60a5fa',
        weight: 1,
        fillColor: '#3b82f6',
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(group);
    }

    // Só reenquadra quando a quantidade muda (evita "pular" durante o arraste)
    if (valid.length !== lastCountRef.current) {
      if (valid.length === 1) {
        map.setView([valid[0].lat, valid[0].lng], accuracy && accuracy > 1000 ? 14 : 18);
      } else if (valid.length > 1) {
        map.fitBounds(L.latLngBounds(valid.map((m) => [m.lat, m.lng])), { padding: [40, 40], maxZoom: 19 });
      }
      lastCountRef.current = valid.length;
    } else if (valid.length === 1) {
      map.panTo([valid[0].lat, valid[0].lng]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markersKey, draggable, accuracy]);

  return <div ref={containerRef} className="map-container" style={{ height }} />;
}

export { escapeHtml };
