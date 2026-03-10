export type HealthStatus = "unknown" | "healthy" | "unhealthy" | "unreachable";

export interface Service {
  id: string;
  name: string;
  port: number;
  host: string;
  health_path: string;
  check_interval_seconds: number;
  description: string | null;
  tags: string[] | null;
  status: HealthStatus;
  last_checked_at: string | null;
  last_healthy_at: string | null;
  consecutive_failures: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceRegister {
  name: string;
  port: number;
  host?: string;
  health_path?: string;
  check_interval_seconds?: number;
  description?: string;
  tags?: string[];
}
