"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function ClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function InvalidateSize({ trigger }: { trigger: any }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(t);
  }, [trigger, map]);
  return null;
}

type MapMode = "satellite" | "map";

export default function LocationPickerMap({
  lat,
  lng,
  onChange,
  height = 260,
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  height?: number;
}) {
  const [mode, setMode] = useState<MapMode>("satellite");

  const centerKey = `${lat.toFixed(6)}-${lng.toFixed(6)}`;

  const isSatellite = mode === "satellite";

  return (
    <div className="rounded-md overflow-hidden border relative" style={{ height }}>
      <div className="absolute z-[1000] top-2 right-2 flex rounded-md overflow-hidden border bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setMode("satellite")}
          className={`px-3 py-1 text-xs font-semibold ${
            isSatellite ? "bg-purple-600 text-white" : "bg-white text-gray-700"
          }`}
          title="Tampilan Satelit"
        >
          Satelit
        </button>
        <button
          type="button"
          onClick={() => setMode("map")}
          className={`px-3 py-1 text-xs font-semibold ${
            !isSatellite ? "bg-purple-600 text-white" : "bg-white text-gray-700"
          }`}
          title="Tampilan Peta"
        >
          Peta
        </button>
      </div>

      <MapContainer
        key={centerKey}
        center={[lat, lng]}
        zoom={17}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <InvalidateSize trigger={`${centerKey}-${mode}`} />

        {isSatellite ? (
          <>
            <TileLayer
              attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              opacity={0.6}
            />
          </>
        ) : (
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}

        <ClickHandler onPick={onChange} />

        <Marker
          position={[lat, lng]}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const m = e.target as any;
              const p = m.getLatLng();
              onChange(p.lat, p.lng);
            },
          }}
        />
      </MapContainer>
    </div>
  );
}
