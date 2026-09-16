const store = new Map<string, string>();

export const getItemAsync = async (key: string) => store.get(key) ?? null;
export const setItemAsync = async (key: string, value: string) => {
  store.set(key, value);
};
export const deleteItemAsync = async (key: string) => {
  store.delete(key);
};
export const isAvailableAsync = async () => true;

export default {
  getItemAsync,
  setItemAsync,
  deleteItemAsync,
  isAvailableAsync,
};
