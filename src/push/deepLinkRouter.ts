// src/push/deepLinkRouter.ts
// Maps an incoming kis:// custom-scheme or https://kis.app/... universal
// link URL to the correct navigation target. Sibling to
// notificationRouter.ts (same navigate-by-id pattern); kept separate since
// the two have different URL shapes (path segments here vs. flat payload
// fields there) even though several targets overlap.
//
// URL shapes handled (path after the scheme/host, produced by
// apps/websites/kis_content_resolvers.py's KIS_APP_DEEP_LINK_BASE):
//   kis://market/products/<id>            https://kis.app/market/products/<id>
//   kis://market/services/<id>             https://kis.app/market/services/<id>
//   kis://health/services/<id>             https://kis.app/health/services/<id>
//   kis://channels/<handle>                https://kis.app/channels/<handle>
//   kis://posts/<id>                       https://kis.app/posts/<id>
//   kis://education/courses/<id>           https://kis.app/education/courses/<id>
//   kis://education/events/<id>            https://kis.app/education/events/<id>
//   https://kis.app/auth/kisauth-callback?code=&state=   KIS Auth recovery
//     round trip (see ParentRecoveryScreen.tsx) — reuses this already-
//     verified Universal Link domain rather than registering a new
//     associated domain for kisauth.kingdomimpactventures.org, which
//     would need real DNS + hosting to verify (external action, out of
//     scope for a code change). Revisit if KIS Auth ever needs its own
//     domain for a multi-app future.
//   https://kis.app/auth/kisauth-link-callback?code=&state=          link
//   https://kis.app/auth/kisauth-registration-callback?code=&state=  sign-up
//     Same domain, distinct paths per purpose (kis-auth's client registry
//     keys allowed_redirect_uris per exact string) so each routes
//     unambiguously without a purpose flag threaded through app state.
//     Fallback only — react-native-inappbrowser-reborn's openAuth()
//     resolves the result directly in JS for the primary path; these
//     branches exist for the rare device/OS where InAppBrowser isn't
//     available and Linking.openURL's universal-link return is all
//     there is. See kisAuthBrowser.ts's 'pending' outcome.

function queryParams(url: string): Record<string, string> {
  const query = url.split('?')[1]?.split('#')[0];
  if (!query) return {};
  const out: Record<string, string> = {};
  for (const pair of query.split('&')) {
    const [key, value] = pair.split('=');
    if (key) out[decodeURIComponent(key)] = decodeURIComponent(value ?? '');
  }
  return out;
}

function pathSegments(url: string): string[] {
  try {
    // A bare "kis://market/products/1" parses with host="market" in some
    // URL implementations and path-only in others depending on scheme
    // registration — normalize by stripping the scheme and any leading
    // slashes, then splitting, rather than trusting URL()'s host/path split.
    const withoutScheme = url.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
    const withoutQuery = withoutScheme.split(/[?#]/)[0];
    return withoutQuery.split('/').filter(Boolean);
  } catch {
    return [];
  }
}

export function routeDeepLink(url: string, navigation: any): boolean {
  if (!url) return false;
  const segments = pathSegments(url);
  if (segments.length === 0) return false;

  try {
    const [first, second, third] = segments;

    if (first === 'auth' && second === 'kisauth-callback') {
      const { code, state } = queryParams(url);
      if (!code || !state) return false;
      // Route params here aren't in RootStackParamList's ParentRecovery
      // entry (currently `undefined`) — deliberately not editing
      // src/navigation/types.ts for this, since it had unrelated
      // uncommitted changes in flight from a concurrent session when this
      // was written. ParentRecoveryScreen reads these via useRoute() with
      // its own local type, not the shared navigator param list.
      navigation.navigate('ParentRecovery', { kisAuthCode: code, kisAuthState: state } as any);
      return true;
    }

    if (first === 'auth' && second === 'kisauth-link-callback') {
      const { code, state, error } = queryParams(url);
      if (!code && !error) return false;
      navigation.navigate('KisAuthLink', { kisAuthCode: code, kisAuthState: state, kisAuthError: error } as any);
      return true;
    }

    if (first === 'auth' && second === 'kisauth-registration-callback') {
      const { code, error } = queryParams(url);
      if (error === 'already_registered') {
        navigation.navigate('Login');
        return true;
      }
      if (!code) return false;
      navigation.navigate('KisAuthRegisterPhone', {
        registrationCode: code,
        redirectUri: 'https://kis.app/auth/kisauth-registration-callback',
      } as any);
      return true;
    }

    if (first === 'market' && second === 'products' && third) {
      navigation.navigate('ProductDetail', { productId: third });
      return true;
    }

    if (first === 'market' && second === 'services' && third) {
      navigation.navigate('ServiceBooking', { serviceId: third });
      return true;
    }

    // Health services can't be resolved from a bare service id alone (the
    // session/detail screens need institutionId + cardId too — see
    // notificationRouter.ts's appointment_id branch) — land on Profile,
    // matching that same established fallback rather than guessing.
    if (first === 'health' && second === 'services') {
      navigation.navigate('MainTabs', { screen: 'Profile' });
      return true;
    }

    if (first === 'channels' && second) {
      navigation.navigate('ChannelHome', { handle: second });
      return true;
    }

    if (first === 'posts' && second) {
      navigation.navigate('ChannelContentDetail', { contentId: second });
      return true;
    }

    // Courses, lessons, workshops, programs, credentials, mentorships, and
    // events all open through EducationV2DiscoverPage's detail sheet (see
    // BroadcastEducationPage's openContentId prop) — the content id alone
    // is enough to hydrate it.
    if (first === 'education' && (second === 'courses' || second === 'events') && third) {
      navigation.navigate('MainTabs', {
        screen: 'Broadcast',
        params: { mainTab: 'education', actionId: third },
      });
      return true;
    }

    return false;
  } catch (err: any) {
    if (__DEV__) {
      console.log('[deepLinkRouter] navigation error:', err?.message);
    }
    return false;
  }
}
