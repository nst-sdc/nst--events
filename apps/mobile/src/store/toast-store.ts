import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastData {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
}

interface ToastStoreState {
  activeToast: ToastData | null;
  showToast: (message: string, type?: ToastType, title?: string) => void;
  hideToast: () => void;
}

export const useToastStore = create<ToastStoreState>((set) => ({
  activeToast: null,
  showToast: (message: string, type: ToastType = 'info', title?: string) => {
    set({
      activeToast: {
        id: Math.random().toString(36).substring(2, 9),
        message,
        type,
        title,
      },
    });
  },
  hideToast: () => set({ activeToast: null }),
}));

