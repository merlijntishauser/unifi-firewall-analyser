import { useNavigate } from "react-router-dom";
import { useAppContext } from "../hooks/useAppContext";
import { useHealthSummary, useHealthAnalysis } from "../hooks/queries";
import type {
  FirewallSummary,
  HealthAnalysisResult,
  HealthFinding,
  HealthSummaryResponse,
  MetricsSummary,
  TopologySummary,
} from "../api/types";

type CardStatus = "healthy" | "warning" | "danger";

function getFirewallStatus(fw: FirewallSummary): CardStatus {
  if (fw.grade_distribution["F"]) return "danger";
  if (fw.grade_distribution["D"] || fw.grade_distribution["C"]) return "warning";
  return "healthy";
}

function getTopologyStatus(topo: TopologySummary): CardStatus {
  if (topo.offline_count > 0) return "danger";
  if (topo.firmware_mismatches > 0) return "warning";
  return "healthy";
}

function getMetricsStatus(met: MetricsSummary): CardStatus {
  const sev = met.active_notifications_by_severity;
  if (sev["critical"] || sev["high"] || met.high_resource_devices > 0) return "danger";
  if (sev["warning"] || sev["medium"] || met.recent_reboots > 0) return "warning";
  return "healthy";
}

const statusBorder: Record<CardStatus, string> = {
  healthy: "border-status-success",
  warning: "border-status-warning",
  danger: "border-status-danger",
};

function formatEntries(obj: Record<string, number>): string {
  const entries = Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return "None";
  return entries.map(([k, v]) => `${v} ${k}`).join(", ");
}

interface StatLineProps {
  label: string;
  value: string | number;
}

function StatLine({ label, value }: StatLineProps) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500 dark:text-noc-text-secondary">{label}</span>
      <span className="font-medium text-gray-900 dark:text-noc-text">{value}</span>
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  status: CardStatus;
  onClick: () => void;
  children: React.ReactNode;
}

function SummaryCard({ title, status, onClick, children }: SummaryCardProps) {
  return (
    <button
      onClick={onClick}
      className={`border-l-4 ${statusBorder[status]} bg-white dark:bg-noc-surface rounded-lg p-4 text-left hover:bg-gray-50 dark:hover:bg-noc-raised transition-colors cursor-pointer w-full`}
    >
      <h3 className="text-sm font-display font-semibold text-gray-700 dark:text-noc-text-secondary mb-3">
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </button>
  );
}

function SummaryCards({ summary }: { summary: HealthSummaryResponse }) {
  const navigate = useNavigate();
  const { firewall, topology, metrics } = summary;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <SummaryCard
        title="Firewall"
        status={getFirewallStatus(firewall)}
        onClick={() => navigate("/firewall")}
      >
        <StatLine label="Zone pairs" value={firewall.zone_pair_count} />
        <StatLine label="Grades" value={formatEntries(firewall.grade_distribution)} />
        <StatLine label="Findings" value={formatEntries(firewall.finding_count_by_severity)} />
        <StatLine label="Uncovered pairs" value={firewall.uncovered_pairs} />
      </SummaryCard>

      <SummaryCard
        title="Topology"
        status={getTopologyStatus(topology)}
        onClick={() => navigate("/topology")}
      >
        <StatLine label="Devices" value={formatEntries(topology.device_count_by_type)} />
        <StatLine label="Offline" value={topology.offline_count || "None"} />
        <StatLine label="Firmware mismatches" value={topology.firmware_mismatches || "None"} />
      </SummaryCard>

      <SummaryCard
        title="Metrics"
        status={getMetricsStatus(metrics)}
        onClick={() => navigate("/metrics")}
      >
        <StatLine label="Notifications" value={formatEntries(metrics.active_notifications_by_severity)} />
        <StatLine label="High resource" value={metrics.high_resource_devices || "None"} />
        <StatLine label="Recent reboots" value={metrics.recent_reboots || "None"} />
      </SummaryCard>
    </div>
  );
}

const severityOrder = ["critical", "high", "medium", "low"] as const;

const severityDot: Record<string, string> = {
  critical: "bg-status-danger",
  high: "bg-status-danger",
  medium: "bg-status-warning",
  low: "bg-status-success",
};

const severityLabel: Record<string, string> = {
  critical: "text-status-danger",
  high: "text-status-danger",
  medium: "text-status-warning",
  low: "text-status-success",
};

const moduleBadge: Record<string, string> = {
  firewall: "bg-ub-blue-dim text-ub-blue-light",
  topology: "bg-purple-500/10 text-ub-purple-light",
  metrics: "bg-status-warning-dim text-status-warning",
};

function FindingCard({ finding, onNavigate }: { finding: HealthFinding; onNavigate: (module: string, entityId: string) => void }) {
  return (
    <button
      onClick={() => onNavigate(finding.affected_module, finding.affected_entity_id)}
      className="w-full text-left bg-white dark:bg-noc-surface rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-noc-raised transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-2 h-2 rounded-full shrink-0 ${severityDot[finding.severity] ?? "bg-gray-400"}`} />
        <span className="font-semibold text-sm text-gray-900 dark:text-noc-text">{finding.title}</span>
        {finding.affected_module && (
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${moduleBadge[finding.affected_module] ?? "bg-gray-100 dark:bg-noc-raised text-gray-500 dark:text-noc-text-dim"}`}>
            {finding.affected_module}
          </span>
        )}
        {finding.confidence && (
          <span className="text-xs text-gray-400 dark:text-noc-text-dim ml-auto">
            {finding.confidence} confidence
          </span>
        )}
      </div>
      <p className="text-sm text-gray-600 dark:text-noc-text-secondary ml-4">{finding.description}</p>
      {finding.recommended_action && (
        <p className="text-xs text-gray-400 dark:text-noc-text-dim mt-2 ml-4">
          {finding.recommended_action}
        </p>
      )}
    </button>
  );
}

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function FindingsList({ findings, onNavigate }: { findings: HealthFinding[]; onNavigate: (module: string, entityId: string) => void }) {
  return (
    <div className="space-y-4">
      {severityOrder.map((sev) => {
        const group = findings.filter((f) => f.severity === sev);
        if (group.length === 0) return null;
        return (
          <div key={sev} className="space-y-2">
            <h3 className={`text-xs font-semibold uppercase tracking-wide ${severityLabel[sev] ?? "text-gray-500"}`}>
              {sev} ({group.length})
            </h3>
            {group.map((finding) => (
              <FindingCard key={`${finding.severity}-${finding.title}`} finding={finding} onNavigate={onNavigate} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function AnalysisResults({ analysis, onNavigate }: { analysis: HealthAnalysisResult; onNavigate: (module: string, entityId: string) => void }) {
  if (analysis.status === "error") {
    return (
      <div className="bg-status-danger-dim rounded-lg p-4">
        <p className="text-sm text-status-danger">{analysis.message ?? "Analysis failed"}</p>
      </div>
    );
  }

  if (analysis.findings.length === 0) {
    return (
      <div className="bg-status-success-dim rounded-lg p-4">
        <p className="text-sm text-status-success">No cross-domain issues found.</p>
      </div>
    );
  }

  return <FindingsList findings={analysis.findings} onNavigate={onNavigate} />;
}

interface AnalysisSectionProps {
  aiConfigured: boolean;
  analysis: HealthAnalysisResult | undefined;
  isPending: boolean;
  onAnalyze: () => void;
  onNavigate: (module: string, entityId: string) => void;
}

function AnalysisSection({ aiConfigured, analysis, isPending, onAnalyze, onNavigate }: AnalysisSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-display font-semibold text-gray-800 dark:text-noc-text">
          AI Cross-Domain Analysis
        </h2>
        {analysis?.analyzed_at && (
          <span className="text-xs text-gray-400 dark:text-noc-text-dim">
            Last analyzed: {formatTimeAgo(analysis.analyzed_at)}
          </span>
        )}
      </div>

      {!aiConfigured && !analysis && (
        <p className="text-sm text-gray-500 dark:text-noc-text-secondary">
          Configure an AI provider in Settings to enable cross-domain analysis.
        </p>
      )}

      {aiConfigured && (
        <button
          onClick={onAnalyze}
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-ub-blue text-white hover:bg-ub-blue-light disabled:opacity-50 transition-colors"
        >
          {isPending ? "Analyzing..." : analysis ? "Re-analyze" : "Analyze Site Health"}
        </button>
      )}

      {isPending && (
        <div className="flex items-center gap-3 py-4">
          <div className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-noc-border border-t-ub-blue animate-spin" />
          <p className="text-sm text-gray-500 dark:text-noc-text-secondary">
            Running cross-domain analysis...
          </p>
        </div>
      )}

      {analysis && <AnalysisResults analysis={analysis} onNavigate={onNavigate} />}
    </div>
  );
}

function SummarySection({ summary, isLoading, error }: { summary: HealthSummaryResponse | undefined; isLoading: boolean; error: Error | null }) {
  if (isLoading && !summary) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 rounded-full border-2 border-gray-300 dark:border-noc-border border-t-ub-blue animate-spin" />
        <p className="text-sm text-gray-500 dark:text-noc-text-secondary ml-3">Loading summary...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-status-danger">
          {error instanceof Error ? error.message : "Failed to load summary"}
        </p>
      </div>
    );
  }

  if (summary) {
    return <SummaryCards summary={summary} />;
  }

  return null;
}

export default function HealthModule() {
  const { connectionInfo, aiConfigured } = useAppContext();
  const authed = connectionInfo !== null;
  const navigate = useNavigate();

  const summaryQuery = useHealthSummary(authed);
  const analyzeMutation = useHealthAnalysis();

  const handleNavigate = (module: string, entityId: string) => {
    if (!["firewall", "topology", "metrics"].includes(module)) return;
    if (!entityId) {
      navigate(`/${module}`);
      return;
    }
    if (module === "firewall") {
      navigate(`/${module}?pair=${encodeURIComponent(entityId)}`);
    } else {
      navigate(`/${module}?device=${encodeURIComponent(entityId)}`);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-noc-border bg-white dark:bg-noc-surface shrink-0">
        <span className="text-sm text-gray-500 dark:text-noc-text-dim">Auto-refreshes every 60s</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <SummarySection
          summary={summaryQuery.data}
          isLoading={summaryQuery.isLoading}
          error={summaryQuery.error}
        />

        <AnalysisSection
          aiConfigured={aiConfigured}
          analysis={analyzeMutation.data}
          isPending={analyzeMutation.isPending}
          onAnalyze={() => analyzeMutation.mutate()}
          onNavigate={handleNavigate}
        />
      </div>
    </div>
  );
}
