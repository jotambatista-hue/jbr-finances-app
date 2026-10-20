import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { CategoryRow, FinanceDataService } from '../../core/finance-data.service';
import { Category } from '../../core/models';

/** Form for adding or editing a category. Open it with `open()` or `open(row)`. */
@Component({
  selector: 'app-category-dialog',
  templateUrl: './category-dialog.html',
})
export class CategoryDialog {
  private readonly data = inject(FinanceDataService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  /** The category being edited; null when adding. */
  protected readonly editing = signal<CategoryRow | null>(null);
  protected readonly name = signal('');
  protected readonly type = signal<Category['type']>('expense');
  protected readonly parentId = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  /** Top-level categories of the same type it can be grouped under. */
  protected readonly parents = computed(() =>
    this.data
      .categories()
      .filter((c) => c.parentId === null && c.type === this.type() && c.id !== this.editing()?.id)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  private readonly draft = computed(() => ({
    id: this.editing()?.id,
    name: this.name(),
    type: this.type(),
    parentId: this.parentId() || null,
  }));

  /** Shown once there's something typed, so an empty form isn't an error. */
  protected readonly problem = computed(() => (this.name().trim() ? this.data.categoryProblem(this.draft()) : null));

  open(row?: CategoryRow, defaults?: Partial<Pick<Category, 'type' | 'parentId'>>) {
    this.editing.set(row ?? null);
    this.name.set(row?.name ?? '');
    this.type.set(row?.type ?? defaults?.type ?? 'expense');
    this.parentId.set(row?.parentId ?? defaults?.parentId ?? '');
    this.error.set(null);
    this.dialog().nativeElement.showModal();
  }

  protected setType(type: Category['type']) {
    this.type.set(type);
    // A group of the other type no longer fits.
    if (!this.parents().some((p) => p.id === this.parentId())) this.parentId.set('');
  }

  protected close() {
    this.dialog().nativeElement.close();
  }

  protected async save() {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const problem = await this.data.saveCategory(this.draft());
      if (problem) this.error.set(problem);
      else this.close();
    } catch (e) {
      const detail = e instanceof HttpErrorResponse && typeof e.error?.detail === 'string' ? e.error.detail : null;
      this.error.set(detail ?? 'Couldn’t save the category. Check that the API is running and try again.');
    } finally {
      this.saving.set(false);
    }
  }
}
