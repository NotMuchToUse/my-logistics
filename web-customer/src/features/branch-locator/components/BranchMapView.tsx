import { useEffect, useMemo } from "react";
import { divIcon, type LatLngTuple } from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { LogisticsBranch } from "@/features/branch-locator/types/branch-locator.types";

interface BranchMapViewProps {
  branches: LogisticsBranch[];
  selectedBranchId: number | null;
  onSelect: (branch: LogisticsBranch) => void;
}

function MapSynchronizer({
  branches,
  selectedBranchId,
}: {
  branches: LogisticsBranch[];
  selectedBranchId: number | null;
}) {
  const map = useMap();

  useEffect(() => {
    const selected = branches.find(
      (branch) => branch.id === selectedBranchId,
    );

    if (selected) {
      map.flyTo([selected.latitude, selected.longitude], 15, {
        duration: 0.5,
      });
      return;
    }

    if (branches.length > 0) {
      const points: LatLngTuple[] = branches.map((branch) => [
        branch.latitude,
        branch.longitude,
      ]);

      if (points.length === 1) {
        map.setView(points[0], 13);
      } else {
        map.fitBounds(points, { padding: [30, 30] });
      }
    }
  }, [branches, map, selectedBranchId]);

  return null;
}

function mapsUrl(branch: LogisticsBranch): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${branch.latitude},${branch.longitude}`;
}

export function BranchMapView({
  branches,
  selectedBranchId,
  onSelect,
}: BranchMapViewProps) {
  const markerIcon = useMemo(
    () =>
      divIcon({
        className: "border-0 bg-transparent",
        html: '<div style="width:18px;height:18px;border-radius:50% 50% 50% 0;background:#2563eb;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);transform:rotate(-45deg)"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 18],
      }),
    [],
  );

  return (
    <div className="h-[420px] overflow-hidden rounded-lg border lg:h-[620px]">
      <MapContainer
        center={[16.0544, 108.2022]}
        zoom={6}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapSynchronizer
          branches={branches}
          selectedBranchId={selectedBranchId}
        />
        {branches.map((branch) => (
          <Marker
            key={branch.id}
            position={[branch.latitude, branch.longitude]}
            icon={markerIcon}
            eventHandlers={{
              click: () => onSelect(branch),
            }}
          >
            <Popup>
              <div className="min-w-48 space-y-1">
                <strong>{branch.name}</strong>
                <div className="text-xs">{branch.address_line}</div>
                <a
                  href={mapsUrl(branch)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-blue-600 underline"
                >
                  Chỉ đường
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
