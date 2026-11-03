import { useToastStore, type ToastType } from '../store/toast-store';

export const useToast = () => {
  const showToast = useToastStore((state) => state.showToast);
  return {
    show: (message: string, type: ToastType = 'info', title?: string) => {
      showToast(message, type, title);
    },
  };
};
