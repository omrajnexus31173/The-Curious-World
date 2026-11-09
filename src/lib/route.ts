import { useEffect } from 'react';

/* ------------------------------------------------------------------ */
/*  Hash deep-linking for worlds + exhibits.                           */
/*  Single-file build has no router, so selection state is mirrored    */
/*  into the URL hash (e.g. #/world/space, #/exhibit/ex-heart) making  */
/*  every destination addressable and back/forward-safe.               */
/* ------------------------------------------------------------------ */

export type Route =
  | { kind: 'world'; id: string }
  | { kind: 'exhibit'; id: string }
  | { kind: 'domain'; id: string }
  | { kind: 'none' };

export function parseHash(hash: string): Route {
  const m = hash.match(/^#\/(world|exhibit|domain)\/([\w-]+)/);
  if (!m) return { kind: 'none' };
  if (m[1] === 'world') return { kind: 'world', id: m[2] };
  if (m[1] === 'domain') return { kind: 'domain', id: m[2] };
  return { kind: 'exhibit', id: m[2] };
}

/* True when the current hash was pushed by an in-app click this session
   (as opposed to a direct landing / reload). Only then is history.back()
   a safe way to close — otherwise we'd navigate the user off the site. */
let pushedByApp = false;

export function pushRouteHash(path: string) {
  pushedByApp = true;
  if (window.location.hash !== path) window.location.hash = path;
}

/** Dismiss the route hash: go back if we pushed it, else strip it. */
export function dismissRouteHash() {
  if (pushedByApp) {
    pushedByApp = false;
    window.history.back();
    /* Safety net: if back() didn't leave the hash (e.g. no entry),
       strip it without adding history. */
    window.setTimeout(() => {
      if (/^#\/(world|exhibit|domain)\//.test(window.location.hash)) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }, 120);
  } else {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

export const isRouteHash = (h: string) => /^#\/(world|exhibit|domain)\//.test(h);

export function useHashChange(cb: () => void) {
  useEffect(() => {
    window.addEventListener('hashchange', cb);
    return () => window.removeEventListener('hashchange', cb);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
