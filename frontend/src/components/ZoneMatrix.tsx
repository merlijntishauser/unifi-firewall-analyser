import { Fragment } from "react";
import type { Zone, ZonePair } from "../api/types";
import MatrixCell from "./MatrixCell";

interface ZoneMatrixProps {
  zones: Zone[];
  zonePairs: ZonePair[];
  onCellClick: (pair: ZonePair) => void;
  onZoneClick: (zoneId: string) => void;
}

function findPair(zonePairs: ZonePair[], srcId: string, dstId: string): ZonePair | undefined {
  return zonePairs.find((p) => p.source_zone_id === srcId && p.destination_zone_id === dstId);
}

export default function ZoneMatrix({ zones, zonePairs, onCellClick, onZoneClick }: ZoneMatrixProps) {
  const size = zones.length;

  return (
    <div className="h-full flex items-center justify-center p-8 overflow-auto bg-gray-50 dark:bg-gray-900">
      <div
        className="grid gap-px"
        style={{
          gridTemplateColumns: `auto repeat(${size}, minmax(48px, 80px))`,
          gridTemplateRows: `auto repeat(${size}, minmax(48px, 80px))`,
        }}
      >
        {/* Top-left empty corner */}
        <div />

        {/* Column headers */}
        {zones.map((zone) => (
          <button
            key={`col-${zone.id}`}
            data-testid={`col-header-${zone.id}`}
            onClick={() => onZoneClick(zone.id)}
            className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate px-1 pb-2 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer text-center"
            style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
          >
            {zone.name}
          </button>
        ))}

        {/* Rows */}
        {zones.map((srcZone) => (
          <Fragment key={srcZone.id}>
            {/* Row header */}
            <button
              data-testid={`row-header-${srcZone.id}`}
              onClick={() => onZoneClick(srcZone.id)}
              className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate pr-3 flex items-center hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
            >
              {srcZone.name}
            </button>

            {/* Cells */}
            {zones.map((dstZone) => {
              const pair = findPair(zonePairs, srcZone.id, dstZone.id);
              const isSelf = srcZone.id === dstZone.id;

              return (
                <MatrixCell
                  key={`${srcZone.id}-${dstZone.id}`}
                  totalRules={pair?.rules.length ?? 0}
                  grade={pair?.analysis?.grade ?? null}
                  onClick={() => {
                    if (pair) {
                      onCellClick(pair);
                    }
                  }}
                  isSelfPair={isSelf}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
