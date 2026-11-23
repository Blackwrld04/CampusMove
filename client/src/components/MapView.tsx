import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Rider } from '../types';

interface MapViewProps {
  riders: Rider[];
  focusRiderId: string | null;
}

const CAMPUS_CENTER: [number, number] = [7.5215, 4.5265];

export const MapView: React.FC<MapViewProps> = ({ riders, focusRiderId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const trailsRef = useRef<Map<string, L.Polyline>>(new Map());
  const hasFittedRef = useRef(false);
  const focusedRiderRef = useRef<string | null>(null);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: CAMPUS_CENTER,
      zoom: 15,
      minZoom: 12,
      maxZoom: 19,
      zoomControl: false
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      trailsRef.current.clear();
    };
  }, []);

  // Draw every rider as a green dot plus their movement trail.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const activeIds = new Set<string>();

    riders.forEach((rider) => {
      activeIds.add(rider.id);

      if (rider.path.length > 1) {
        let trail = trailsRef.current.get(rider.id);

        if (!trail) {
          trail = L.polyline(rider.path, {
            color: '#10B981',
            weight: 5,
            opacity: 0.85,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);
          trailsRef.current.set(rider.id, trail);
        } else {
          trail.setLatLngs(rider.path);
        }
      } else {
        const trail = trailsRef.current.get(rider.id);
        if (trail) {
          trail.remove();
          trailsRef.current.delete(rider.id);
        }
      }

      let marker = markersRef.current.get(rider.id);

      if (marker) {
        marker.setLatLng([rider.lat, rider.lng]);
      } else {
        const icon = L.divIcon({
          className: 'rider-marker',
          html: '<div class="rider-dot"><span class="rider-dot-aura"></span><span class="rider-dot-core"></span></div>',
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });

        marker = L.marker([rider.lat, rider.lng], { icon, keyboard: false })
          .addTo(map)
          .bindTooltip('Sharing live', {
            direction: 'top',
            offset: [0, -14]
          });
        markersRef.current.set(rider.id, marker);
      }
    });

    // Remove riders who stopped sharing.
    markersRef.current.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    trailsRef.current.forEach((trail, id) => {
      if (!activeIds.has(id)) {
        trail.remove();
        trailsRef.current.delete(id);
      }
    });

    if (riders.length === 0) {
      hasFittedRef.current = false;
      focusedRiderRef.current = null;
      return;
    }

    // While you are sharing, keep your own dot in view and center on it once.
    if (focusRiderId) {
      const me = riders.find((rider) => rider.id === focusRiderId);

      if (me) {
        if (focusedRiderRef.current !== focusRiderId) {
          map.setView([me.lat, me.lng], 17);
          focusedRiderRef.current = focusRiderId;
        } else if (!map.getBounds().pad(-0.2).contains([me.lat, me.lng])) {
          map.panTo([me.lat, me.lng], { animate: true, duration: 0.8 });
        }
      }

      return;
    }

    // Otherwise fit all live riders once, without fighting manual panning.
    if (!hasFittedRef.current) {
      if (riders.length === 1) {
        map.setView([riders[0].lat, riders[0].lng], 16);
      } else {
        const points: [number, number][] = riders.flatMap((rider) =>
          rider.path.length > 1
            ? rider.path
            : ([[rider.lat, rider.lng]] as [number, number][])
        );

        map.fitBounds(L.latLngBounds(points), {
          padding: [60, 60],
          maxZoom: 17
        });
      }

      hasFittedRef.current = true;
    }
  }, [riders, focusRiderId]);

  return <div ref={containerRef} className="w-full h-full" />;
};
