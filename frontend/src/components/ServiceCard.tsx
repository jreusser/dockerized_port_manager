import React from "react";
import { Card } from "primereact/card";
import { Badge } from "primereact/badge";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { Tooltip } from "primereact/tooltip";
import type { Service, HealthStatus } from "../types";

interface Props {
  service: Service;
  onDeregister: (id: string) => void;
}

const statusSeverity: Record<HealthStatus, "success" | "warning" | "danger" | "info"> = {
  healthy: "success",
  unhealthy: "danger",
  unreachable: "warning",
  unknown: "info",
};

const statusIcon: Record<HealthStatus, string> = {
  healthy: "pi-check-circle",
  unhealthy: "pi-times-circle",
  unreachable: "pi-exclamation-triangle",
  unknown: "pi-question-circle",
};

function formatRelative(isoString: string | null): string {
  if (!isoString) return "—";
  const diff = Date.now() - new Date(isoString).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const ServiceCard: React.FC<Props> = ({ service, onDeregister }) => {
  const severity = statusSeverity[service.status];
  const icon = statusIcon[service.status];

  const header = (
    <div
      style={{
        padding: "1rem 1.25rem 0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>{service.name}</span>
      <Badge
        value={service.status}
        severity={severity}
        style={{ textTransform: "capitalize" }}
      />
    </div>
  );

  return (
    <Card header={header} style={{ height: "100%" }}>
      <div className="flex flex-column gap-2">
        {/* Port + host */}
        <div className="flex align-items-center gap-2">
          <i className="pi pi-server text-400" />
          <span style={{ fontFamily: "monospace", fontSize: "0.95rem" }}>
            {service.host}:{service.port}
          </span>
          <span className="text-400 text-sm">→ {service.health_path}</span>
        </div>

        {/* Status row */}
        <div className="flex align-items-center gap-2">
          <i className={`pi ${icon}`} style={{ color: `var(--${severity === "info" ? "blue" : severity === "success" ? "green" : severity === "danger" ? "red" : "orange"}-500)` }} />
          <span className="text-sm text-600">
            Last checked {formatRelative(service.last_checked_at)}
          </span>
          {service.consecutive_failures > 0 && (
            <span className="text-sm" style={{ color: "var(--red-500)" }}>
              ({service.consecutive_failures} failure{service.consecutive_failures !== 1 ? "s" : ""})
            </span>
          )}
        </div>

        {/* Interval */}
        <div className="flex align-items-center gap-2">
          <i className="pi pi-clock text-400" />
          <span className="text-sm text-600">
            Poll every {service.check_interval_seconds}s
          </span>
        </div>

        {/* Description */}
        {service.description && (
          <p className="text-sm text-600 m-0">{service.description}</p>
        )}

        {/* Tags */}
        {service.tags && service.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {service.tags.map((tag) => (
              <Tag key={tag} value={tag} rounded severity="secondary" />
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-content-end mt-2">
          <Button
            icon="pi pi-trash"
            label="Deregister"
            severity="danger"
            size="small"
            outlined
            onClick={() => onDeregister(service.id)}
          />
        </div>
      </div>
    </Card>
  );
};
