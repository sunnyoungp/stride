// Demo mode storage — replaces Supabase with localStorage so portfolio visitors
// can use the full app without authentication.

export const DEMO_USER_ID = "demo-user-00000000-0000-0000-0000-000000000000";

const DEMO_ACTIVE_KEY = "stride-demo-active";
const TABLE_PREFIX    = "stride-demo-tbl-";

// ── Mode flag ─────────────────────────────────────────────────────────────────

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DEMO_ACTIVE_KEY) === "true";
}

export function setDemoMode(active: boolean): void {
  if (typeof window === "undefined") return;
  if (active) localStorage.setItem(DEMO_ACTIVE_KEY, "true");
  else        localStorage.removeItem(DEMO_ACTIVE_KEY);
}

// ── Table storage ─────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

export function getDemoTable(table: string): Row[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(TABLE_PREFIX + table) ?? "[]") as Row[];
  } catch {
    return [];
  }
}

export function setDemoTable(table: string, rows: Row[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TABLE_PREFIX + table, JSON.stringify(rows));
}

// ── Query builder ─────────────────────────────────────────────────────────────

type Filter =
  | { type: "eq"; col: string; val: unknown }
  | { type: "in"; col: string; vals: unknown[] };

class DemoQueryBuilder {
  private op: "select" | "insert" | "update" | "delete" | "upsert" | null = null;
  private payload: Row | Row[] | null = null;
  private filters: Filter[] = [];

  constructor(private readonly table: string) {}

  select(_cols?: string)          { this.op = "select";               return this; }
  insert(row: Row | Row[])        { this.op = "insert"; this.payload = row; return this; }
  update(partial: Row)            { this.op = "update"; this.payload = partial; return this; }
  delete()                        { this.op = "delete";               return this; }
  upsert(row: Row | Row[])        { this.op = "upsert"; this.payload = row; return this; }

  eq(col: string, val: unknown)   { this.filters.push({ type: "eq", col, val }); return this; }
  in(col: string, vals: unknown[]) { this.filters.push({ type: "in", col, vals }); return this; }

  /** Terminal: returns single row or null. Used by dailyNoteStore. */
  maybeSingle(): Promise<{ data: Row | null; error: null }> {
    this.op = "select";
    const matched = this.applyFilters(getDemoTable(this.table));
    return Promise.resolve({ data: matched[0] ?? null, error: null });
  }

  // Makes the builder directly awaitable via `await builder`
  then<T1 = { data: unknown; error: null }, T2 = never>(
    onfulfilled?: ((v: { data: unknown; error: null }) => T1 | PromiseLike<T1>) | null,
    onrejected?:  ((r: unknown) => T2 | PromiseLike<T2>) | null,
  ): Promise<T1 | T2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private applyFilters(rows: Row[]): Row[] {
    return rows.filter((row) =>
      this.filters.every((f) => {
        if (f.type === "eq") {
          if (f.val === null) return row[f.col] == null;
          return row[f.col] === f.val;
        }
        if (f.type === "in") return (f.vals as unknown[]).includes(row[f.col]);
        return true;
      }),
    );
  }

  private execute(): { data: unknown; error: null } {
    const rows = getDemoTable(this.table);

    switch (this.op) {
      case "select": {
        const result = this.filters.length > 0 ? this.applyFilters(rows) : rows;
        return { data: result, error: null };
      }
      case "insert": {
        const toInsert  = Array.isArray(this.payload) ? this.payload : [this.payload!];
        const existingIds = new Set(rows.map((r) => r.id));
        const newRows   = toInsert.filter((r) => !existingIds.has(r.id));
        setDemoTable(this.table, [...rows, ...newRows]);
        return { data: toInsert, error: null };
      }
      case "update": {
        const updated = rows.map((row) =>
          this.filters.length === 0 || this.applyFilters([row]).length > 0
            ? { ...row, ...(this.payload as Row) }
            : row,
        );
        setDemoTable(this.table, updated);
        return { data: null, error: null };
      }
      case "delete": {
        if (this.filters.length === 0) return { data: null, error: null }; // safety guard
        const remaining = rows.filter((row) => this.applyFilters([row]).length === 0);
        setDemoTable(this.table, remaining);
        return { data: null, error: null };
      }
      case "upsert": {
        const toUpsert = Array.isArray(this.payload) ? this.payload : [this.payload!];
        const updated  = [...rows];
        for (const row of toUpsert) {
          const idx = updated.findIndex((r) => r.id === row.id);
          if (idx >= 0) updated[idx] = { ...updated[idx], ...row };
          else          updated.push(row);
        }
        setDemoTable(this.table, updated);
        return { data: toUpsert, error: null };
      }
      default:
        return { data: null, error: null };
    }
  }
}

export function createDemoQueryBuilder(table: string): DemoQueryBuilder {
  return new DemoQueryBuilder(table);
}
