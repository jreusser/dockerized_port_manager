import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "primereact/button";
import { ProgressBar } from "primereact/progressbar";
import { InputText } from "primereact/inputtext";
import { SelectButton } from "primereact/selectbutton";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { Toast } from "primereact/toast";
import { ServiceCard } from "./ServiceCard";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { deregisterService, fetchServices } from "../store/servicesSlice";
import { api } from "../api/services";
import type { HealthStatus } from "../types";

const POLL_INTERVAL_MS = 10_000;

const statusOptions = [
  { label: "All", value: "all" },
  { label: "Healthy", value: "healthy" },
  { label: "Unhealthy", value: "unhealthy" },
  { label: "Unreachable", value: "unreachable" },
  { label: "Unknown", value: "unknown" },
];

export const ServiceList: React.FC = () => {
  const dispatch = useAppDispatch();
  const { items, loading, error } = useAppSelector((s) => s.services);
  const toast = useRef<Toast>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [checkingAll, setCheckingAll] = useState(false);

  const handleCheckAll = async () => {
    setCheckingAll(true);
    try {
      const { checked } = await api.checkAllNow();
      await dispatch(fetchServices());
      toast.current?.show({
        severity: "info",
        summary: "Check complete",
        detail: `Checked ${checked} service${checked !== 1 ? "s" : ""}`,
        life: 3000,
      });
    } catch {
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "Health check failed",
        life: 4000,
      });
    } finally {
      setCheckingAll(false);
    }
  };

  const refresh = useCallback(() => {
    dispatch(fetchServices());
  }, [dispatch]);

  // Initial load + polling
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const handleDeregister = (id: string) => {
    const svc = items.find((s) => s.id === id);
    confirmDialog({
      message: `Deregister "${svc?.name ?? id}"? Health polling will stop.`,
      header: "Confirm Deregister",
      icon: "pi pi-exclamation-triangle",
      acceptClassName: "p-button-danger",
      accept: async () => {
        try {
          await dispatch(deregisterService(id)).unwrap();
          toast.current?.show({
            severity: "success",
            summary: "Deregistered",
            detail: `${svc?.name} removed`,
            life: 3000,
          });
        } catch {
          toast.current?.show({
            severity: "error",
            summary: "Error",
            detail: "Failed to deregister service",
            life: 4000,
          });
        }
      },
    });
  };

  const filtered = items.filter((s) => {
    const matchesQuery =
      query === "" ||
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      String(s.port).includes(query) ||
      (s.tags ?? []).some((t) => t.toLowerCase().includes(query.toLowerCase()));
    const matchesStatus = statusFilter === "all" || s.status === (statusFilter as HealthStatus);
    return matchesQuery && matchesStatus;
  });

  const counts = {
    healthy: items.filter((s) => s.status === "healthy").length,
    unhealthy: items.filter((s) => s.status === "unhealthy").length,
    unreachable: items.filter((s) => s.status === "unreachable").length,
    unknown: items.filter((s) => s.status === "unknown").length,
  };

  return (
    <>
      <Toast ref={toast} />
      <ConfirmDialog />

      {/* Summary bar */}
      <div
        className="flex gap-3 flex-wrap mb-3"
        style={{ fontSize: "0.85rem", color: "var(--text-color-secondary)" }}
      >
        <span>
          <span style={{ color: "var(--green-500)", fontWeight: 700 }}>{counts.healthy}</span>{" "}
          healthy
        </span>
        <span>
          <span style={{ color: "var(--red-500)", fontWeight: 700 }}>{counts.unhealthy}</span>{" "}
          unhealthy
        </span>
        <span>
          <span style={{ color: "var(--orange-500)", fontWeight: 700 }}>{counts.unreachable}</span>{" "}
          unreachable
        </span>
        <span>
          <span style={{ color: "var(--blue-500)", fontWeight: 700 }}>{counts.unknown}</span>{" "}
          unknown
        </span>
        <span className="ml-auto">
          {items.length} service{items.length !== 1 ? "s" : ""} registered
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap align-items-center mb-4">
        <span className="p-input-icon-left flex-1" style={{ minWidth: 200 }}>
          <i className="pi pi-search" />
          <InputText
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, port, or tag…"
            style={{ width: "100%" }}
          />
        </span>
        <SelectButton
          value={statusFilter}
          options={statusOptions}
          onChange={(e) => setStatusFilter(e.value ?? "all")}
          style={{ fontSize: "0.85rem" }}
        />
        <Button
          icon={checkingAll ? "pi pi-spin pi-spinner" : "pi pi-bolt"}
          label="Check all now"
          size="small"
          severity="secondary"
          outlined
          disabled={checkingAll}
          onClick={handleCheckAll}
        />
      </div>

      {loading && items.length === 0 && (
        <ProgressBar mode="indeterminate" style={{ height: 4 }} />
      )}

      {error && (
        <div
          style={{
            padding: "1rem",
            background: "var(--red-50)",
            borderRadius: 6,
            color: "var(--red-700)",
            marginBottom: "1rem",
          }}
        >
          <i className="pi pi-exclamation-triangle mr-2" />
          {error}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div
          className="flex flex-column align-items-center justify-content-center"
          style={{ minHeight: 240, color: "var(--text-color-secondary)" }}
        >
          <i className="pi pi-inbox" style={{ fontSize: "3rem", marginBottom: "1rem" }} />
          <p>
            {items.length === 0
              ? "No services registered yet. Register one to start monitoring."
              : "No services match your filter."}
          </p>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "1rem",
        }}
      >
        {filtered.map((svc) => (
          <ServiceCard key={svc.id} service={svc} onDeregister={handleDeregister} />
        ))}
      </div>
    </>
  );
};
