import type { Zone } from "../api/types";

interface MatrixSidebarProps {
  zones: Zone[];
  hiddenZoneIds: Set<string>;
  onToggleZone: (zoneId: string) => void;
}

const GRADES = [
  { grade: "A", range: "90 - 100", hint: "Minimal or no issues", color: "bg-green-500 dark:bg-status-success" },
  { grade: "B", range: "80 - 89", hint: "Minor issues found", color: "bg-green-400 dark:bg-status-success/70" },
  { grade: "C", range: "65 - 79", hint: "Moderate risk", color: "bg-amber-400 dark:bg-status-warning" },
  { grade: "D", range: "50 - 64", hint: "Significant risk", color: "bg-red-400 dark:bg-status-danger/70" },
  { grade: "F", range: "0 - 49", hint: "Critical issues", color: "bg-red-500 dark:bg-status-danger" },
];

const CELL_COLORS = [
  { label: "A / B grade", bg: "bg-green-100 dark:bg-status-success/15 border-green-300 dark:border-status-success/30" },
  { label: "C grade", bg: "bg-amber-100 dark:bg-status-warning/15 border-amber-300 dark:border-status-warning/30" },
  { label: "D / F grade", bg: "bg-red-100 dark:bg-status-danger/15 border-red-300 dark:border-status-danger/30" },
  { label: "No rules", bg: "bg-gray-100 dark:bg-noc-raised/50 border-gray-300 dark:border-noc-border" },
];

const UNIFI_DEFAULT_ZONE_NAMES = new Set(["external", "internal", "gateway", "vpn", "hotspot", "dmz", "guest"]);

function normalizeZoneName(zoneName: string): string {
  return zoneName.trim().toLowerCase().replace(/\s+/g, " ");
}

function isUnifiDefaultZone(zoneName: string): boolean {
  return UNIFI_DEFAULT_ZONE_NAMES.has(normalizeZoneName(zoneName));
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-display font-semibold uppercase tracking-wider text-gray-400 dark:text-noc-text-dim mb-2">
      {children}
    </h3>
  );
}

export default function MatrixSidebar({ zones, hiddenZoneIds, onToggleZone }: MatrixSidebarProps) {
  return (
    <div className="w-[220px] shrink-0 border-r border-gray-200 dark:border-noc-border bg-white dark:bg-noc-surface px-4 py-5 overflow-y-auto flex flex-col gap-5">
      <section>
        <SectionHeading>Security Score</SectionHeading>
        <p className="text-[11px] text-gray-500 dark:text-noc-text-secondary mb-2 leading-relaxed">
          Each zone pair starts at 100 and loses points per finding: <span className="font-semibold text-status-danger">-15</span> high, <span className="font-semibold text-status-warning">-8</span> medium, <span className="font-semibold text-gray-400 dark:text-noc-text-dim">-2</span> low.
        </p>
        <div className="flex flex-col gap-1">
          {GRADES.map(({ grade, range, hint, color }) => (
            <div key={grade} className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-sm shrink-0 ${color}`} />
              <span className="text-xs font-semibold text-gray-700 dark:text-noc-text w-4">{grade}</span>
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] text-gray-400 dark:text-noc-text-dim">{range}</span>
                <span className="text-[10px] text-gray-400 dark:text-noc-text-dim/70">{hint}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading>Cell Colors</SectionHeading>
        <div className="flex flex-col gap-1.5">
          {CELL_COLORS.map(({ label, bg }) => (
            <div key={label} className="flex items-center gap-2">
              <span className={`w-4 h-4 rounded border shrink-0 ${bg}`} />
              <span className="text-[11px] text-gray-500 dark:text-noc-text-secondary">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading>Zones</SectionHeading>
        <div className="flex flex-col gap-1">
          {zones.map((zone) => (
            <label
              key={zone.id}
              className="flex items-center gap-2 py-0.5 cursor-pointer select-none group"
            >
              <input
                type="checkbox"
                aria-label={zone.name}
                checked={!hiddenZoneIds.has(zone.id)}
                onChange={() => onToggleZone(zone.id)}
                className="h-3.5 w-3.5 rounded border-gray-300 dark:border-noc-border text-ub-blue focus:ring-ub-blue bg-white dark:bg-noc-input accent-ub-blue"
              />
              <div className="min-w-0 flex items-center gap-1.5">
                <span className="text-xs text-gray-600 dark:text-noc-text-secondary group-hover:text-gray-900 dark:group-hover:text-noc-text transition-colors">
                  {zone.name}
                </span>
                {isUnifiDefaultZone(zone.name) && (
                  <span className="rounded-full border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-gray-500 dark:border-noc-border dark:bg-noc-raised dark:text-noc-text-dim">
                    UniFi default
                  </span>
                )}
              </div>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
