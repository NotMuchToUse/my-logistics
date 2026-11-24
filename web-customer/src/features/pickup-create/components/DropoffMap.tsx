import { useEffect, useRef, useState } from "react";
import { MapPin, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DropoffBranch } from "../types/pickup.types";

function project(latitude: number, longitude: number, zoom: number) {
  const scale = 256 * 2 ** zoom;
  const sine = Math.sin(latitude * Math.PI / 180);
  return { x: (longitude + 180) / 360 * scale, y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * scale };
}

export function DropoffMap({ branches, selected, onSelect, disabled }: {
  branches: DropoffBranch[]; selected: string; onSelect: (id: string) => void; disabled: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [zoom, setZoom] = useState(13);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const center = branches.find((branch) => branch.public_id === selected) ?? branches[0];
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  if (!center) return null;
  const point = project(center.latitude, center.longitude, zoom);
  const left = point.x - width / 2;
  const top = point.y - 160;
  const tiles = [];
  for (let x = Math.floor(left / 256); x <= Math.floor((left + width) / 256); x++) {
    for (let y = Math.floor(top / 256); y <= Math.floor((top + 320) / 256); y++) tiles.push({ x, y });
  }
  return (
    <div className="space-y-2">
      <div ref={container} role="region" aria-label="Bản đồ chọn bưu cục" className="relative h-80 w-full overflow-hidden rounded-md border bg-muted">
        {!loaded && !failed && <p role="status" className="absolute left-3 top-3 text-sm">Đang tải bản đồ…</p>}
        {tiles.map(({ x, y }) => <img key={`${zoom}-${x}-${y}`} alt="" draggable={false}
          src={`https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`}
          onError={() => setFailed(true)} onLoad={() => setLoaded(true)}
          className="absolute h-64 w-64 max-w-none" style={{ left: x * 256 - left, top: y * 256 - top }} />)}
        {branches.map((branch) => {
          const position = project(branch.latitude, branch.longitude, zoom);
          const x = position.x - left; const y = position.y - top;
          if (x < 0 || x > width || y < 0 || y > 320) return null;
          return <button type="button" key={branch.public_id} aria-label={`Chọn ${branch.name} trên bản đồ`}
            aria-pressed={selected === branch.public_id} disabled={disabled} onClick={() => onSelect(branch.public_id)}
            className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full border bg-background shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
            style={{ left: x, top: y }}>
            <MapPin className={selected === branch.public_id ? "h-6 w-6 text-blue-700" : "h-6 w-6"} />
          </button>;
        })}
        <div className="absolute right-2 top-2 flex flex-col gap-1">
          <Button type="button" variant="outline" size="icon" aria-label="Phóng to bản đồ" disabled={zoom >= 17} onClick={() => setZoom((value) => value + 1)}><Plus className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="icon" aria-label="Thu nhỏ bản đồ" disabled={zoom <= 5} onClick={() => setZoom((value) => value - 1)}><Minus className="h-4 w-4" /></Button>
        </div>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="absolute bottom-0 right-0 bg-background/95 px-2 py-1 text-xs underline">© OpenStreetMap contributors</a>
      </div>
      {failed && <p role="alert" className="text-sm text-destructive">Không tải được nền bản đồ. Bạn vẫn có thể chọn bưu cục trong danh sách bên dưới.</p>}
      <p className="text-sm text-muted-foreground">Nhấn ghim để chọn. Chọn trong danh sách để đưa bưu cục về giữa bản đồ.</p>
    </div>
  );
}
