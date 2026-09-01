// Stub for the 20+ files that `import { useAuth } from '<relative>/App'`
// (SocketProvider.tsx, most of src/screens/*, Sidebar.tsx, ...). App.tsx is
// the app's root component and only defines useAuth as a side effect of
// also wiring up the full navigation stack, every top-level screen, and
// every native module they import — so requiring it for real (transitively,
// via any test that imports one of those files) means mocking out the
// app's entire native dependency surface just to reach one boolean. Mapped
// in jest.config.js's moduleNameMapper; see the comment there for exactly
// which specifiers redirect here vs. reach the real App.tsx.
export const useAuth = () => ({
  isAuth: false,
  setAuth: () => {},
  locationReady: false,
  countryISO: 'US',
  callingCode: '+1',
  refreshLocation: async () => false,
  user: null,
  setUser: () => {},
  hasPin: null,
  setHasPin: () => {},
});
