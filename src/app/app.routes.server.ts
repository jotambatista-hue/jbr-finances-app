import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    // Everything is live data from the API, so render in the browser
    // instead of prerendering at build time.
    path: '**',
    renderMode: RenderMode.Client,
  },
];
