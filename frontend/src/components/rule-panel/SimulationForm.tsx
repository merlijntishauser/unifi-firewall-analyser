import type { FormEvent } from "react";
import type { SimFormState } from "./utils";

export default function SimulationForm({
  form,
  onFormChange,
  onSubmit,
  isLoading,
  inputClass,
}: {
  form: SimFormState;
  onFormChange: (update: Partial<SimFormState>) => void;
  onSubmit: (e: FormEvent) => void;
  isLoading: boolean;
  inputClass: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <h3 className="text-[10px] font-semibold text-gray-400 dark:text-noc-text-dim uppercase tracking-widest">
        Packet Simulation
      </h3>
      <input
        type="text"
        placeholder="Source IP"
        value={form.srcIp}
        onChange={(e) => onFormChange({ srcIp: e.target.value })}
        required
        className={inputClass}
      />
      <input
        type="text"
        placeholder="Destination IP"
        value={form.dstIp}
        onChange={(e) => onFormChange({ dstIp: e.target.value })}
        required
        className={inputClass}
      />
      <div className="flex gap-2">
        <select
          value={form.protocol}
          onChange={(e) => onFormChange({ protocol: e.target.value })}
          className={inputClass}
        >
          <option value="TCP">TCP</option>
          <option value="UDP">UDP</option>
          <option value="ICMP">ICMP</option>
          <option value="Any">Any</option>
        </select>
        <input
          type="number"
          placeholder="Port"
          value={form.port}
          onChange={(e) => onFormChange({ port: e.target.value })}
          min={1}
          max={65535}
          className={inputClass}
        />
        <input
          type="number"
          placeholder="Src Port"
          value={form.sourcePort}
          onChange={(e) => onFormChange({ sourcePort: e.target.value })}
          min={1}
          max={65535}
          className={inputClass}
        />
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-lg bg-ub-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-ub-blue-light focus:outline-none focus:ring-2 focus:ring-ub-blue/40 focus:ring-offset-1 dark:focus:ring-offset-noc-surface disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
      >
        {isLoading ? "Simulating..." : "Simulate"}
      </button>
    </form>
  );
}
