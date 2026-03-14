import { useCallback, useEffect, useRef, useState } from "react";

interface SvgViewerProps {
  svgContent: string;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.1;

export default function SvgViewer({ svgContent }: SvgViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      svgRef.current.innerHTML = svgContent;
    }
  }, [svgContent]);

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const direction = e.deltaY < 0 ? 1 : -1;
    const newZoom = clampZoom(zoom + direction * ZOOM_STEP * zoom);
    const scale = newZoom / zoom;

    setPan({ x: cursorX - scale * (cursorX - pan.x), y: cursorY - scale * (cursorY - pan.y) });
    setZoom(newZoom);
  }, [zoom, pan]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setDragging(true);
    lastPointer.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }, [dragging]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const zoomIn = useCallback(() => setZoom((z) => clampZoom(z + ZOOM_STEP * z)), []);
  const zoomOut = useCallback(() => setZoom((z) => clampZoom(z - ZOOM_STEP * z)), []);

  // SVG content is generated server-side by the unifi-topology library (trusted)
  return (
    <div className="relative flex-1 overflow-hidden bg-gray-100 dark:bg-noc-bg">
      <div
        ref={containerRef}
        className={`w-full h-full ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        data-testid="svg-viewer"
      >
        <div
          ref={svgRef}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        />
      </div>
      <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-lg bg-white dark:bg-noc-surface border border-gray-200 dark:border-noc-border shadow-sm overflow-hidden">
        <button onClick={zoomOut} className="px-2 py-1 text-sm text-gray-600 dark:text-noc-text-secondary hover:bg-gray-100 dark:hover:bg-noc-raised transition-colors" aria-label="Zoom out">-</button>
        <button onClick={resetView} className="px-2 py-1 text-xs text-gray-500 dark:text-noc-text-dim hover:bg-gray-100 dark:hover:bg-noc-raised transition-colors min-w-[3rem] text-center" aria-label="Reset zoom">
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={zoomIn} className="px-2 py-1 text-sm text-gray-600 dark:text-noc-text-secondary hover:bg-gray-100 dark:hover:bg-noc-raised transition-colors" aria-label="Zoom in">+</button>
      </div>
    </div>
  );
}
