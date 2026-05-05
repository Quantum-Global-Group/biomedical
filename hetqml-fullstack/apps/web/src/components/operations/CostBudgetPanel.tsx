"use client";

import type { OpsCostResponse } from "@/lib/api/client";
import { formatUsd } from "@/lib/operations/format";

interface Props {
  cost: OpsCostResponse;
}

/** Per-service spend bars + summary card MTD vs budget vs linear pace. */
export function CostBudgetPanel({ cost }: Props) {
  const max = cost.buckets.reduce((m, b) => Math.max(m, b.spendUsd), 0);
  const totalShare = Math.max(0.01, cost.mtdSpend);

  let paceLabel = "on pace";
  let paceClass: "amber" | "sienna" | "" = "";
  if (cost.mtdSpend > cost.linearPace * 1.1) {
    paceLabel = "ahead of pace";
    paceClass = "amber";
  } else if (cost.mtdSpend > cost.linearPace * 1.25) {
    paceLabel = "over budget pace";
    paceClass = "sienna";
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · COST &amp; BUDGET</div>
          <div className="panel-title">Month-to-date spend by service</div>
        </div>
        <span className="badge">Finance</span>
      </div>
      <p className="panel-purpose">
        Spend broken out by upstream service. Budget tracked against linear
        monthly target.
      </p>
      <div>
        {cost.buckets.map((b) => {
          const widthPct = max > 0 ? (b.spendUsd / max) * 100 : 0;
          const sharePct = (b.spendUsd / totalShare) * 100;
          return (
            <div key={b.service} className="ops-cost-row">
              <span className="ops-cost-svc">
                {b.service}
                <span className="sub">{b.pace}</span>
              </span>
              <div className="ops-cost-bar">
                <div
                  className="ops-cost-fill"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <span className="ops-cost-amt">{formatUsd(b.spendUsd)}</span>
              <span className="ops-cost-pct">{sharePct.toFixed(0)}%</span>
            </div>
          );
        })}

        <div className="ops-cost-summary">
          <div>
            <div className="ops-cost-summary-num">
              {formatUsd(cost.mtdSpend)}
            </div>
            <div className="ops-cost-summary-l">spent · MTD</div>
          </div>
          <div>
            <div className="ops-cost-summary-num">
              {formatUsd(cost.monthlyBudget)}
            </div>
            <div className="ops-cost-summary-l">monthly budget</div>
          </div>
          <div>
            <div className={`ops-cost-summary-num ${paceClass}`}>
              {paceLabel}
            </div>
            <div className="ops-cost-summary-l">vs linear pace</div>
          </div>
        </div>
      </div>
      <div className="panel-footer">
        <span>billing/mtd.json</span>
        <span>
          <em>
            {cost.buckets.length} services tracked ·{" "}
            {formatUsd(cost.mtdSpend)} of {formatUsd(cost.monthlyBudget)}
          </em>
        </span>
      </div>
    </section>
  );
}
