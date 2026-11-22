import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth';
import { errorInterceptor } from './core/http/error.interceptor';
import { mockBackendInterceptor } from './core/mock/mock-backend.interceptor';

function leaf(route: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  return route.firstChild ? leaf(route.firstChild) : route;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions({
        // Only animate between pages. Query param changes (wizard steps, table filters) stay instant.
        onViewTransitionCreated: ({ transition, from, to }) => {
          // A skipped or interrupted transition rejects `ready`; that is expected, not an error.
          transition.ready.catch(() => undefined);
          if (leaf(from).routeConfig === leaf(to).routeConfig) transition.skipTransition();
        },
      }),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    provideHttpClient(
      // Order matters: auth adds the token, errors are surfaced, and the mock backend answers last.
      // To use a real API, remove `mockBackendInterceptor`.
      withInterceptors([authInterceptor, errorInterceptor, mockBackendInterceptor]),
    ),
  ],
};
