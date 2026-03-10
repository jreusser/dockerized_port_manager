import React, { useState } from "react";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { InputNumber } from "primereact/inputnumber";
import { Chips } from "primereact/chips";
import { api } from "../api/services";
import type { ServiceRegister } from "../types";

interface Props {
  visible: boolean;
  onHide: () => void;
  onRegistered: () => void;
}

const defaultForm: ServiceRegister = {
  name: "",
  port: 8080,
  host: "localhost",
  health_path: "/health",
  check_interval_seconds: 30,
  description: "",
  tags: [],
};

export const RegisterDialog: React.FC<Props> = ({ visible, onHide, onRegistered }) => {
  const [form, setForm] = useState<ServiceRegister>(defaultForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ServiceRegister>(key: K, val: ServiceRegister[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.registerService({
        ...form,
        description: form.description || undefined,
        tags: form.tags?.length ? form.tags : undefined,
      });
      setForm(defaultForm);
      onRegistered();
      onHide();
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.message ?? "Registration failed";
      setError(typeof detail === "string" ? detail : JSON.stringify(detail));
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <div className="flex justify-content-end gap-2">
      <Button label="Cancel" severity="secondary" outlined onClick={onHide} />
      <Button
        label="Register"
        icon="pi pi-check"
        loading={loading}
        onClick={handleSubmit}
        disabled={!form.name || !form.port}
      />
    </div>
  );

  return (
    <Dialog
      header="Register Service"
      visible={visible}
      style={{ width: "min(520px, 95vw)" }}
      onHide={onHide}
      footer={footer}
    >
      <div className="flex flex-column gap-3 pt-2">
        {error && (
          <div
            style={{
              background: "var(--red-50)",
              border: "1px solid var(--red-300)",
              borderRadius: 4,
              padding: "0.5rem 0.75rem",
              color: "var(--red-700)",
              fontSize: "0.9rem",
            }}
          >
            {error}
          </div>
        )}

        <div className="flex flex-column gap-1">
          <label htmlFor="svc-name" className="font-semibold text-sm">
            Name *
          </label>
          <InputText
            id="svc-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="my-api"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex flex-column gap-1 flex-1">
            <label htmlFor="svc-host" className="font-semibold text-sm">
              Host
            </label>
            <InputText
              id="svc-host"
              value={form.host}
              onChange={(e) => set("host", e.target.value)}
            />
          </div>
          <div className="flex flex-column gap-1" style={{ width: 120 }}>
            <label htmlFor="svc-port" className="font-semibold text-sm">
              Port *
            </label>
            <InputNumber
              id="svc-port"
              value={form.port}
              onValueChange={(e) => set("port", e.value ?? 80)}
              min={1}
              max={65535}
              useGrouping={false}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex flex-column gap-1 flex-1">
            <label htmlFor="svc-path" className="font-semibold text-sm">
              Health Path
            </label>
            <InputText
              id="svc-path"
              value={form.health_path}
              onChange={(e) => set("health_path", e.target.value)}
            />
          </div>
          <div className="flex flex-column gap-1" style={{ width: 140 }}>
            <label htmlFor="svc-interval" className="font-semibold text-sm">
              Interval (s)
            </label>
            <InputNumber
              id="svc-interval"
              value={form.check_interval_seconds}
              onValueChange={(e) => set("check_interval_seconds", e.value ?? 30)}
              min={5}
              max={86400}
              useGrouping={false}
            />
          </div>
        </div>

        <div className="flex flex-column gap-1">
          <label htmlFor="svc-desc" className="font-semibold text-sm">
            Description
          </label>
          <InputText
            id="svc-desc"
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Optional description"
          />
        </div>

        <div className="flex flex-column gap-1">
          <label className="font-semibold text-sm">Tags</label>
          <Chips
            value={form.tags ?? []}
            onChange={(e) => set("tags", e.value ?? [])}
            placeholder="Add tag then Enter"
          />
        </div>
      </div>
    </Dialog>
  );
};
