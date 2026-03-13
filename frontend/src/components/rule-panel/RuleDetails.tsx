import type { Rule } from "../../api/types";
import { resolveGrouped, formatSchedule, formatIpSec } from "./utils";

const LABEL_CLASS = "text-[11px] font-medium text-gray-500 dark:text-noc-text-secondary whitespace-nowrap";

interface DetailRow {
  label: string;
  value: string;
  type: "text" | "mono" | "status";
  note?: string;
  active?: boolean;
}

interface DetailSection {
  title: string;
  rows: DetailRow[];
}

function buildDetailSections(rule: Rule, sourceZoneName: string, destZoneName: string): DetailSection[] {
  const sections: DetailSection[] = [];

  const dstPorts = resolveGrouped(rule.port_ranges, rule.destination_port_group, rule.destination_port_group_members);
  const dstIps = resolveGrouped(rule.ip_ranges, rule.destination_address_group, rule.destination_address_group_members);
  const matchRows: DetailRow[] = [
    { label: "Action", value: rule.action, type: "mono" },
    { label: "Protocol", value: rule.protocol || "any", type: "mono" },
    { label: "Source", value: sourceZoneName, type: "text" },
    { label: "Dst Ports", value: dstPorts.value, type: "mono", note: dstPorts.note },
    { label: "Dst IPs", value: dstIps.value, type: "mono", note: dstIps.note },
    { label: "Destination", value: destZoneName, type: "text" },
  ];

  const srcPorts = resolveGrouped(rule.source_port_ranges, rule.source_port_group, rule.source_port_group_members, "");
  if (srcPorts.value) matchRows.push({ label: "Src Ports", value: srcPorts.value, type: "mono", note: srcPorts.note });
  const srcIps = resolveGrouped(rule.source_ip_ranges, rule.source_address_group, rule.source_address_group_members, "");
  if (srcIps.value) matchRows.push({ label: "Src IPs", value: srcIps.value, type: "mono", note: srcIps.note });
  const optionalFilters: [string, string][] = [
    ["Src MACs", rule.source_mac_addresses.join(", ")],
    ["Dst MACs", rule.destination_mac_addresses.join(", ")],
  ];
  for (const [label, value] of optionalFilters) {
    if (value) matchRows.push({ label, value, type: "mono" });
  }
  sections.push({ title: "Match Criteria", rows: matchRows });

  const metaRows: DetailRow[] = [
    { label: "Status", value: rule.enabled ? "Enabled" : "Disabled", type: "status", active: rule.enabled },
    { label: "Logging", value: rule.connection_logging ? "Enabled" : "Disabled", type: "status", active: rule.connection_logging },
  ];
  if (rule.connection_state_type) metaRows.push({ label: "Conn State", value: rule.connection_state_type, type: "mono" });
  const schedule = formatSchedule(rule.schedule);
  if (schedule) metaRows.push({ label: "Schedule", value: schedule, type: "mono" });
  const ipSec = formatIpSec(rule.match_ip_sec);
  if (ipSec) metaRows.push({ label: "IPSec", value: ipSec, type: "mono" });
  if (rule.predefined) metaRows.push({ label: "Type", value: "Built-in (predefined)", type: "text" });
  metaRows.push({ label: "Index", value: String(rule.index), type: "mono" });
  sections.push({ title: "Metadata", rows: metaRows });

  return sections;
}

function DetailSectionView({ section }: { section: DetailSection }) {
  return (
    <div className="mt-2.5 first:mt-0">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-noc-text-dim whitespace-nowrap">
          {section.title}
        </span>
        <span className="flex-1 h-px bg-gray-200 dark:bg-noc-border" />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 items-baseline">
        {section.rows.map((row) => (
          <DetailRowView key={row.label} row={row} />
        ))}
      </dl>
    </div>
  );
}

function DetailRowView({ row }: { row: DetailRow }) {
  return (
    <>
      <dt className={LABEL_CLASS}>{row.label}</dt>
      {row.type === "status" ? (
        <dd className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${row.active ? "bg-status-success" : "bg-gray-300 dark:bg-noc-text-dim"}`} />
          <span className={`text-[11px] ${row.active ? "text-status-success" : "text-gray-400 dark:text-noc-text-dim"}`}>
            {row.value}
          </span>
        </dd>
      ) : row.type === "mono" ? (
        <dd>
          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-noc-raised text-gray-700 dark:text-noc-text inline-block">
            {row.value}
          </span>
          {row.note && (
            <span className="block text-[10px] text-gray-400 dark:text-noc-text-dim mt-0.5">
              {row.note}
            </span>
          )}
        </dd>
      ) : (
        <dd className="text-[11px] text-gray-700 dark:text-noc-text">{row.value}</dd>
      )}
    </>
  );
}

export default function RuleDetails({ rule, sourceZoneName, destZoneName }: { rule: Rule; sourceZoneName: string; destZoneName: string }) {
  const sections = buildDetailSections(rule, sourceZoneName, destZoneName);
  return (
    <div className="mt-2.5 pt-2 border-t border-gray-200/60 dark:border-noc-border/60 animate-fade-in">
      {rule.description && (
        <p className="mb-2 pl-2.5 border-l-2 border-gray-300 dark:border-noc-text-dim text-[11px] text-gray-500 dark:text-noc-text-secondary italic">
          {rule.description}
        </p>
      )}
      {sections.map((section) => (
        <DetailSectionView key={section.title} section={section} />
      ))}
      <div className="mt-2.5 pt-1.5 border-t border-gray-200/40 dark:border-noc-border/40 font-mono text-[10px] text-gray-400 dark:text-noc-text-dim select-all">
        ID: {rule.id}
      </div>
    </div>
  );
}
