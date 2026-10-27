export const GoogleSignin = {
  configure: () => {},
  hasPlayServices: async () => true,
  signIn: async () => ({
    data: {
      idToken: 'mock-id-token',
      user: {
        email: 'student@adypu.edu.in',
        name: 'Student User',
      },
    },
  }),
  signOut: async () => null,
  isSignedIn: async () => false,
  getCurrentUser: async () => null,
  clearCachedAccessToken: () => {},
  getTokens: async () => ({ idToken: 'mock-id-token', accessToken: 'mock-access-token' }),
};

export const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
};

export default {
  GoogleSignin,
  statusCodes,
};
