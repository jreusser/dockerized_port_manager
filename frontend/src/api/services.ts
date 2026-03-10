import axios from "axios";
import type { Service, ServiceRegister } from "../types";

const BASE = "/api/v1";

export const api = {
  listServices: (activeOnly = true): Promise<Service[]> =>
    axios
      .get<Service[]>(`${BASE}/services`, { params: { active_only: activeOnly } })
      .then((r) => r.data),

  getService: (id: string): Promise<Service> =>
    axios.get<Service>(`${BASE}/services/${id}`).then((r) => r.data),

  registerService: (payload: ServiceRegister): Promise<Service> =>
    axios.post<Service>(`${BASE}/services`, payload).then((r) => r.data),

  deregisterService: (id: string): Promise<void> =>
    axios.delete(`${BASE}/services/${id}`).then(() => undefined),
};
