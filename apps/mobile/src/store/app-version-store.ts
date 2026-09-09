import { create } from "zustand";

interface AppVersionState {
  isUpdateRequired: boolean;
  minVersion: string | null;
  setUpdateRequired: (params: {
    required: boolean;
    minVersion?: string | null;
  }) => void;
  dismiss: () => void;
}

export const useAppVersionStore = create<AppVersionState>((set) => ({
  isUpdateRequired: false,
  minVersion: null,
  setUpdateRequired: ({ required, minVersion = null }) =>
    set({ isUpdateRequired: required, minVersion }),
  dismiss: () => set({ isUpdateRequired: false, minVersion: null }),
}));
