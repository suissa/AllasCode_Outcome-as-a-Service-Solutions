/** Driver-neutral SQL port. */
export interface SqlResult<T> { rows: T[]; rowCount: number }
export interface SqlExecutor { query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<SqlResult<T>> }
export interface SqlDatabase extends SqlExecutor { transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> }
