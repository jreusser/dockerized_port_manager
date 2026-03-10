import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../api/services";
import type { Service } from "../types";

interface ServicesState {
  items: Service[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
}

const initialState: ServicesState = {
  items: [],
  loading: false,
  error: null,
  lastFetched: null,
};

export const fetchServices = createAsyncThunk("services/fetchAll", () =>
  api.listServices(true)
);

export const deregisterService = createAsyncThunk(
  "services/deregister",
  async (id: string) => {
    await api.deregisterService(id);
    return id;
  }
);

const servicesSlice = createSlice({
  name: "services",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchServices.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchServices.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
        state.lastFetched = Date.now();
      })
      .addCase(fetchServices.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? "Failed to fetch services";
      })
      .addCase(deregisterService.fulfilled, (state, action) => {
        state.items = state.items.filter((s) => s.id !== action.payload);
      });
  },
});

export default servicesSlice.reducer;
