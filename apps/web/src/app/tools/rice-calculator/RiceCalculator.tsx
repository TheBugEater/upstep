"use client";

import { useId, useState } from "react";

type Row = {
  id: string;
  name: string;
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
};

const IMPACT_OPTIONS = [
  { value: 3, label: "Massive (3)" },
  { value: 2, label: "High (2)" },
  { value: 1, label: "Medium (1)" },
  { value: 0.5, label: "Low (0.5)" },
  { value: 0.25, label: "Minimal (0.25)" },
];

const CONFIDENCE_OPTIONS = [
  { value: 100, label: "High (100%)" },
  { value: 80, label: "Medium (80%)" },
  { value: 50, label: "Low (50%)" },
];

let rowCounter = 0;
function newRow(): Row {
  rowCounter += 1;
  return { id: `row-${rowCounter}`, name: "", reach: 1000, impact: 1, confidence: 80, effort: 1 };
}

function score(row: Row): number {
  if (!row.effort) return 0;
  return (row.reach * row.impact * (row.confidence / 100)) / row.effort;
}

export function RiceCalculator() {
  const [rows, setRows] = useState<Row[]>(() => [newRow(), newRow()]);

  function update(id: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((rs) => [...rs, newRow()]);
  }

  function removeRow(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  const sorted = [...rows].sort((a, b) => score(b) - score(a));

  return (
    <div className="rounded-2xl border border-line bg-card shadow-soft overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-line text-left text-xs font-semibold text-faint uppercase tracking-wide">
              <th className="px-4 py-3 min-w-[180px]">Feature</th>
              <th className="px-4 py-3">Reach</th>
              <th className="px-4 py-3">Impact</th>
              <th className="px-4 py-3">Confidence</th>
              <th className="px-4 py-3">Effort</th>
              <th className="px-4 py-3 text-right">Score</th>
              <th className="px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <RiceRow
                key={row.id}
                row={row}
                rank={i + 1}
                onChange={(patch) => update(row.id, patch)}
                onRemove={() => removeRow(row.id)}
                removable={rows.length > 1}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t border-line">
        <button
          onClick={addRow}
          className="text-sm font-medium text-clay hover:text-clay-hover transition inline-flex items-center gap-1.5"
        >
          + Add feature
        </button>
      </div>
    </div>
  );
}

function RiceRow({
  row,
  rank,
  onChange,
  onRemove,
  removable,
}: {
  row: Row;
  rank: number;
  onChange: (patch: Partial<Row>) => void;
  onRemove: () => void;
  removable: boolean;
}) {
  const id = useId();
  const s = score(row);

  return (
    <tr className="border-b border-line last:border-0 hover:bg-surface/50 transition">
      <td className="px-4 py-2.5">
        <input
          aria-label="Feature name"
          value={row.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={`Feature ${rank}`}
          className="w-full bg-transparent text-ink placeholder:text-faint focus:outline-none border-b border-transparent focus:border-clay/40 py-1"
        />
      </td>
      <td className="px-4 py-2.5">
        <input
          aria-label="Reach"
          type="number"
          min={0}
          value={row.reach}
          onChange={(e) => onChange({ reach: Number(e.target.value) })}
          className="w-24 bg-surface border border-line rounded-lg px-2.5 py-1.5 text-ink focus:outline-none focus:border-clay/50"
        />
      </td>
      <td className="px-4 py-2.5">
        <select
          aria-label="Impact"
          value={row.impact}
          onChange={(e) => onChange({ impact: Number(e.target.value) })}
          className="bg-surface border border-line rounded-lg px-2.5 py-1.5 text-ink focus:outline-none focus:border-clay/50"
        >
          {IMPACT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2.5">
        <select
          aria-label="Confidence"
          value={row.confidence}
          onChange={(e) => onChange({ confidence: Number(e.target.value) })}
          className="bg-surface border border-line rounded-lg px-2.5 py-1.5 text-ink focus:outline-none focus:border-clay/50"
        >
          {CONFIDENCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2.5">
        <input
          aria-label="Effort"
          type="number"
          min={0.1}
          step={0.1}
          value={row.effort}
          onChange={(e) => onChange({ effort: Number(e.target.value) })}
          className="w-20 bg-surface border border-line rounded-lg px-2.5 py-1.5 text-ink focus:outline-none focus:border-clay/50"
        />
      </td>
      <td className="px-4 py-2.5 text-right">
        <span className="font-mono font-semibold text-ink" id={id}>
          {s >= 100 ? Math.round(s).toLocaleString() : s.toFixed(1)}
        </span>
      </td>
      <td className="px-2 py-2.5 text-right">
        {removable && (
          <button
            onClick={onRemove}
            aria-label="Remove feature"
            className="text-faint hover:text-danger transition px-1.5"
          >
            ✕
          </button>
        )}
      </td>
    </tr>
  );
}
