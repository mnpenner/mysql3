import mariadb from 'mariadb'
import {sql, SqlFrag} from './sql'
// import stream from 'stream'
// type AsyncFunction = (...args: any[]) => Promise<any>
import type * as geojson from 'geojson'

export class ConnectionPool<TDefaultValue> {

    constructor(private readonly pool: mariadb.Pool) {
    }

    async getConnection() {
        return new PoolConnection<TDefaultValue>(await this.pool.getConnection())
    }

    private _fwd<K extends keyof typeof PoolConnection.prototype>(method: K): typeof PoolConnection.prototype[K] {
        return (async (...args: any[]) => {
            const conn = await this.getConnection()
            try {
                return await (conn[method] as any)(...args)
            } finally {
                conn.release()  // TODO: what if release fails? should we at least log something?
            }
        }) as any
    }

    query = this._fwd('query')  // FIXME: type is not exporting correctly
    exec = this._fwd('exec')
    row = this._fwd('row')
    col = this._fwd('col')
    value = this._fwd('value')
    exists = this._fwd('exists')
    count = this._fwd('count')

    async* stream<TRecord extends object = Record<string, TDefaultValue>>(query: SqlFrag): AsyncGenerator<TRecord, unknown, undefined> {
        const conn = await this.getConnection()
        try {
            yield* conn.stream(query)
        } finally {
            conn.release()
        }
        return
    }

    // close = this.pool.end.bind(this.pool)
    close() {
        return this.pool.end()
    }

    async transaction<TReturn>(callback: (conn: PoolConnection<TDefaultValue>) => Promise<TReturn>): Promise<TReturn>;
    async transaction<TUnionResults=Record<string, TDefaultValue>>(callback: SqlFrag[]): Promise<QueryResult<TUnionResults>[]>;
    async transaction<TResult>(callback: any): Promise<any> {
        if (Array.isArray(callback)) {
            return this.transaction<any>(async conn => {
                const results = await Promise.allSettled(callback.map(sql => conn.query(sql)))
                if (results.some(r => r.status === 'rejected')) {
                    const errors = zip(callback, results).map((x, i) => ({
                        index: i,
                        query: x[0],
                        result: x[1],
                    })).filter(r => r.result.status === 'rejected')
                    throw Error(`${errors.length} quer${errors.length === 1 ? 'y' : 'ies'} failed:${errors.map(err => `\n[${err.index}] ${err.query.toSqlString()} :: ${(err.result as any).reason}`).join('')}`)
                }
                return results.map(r => (r as any).value)
            })
        }

        const conn = await this.getConnection()
        try {
            await conn.beginTransaction()
            let result: TResult
            try {
                result = await callback(conn)
            } catch (err) {
                await conn.rollback()
                throw err
            }
            await conn.commit()
            return result
        } finally {
            await conn.release()
        }
    }


    get activeConnections() {
        return this.pool.activeConnections()
    }

    get totalConnections() {
        return this.pool.totalConnections()
    }

    get idleConnections() {
        return this.pool.idleConnections()
    }

    get taskQueueSize() {
        return this.pool.taskQueueSize()
    }
}

function zip<A, B>(a: A[], b: B[]): Array<[A, B]> {
    if (a.length !== b.length) throw new Error("Cannot zip arrays; lengths differ")
    return a.map((x, i) => [x, b[i]])
}

export interface QueryOptions extends mariadb.QueryConfig {
    sql: SqlFrag
}

export type QueryParam = SqlFrag | QueryOptions

function makeOptions(query: QueryParam) {
    if (query instanceof SqlFrag) {
        return {sql: query}
    } else if (typeof query === 'object') {
        return query
    }
    throw new Error(`Expected sql\`template string\` or {options}, got ${typeof query}`)
}

export const META = 'meta'
export type DefaultValueType = string | number | /*FIXME might be coming out wrong*/Buffer | boolean | Date | bigint | null | /*set*/string[] | geojson.Geometry
export type DefaultRecordType = Record<string, DefaultValueType>
export type QueryResult<T> = T[] & { [META]: mariadb.FieldInfo[] }

export class PoolConnection<TDefaultValue> {

    constructor(private readonly conn: mariadb.PoolConnection) {
    }

    query<TRecord = Record<string, TDefaultValue>>(query: QueryParam): Promise<QueryResult<TRecord>> {
        const opts = makeOptions(query)
        return this.conn.query({
            ...opts,
            sql: opts.sql.toSqlString(),
        })
    }

    exec: ((...args: Parameters<typeof PoolConnection.prototype.query>) => Promise<mariadb.UpsertResult>) = this.query.bind(this) as any

    async row<TRecord extends object = Record<string, TDefaultValue>>(query: QueryParam): Promise<TRecord | null> {
        const opts = makeOptions(query)
        const rows = await this.query<TRecord>({
            ...opts,
            sql: sql`select * from (${opts.sql}) _query limit 1`
        })
        return rows.length ? rows[0] : null
    }

    async col<TValue=TDefaultValue>(query: SqlFrag): Promise<TValue[]> {
        const rows = await this.query<any[]>({
            sql: query,
            rowsAsArray: true,
        })
        if(!rows.length) return []
        if (rows[0].length !== 1) throw new Error(`Expected exactly 1 field in query, got ${rows[0].length}`)
        return rows.map(r => r[0])
    }

    async value<TValue = TDefaultValue>(query: SqlFrag): Promise<TValue | null> {
        const row = await this.row<TValue[]>({
            sql: query,
            rowsAsArray: true,
        })
        if (!row) return null
        if (row.length !== 1) throw new Error(`Expected exactly 1 field in query, got ${row.length}`)
        return row[0]
    }

    async exists(query: SqlFrag): Promise<boolean> {
        return Boolean(await this.value<0 | 1>(sql`select exists(${query})`))
    }

    async count(query: SqlFrag) {
        return Number(await this.value(sql`select count(*) from (${query}) _query`))
    }

    async* stream<TRecord extends object = Record<string, TDefaultValue>>(query: SqlFrag): AsyncGenerator<TRecord, unknown, undefined> {
        let results: TRecord[] = [];
        let resolve: () => void;
        let promise = new Promise<void>(r => resolve = r);
        let done = false;

        this.conn.queryStream(query.toSqlString())
            .on('error', err => {
                throw err;
            })
            .on('data', row => {
                results.push(row);
                resolve();
            })
            .on('end', () => {
                done = true;
                resolve();
            })

        for(;;) {
            await promise;
            yield* results;
            if(done) break
            promise = new Promise(r => resolve = r);
            results = [];
        }
        return
    }

    release() { return this.conn.release() }
    beginTransaction() { return this.conn.beginTransaction() }
    commit() { return this.conn.commit() }
    rollback() { return this.conn.rollback() }
    ping() { return this.conn.ping() }
    changeUser() { return this.conn.changeUser() }
    close() { return this.conn.end() }
    destroy() { return this.conn.destroy() }

    get serverVersion() {
        return this.conn.serverVersion()
    }

    get isValid() {
        return this.conn.isValid()
    }
}

export async function createPool<T=DefaultValueType>(config: mariadb.PoolConfig) {
    return new ConnectionPool<T>(await mariadb.createPool({
        supportBigInt: true,
        dateStrings: true,
        ...config,
    }))
}

