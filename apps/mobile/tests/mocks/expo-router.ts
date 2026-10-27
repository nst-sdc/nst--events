export const router = {
  push: () => {},
  replace: () => {},
  back: () => {},
  canGoBack: () => true,
  setParams: () => {},
};

export const useLocalSearchParams = () => ({});
export const useGlobalSearchParams = () => ({});
export const usePathname = () => '/';
export const useRouter = () => router;
export const Stack = {
  Screen: () => null,
};
export const Tabs = {
  Screen: () => null,
};
export const Link = ({ children }: any) => children;

export default {
  router,
  useLocalSearchParams,
  useGlobalSearchParams,
  usePathname,
  useRouter,
  Stack,
  Tabs,
  Link,
};
