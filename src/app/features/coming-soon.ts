import { Component, input } from '@angular/core';

@Component({
  selector: 'app-coming-soon',
  template: `
    <div class="page-head">
      <div>
        <p class="eyebrow">Not built yet</p>
        <h1>{{ label() }}</h1>
        <p class="lede">This module is part of the schema but doesn't have a screen yet.</p>
      </div>
    </div>
  `,
})
export class ComingSoon {
  /** Bound from the route's `data.label`. */
  readonly label = input('');
}
