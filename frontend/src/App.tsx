import React, { useState } from "react";
import { Button } from "primereact/button";
import { ServiceList } from "./components/ServiceList";
import { RegisterDialog } from "./components/RegisterDialog";
import { useAppDispatch } from "./store/hooks";
import { fetchServices } from "./store/servicesSlice";

export const App: React.FC = () => {
  const [showRegister, setShowRegister] = useState(false);
  const dispatch = useAppDispatch();

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-ground)" }}>
      {/* Header */}
      <header
        style={{
          background: "var(--surface-card)",
          borderBottom: "1px solid var(--surface-border)",
          padding: "0.75rem 1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <span style={{ fontSize: "1.3rem" }}>🔌</span>
        <span style={{ fontWeight: 700, fontSize: "1.15rem", letterSpacing: "-0.01em" }}>
          Port Manager
        </span>
        <span
          style={{
            fontSize: "0.75rem",
            background: "var(--primary-100)",
            color: "var(--primary-700)",
            padding: "0.15rem 0.5rem",
            borderRadius: 999,
          }}
        >
          service registry
        </span>
        <div style={{ marginLeft: "auto" }}>
          <Button
            label="Register Service"
            icon="pi pi-plus"
            size="small"
            onClick={() => setShowRegister(true)}
          />
        </div>
      </header>

      {/* Main content */}
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "1.5rem" }}>
        <ServiceList />
      </main>

      <RegisterDialog
        visible={showRegister}
        onHide={() => setShowRegister(false)}
        onRegistered={() => dispatch(fetchServices())}
      />
    </div>
  );
};
