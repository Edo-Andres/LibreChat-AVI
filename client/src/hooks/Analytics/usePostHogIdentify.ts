import { useEffect, useRef } from 'react';
import type { TUser } from 'librechat-data-provider';
import { usePostHog } from '~/Providers/PostHogProvider';
import { useAuthContext } from '~/hooks/AuthContext';

const NO_DATA = 'sin_dato';

type AviAnalyticsProperties = {
  avi_rol: string;
  avi_subrol: string;
  avi_rango_edad: string;
  avi_region: string;
};

const buildAviProperties = (user: TUser): AviAnalyticsProperties => ({
  avi_rol: user.aviRol || NO_DATA,
  avi_subrol: user.aviSubrol || NO_DATA,
  avi_rango_edad: user.ageRange || NO_DATA,
  avi_region: user.region || NO_DATA,
});

/**
 * Sincroniza la identidad AVI del usuario logueado con PostHog.
 * - identify(): person properties -> filtros de Personas y Cohorts
 * - register(): super properties  -> filtros y breakdowns sobre EVENTOS
 * - reset():    al cerrar sesión, para no mezclar identidades en el mismo navegador
 *
 * No hace nada si PostHog no está configurado (usePostHog() === null).
 */
export default function usePostHogIdentify(): void {
  const posthog = usePostHog();
  const { user, isAuthenticated } = useAuthContext();
  /** `${userId}|${JSON de props}` de la última sincronización aplicada */
  const syncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!posthog) {
      return; // PostHog deshabilitado o aún no inicializado
    }

    if (!isAuthenticated || !user?.id) {
      if (syncedRef.current !== null) {
        posthog.reset(); // limpia distinct_id, person properties y super properties
        syncedRef.current = null;
      }
      return;
    }

    const properties = buildAviProperties(user);
    const signature = `${user.id}|${JSON.stringify(properties)}`;
    if (syncedRef.current === signature) {
      return; // idempotencia: nada cambió, no re-identificamos
    }

    // cambio de cuenta en el mismo navegador sin logout limpio
    if (syncedRef.current !== null && !syncedRef.current.startsWith(`${user.id}|`)) {
      posthog.reset();
    }

    posthog.identify(user.id, properties);
    posthog.register(properties);
    syncedRef.current = signature;
  }, [posthog, isAuthenticated, user]);
}
