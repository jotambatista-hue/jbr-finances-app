import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { CategoryRow, FinanceDataService } from '../../core/finance-data.service';
import { Category } from '../../core/models';
import { Icon } from '../../shared/icon';
import { CategoryDialog } from './category-dialog';

const TYPE_LABEL: Record<Category['type'], string> = { expense: 'Expense', income: 'Income' };

@Component({
  selector: 'app-categories-page',
  imports: [Icon, CategoryDialog],
  templateUrl: './categories-page.html',
})
export class CategoriesPage {
  private readonly data = inject(FinanceDataService);

  /** Bound from the `?view=` query param: `expense` or `income`. */
  readonly view = input<string>();

  protected readonly typeLabel = TYPE_LABEL;
  protected readonly query = signal('');

  private readonly type = computed(() => {
    const v = this.view();
    return v === 'expense' || v === 'income' ? v : null;
  });

  protected readonly title = computed(() => {
    const t = this.type();
    return t ? `${TYPE_LABEL[t]} categories` : 'Categories';
  });

  /** Each group followed by its categories; a category matching the search keeps its group visible. */
  protected readonly rows = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.data.categories().filter((c) => !this.type() || c.type === this.type());
    const byName = (a: CategoryRow, b: CategoryRow) => a.name.localeCompare(b.name);
    const matches = (c: CategoryRow) => !q || c.name.toLowerCase().includes(q);
    const ids = new Set(all.map((c) => c.id));
    const tops = all
      .filter((c) => c.parentId === null || !ids.has(c.parentId))
      .sort((a, b) => a.type.localeCompare(b.type) || byName(a, b));
    return tops.flatMap((top) => {
      const children = all.filter((c) => c.parentId === top.id).sort(byName);
      const shown = matches(top) ? children : children.filter(matches);
      return matches(top) || shown.length ? [top, ...shown] : [];
    });
  });

  protected readonly counts = computed(() => {
    const all = this.data.categories();
    return {
      groups: all.filter((c) => c.parentId === null && c.childCount > 0).length,
      categories: all.filter((c) => c.childCount === 0).length,
    };
  });

  // -------------------------------------------------------- Delete dialog

  private readonly deleteDialog = viewChild.required<ElementRef<HTMLDialogElement>>('deleteDialog');
  protected readonly deleting = signal<CategoryRow | null>(null);
  protected readonly deleteError = signal<string | null>(null);
  protected readonly deleteBusy = signal(false);

  protected openDelete(row: CategoryRow) {
    this.deleting.set(row);
    this.deleteError.set(null);
    this.deleteDialog().nativeElement.showModal();
  }

  protected closeDelete() {
    this.deleteDialog().nativeElement.close();
  }

  protected async confirmDelete() {
    const row = this.deleting();
    if (!row || this.deleteBusy()) return;
    this.deleteBusy.set(true);
    this.deleteError.set(null);
    try {
      const problem = await this.data.deleteCategory(row.id);
      if (problem) this.deleteError.set(problem);
      else this.closeDelete();
    } catch (e) {
      this.deleteError.set(
        e instanceof HttpErrorResponse && e.status === 409
          ? 'It’s still used by other records, so it can’t be deleted.'
          : 'Couldn’t delete the category. Check that the API is running and try again.',
      );
    } finally {
      this.deleteBusy.set(false);
    }
  }
}
