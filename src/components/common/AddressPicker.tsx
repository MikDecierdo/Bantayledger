import { IonIcon } from '@ionic/react';
import { locationOutline } from 'ionicons/icons';
import type { Map as LeafletMap, Marker } from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { useEffect, useId, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import './AddressPicker.css';
import { t } from '../../i18n';

export interface AddressValue {
  address: string;
  lat: number | null;
  lng: number | null;
}

interface AddressPickerProps {
  label: string;
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  placeholder?: string;
  className?: string;
}

interface Suggestion {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

/*
 * Free stack, no API key: OpenStreetMap tiles for the map and Photon
 * (https://photon.komoot.io, built for type-ahead) for search and reverse
 * lookup. Search is biased to the Philippines.
 */
const PHOTON = 'https://photon.komoot.io';
const PH_BBOX = '116.9,4.5,126.6,21.2'; // minLon,minLat,maxLon,maxLat
const PH_CENTER: [number, number] = [12.8797, 121.774];
const SEARCH_DEBOUNCE_MS = 350;

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | number | undefined>;
}

function labelFor(props: PhotonFeature['properties']): string {
  const street = [props.housenumber, props.street].filter(Boolean).join(' ');
  const parts = [props.name, street, props.district, props.city ?? props.county, props.state]
    .filter((p): p is string | number => Boolean(p))
    .map(String);
  // Photon repeats the name as the street for plain street results.
  return parts.filter((p, i) => parts.indexOf(p) === i).join(', ');
}

function toSuggestion(f: PhotonFeature, i: number): Suggestion | null {
  const label = labelFor(f.properties);
  const [lng, lat] = f.geometry.coordinates;
  if (!label || typeof lat !== 'number' || typeof lng !== 'number') return null;
  return { id: `${i}-${lat}-${lng}`, label, lat, lng };
}

/**
 * Address field with auto-suggest and an interactive map. Picking a suggestion
 * (or clicking the map / dragging the pin) fills in the address text and
 * coordinates; typing freely still works and never blocks saving.
 */
export function AddressPicker({ label, value, onChange, placeholder, className }: AddressPickerProps) {
  const id = useId();
  const listId = `${id}-list`;
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const searchAbort = useRef<AbortController | null>(null);
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle');
  const [resolving, setResolving] = useState(false);

  /** Moves the pin, creating it on first use. Does not fire onChange. */
  const placePin = (lat: number, lng: number, fly: boolean) => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    marker.setLatLng([lat, lng]);
    if (!map.hasLayer(marker)) marker.addTo(map);
    if (fly) map.flyTo([lat, lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
  };

  /** Looks up the address for a map position (click / drag) and reports it. */
  const resolvePosition = async (lat: number, lng: number) => {
    setResolving(true);
    try {
      const res = await fetch(`${PHOTON}/reverse?lon=${lng}&lat=${lat}&lang=en`);
      const json = (await res.json()) as { features?: PhotonFeature[] };
      const found = json.features?.[0] ? labelFor(json.features[0].properties) : '';
      latest.current.onChange({
        address: found || latest.current.value.address,
        lat,
        lng,
      });
    } catch {
      // Lookup unavailable: keep the typed text, still remember the pin.
      latest.current.onChange({ address: latest.current.value.address, lat, lng });
    } finally {
      setResolving(false);
    }
  };

  // Build the map once; Leaflet is loaded on demand so it only ships when a
  // form that uses the picker is opened.
  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    void import('leaflet').then((L) => {
      if (disposed || !mapEl.current) return;

      const icon = L.icon({
        iconUrl: markerIcon,
        iconRetinaUrl: markerIcon2x,
        shadowUrl: markerShadow,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      const { lat, lng } = latest.current.value;
      const map = L.map(mapEl.current, {
        center: lat !== null && lng !== null ? [lat, lng] : PH_CENTER,
        zoom: lat !== null && lng !== null ? 16 : 5,
        scrollWheelZoom: false,
      });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const marker = L.marker(lat !== null && lng !== null ? [lat, lng] : PH_CENTER, {
        icon,
        draggable: true,
      });
      if (lat !== null && lng !== null) marker.addTo(map);

      marker.on('dragend', () => {
        const p = marker.getLatLng();
        void resolvePosition(p.lat, p.lng);
      });
      map.on('click', (e) => {
        placePin(e.latlng.lat, e.latlng.lng, false);
        void resolvePosition(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      markerRef.current = marker;

      // The modal animates in, so the container has no final size yet.
      const ro = new ResizeObserver(() => map.invalidateSize());
      ro.observe(mapEl.current);
      const t = window.setTimeout(() => map.invalidateSize(), 350);

      cleanup = () => {
        window.clearTimeout(t);
        ro.disconnect();
        map.remove();
        mapRef.current = null;
        markerRef.current = null;
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleared from outside (form reset): drop the pin.
  useEffect(() => {
    if (value.lat === null && value.lng === null) markerRef.current?.remove();
  }, [value.lat, value.lng]);

  useEffect(() => () => searchAbort.current?.abort(), []);

  // Debounced, abortable type-ahead search.
  const search = (q: string) => {
    searchAbort.current?.abort();
    if (q.trim().length < 3) {
      setSuggestions([]);
      setStatus('idle');
      setOpen(false);
      return;
    }
    setStatus('loading');
    setOpen(true);
    const controller = new AbortController();
    searchAbort.current = controller;
    const timer = window.setTimeout(async () => {
      try {
        const url = `${PHOTON}/api/?q=${encodeURIComponent(q)}&limit=5&lang=en&bbox=${PH_BBOX}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { features?: PhotonFeature[] };
        const next = (json.features ?? [])
          .map(toSuggestion)
          .filter((s): s is Suggestion => s !== null);
        setSuggestions(next);
        setActive(-1);
        setStatus(next.length ? 'idle' : 'empty');
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setSuggestions([]);
        setStatus('error');
      }
    }, SEARCH_DEBOUNCE_MS);
    controller.signal.addEventListener('abort', () => window.clearTimeout(timer));
  };

  const choose = (s: Suggestion) => {
    onChange({ address: s.label, lat: s.lat, lng: s.lng });
    placePin(s.lat, s.lng, true);
    setOpen(false);
    setSuggestions([]);
    setStatus('idle');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(suggestions.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && active >= 0 && suggestions[active]) {
      e.preventDefault();
      choose(suggestions[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const hasPin = value.lat !== null && value.lng !== null;

  return (
    <div className={['bl-field', 'bl-addr', className ?? ''].filter(Boolean).join(' ')}>
      <label className="bl-field__label" htmlFor={id}>
        {label}
      </label>

      <div className="bl-addr__box">
        <input
          id={id}
          className="bl-input"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          placeholder={placeholder ?? t('Search a street, barangay or city')}
          value={value.address}
          onChange={(e) => {
            onChange({ ...value, address: e.target.value });
            search(e.target.value);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
        />

        {open && (
          <ul className="bl-addr__list" id={listId} role="listbox">
            {status === 'loading' && <li className="bl-addr__note">{t('Searching…')}</li>}
            {status === 'empty' && <li className="bl-addr__note">{t('No matches — you can still type the address.')}</li>}
            {status === 'error' && (
              <li className="bl-addr__note">{t('Search is unavailable — you can still type the address.')}</li>
            )}
            {suggestions.map((s, i) => (
              <li
                key={s.id}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                className={`bl-addr__opt${i === active ? ' is-active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(s);
                }}
              >
                <IonIcon icon={locationOutline} aria-hidden="true" />
                <span>{s.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bl-addr__map" ref={mapEl} role="application" aria-label={t('Map: click or drag the pin to set the location')} />

      <div className="bl-addr__foot">
        <span className="bl-field__hint">
          {resolving
            ? t('Finding the address…')
            : hasPin
              ? t('Drag the pin or click the map to adjust.')
              : t('Pick a suggestion, or click the map to drop a pin.')}
        </span>
        {hasPin && (
          <button
            type="button"
            className="bl-addr__clear"
            onClick={() => onChange({ address: value.address, lat: null, lng: null })}
          >
            {t('Clear pin')}
          </button>
        )}
      </div>
    </div>
  );
}

export default AddressPicker;
