import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { ApiDataSource, DataSource } from './core/data-source';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideClientHydration(),
    provideHttpClient(withFetch()),
    // Swap in MockDataSource (core/mock-data-source.ts) to work on the design without the API.
    { provide: DataSource, useClass: ApiDataSource },
  ],
};
