import MariaDB, {FieldInfo} from 'mariadb'
import {sql, SqlFrag} from './sql'

type AsyncFunction = (...args: any[]) => Promise<any>


export class ConnectionPool {

    constructor(private readonly pool: MariaDB.Pool) {
    }

    async getConnection() {
        return new PoolConnection(await this.pool.getConnection())
    }

    private _fwd<K extends keyof typeof PoolConnection.prototype>(method: K): typeof PoolConnection.prototype[K] {
        return (async (...args: any[]) => {
            const conn = await this.getConnection()
            try {
                return await (conn[method] as any)(...args)
            } finally {
                conn.release()
            }
        }) as any
    }

    query = this._fwd('query')
    row = this._fwd('row')
    value = this._fwd('value')
    exists = this._fwd('exists')
    count = this._fwd('count')

    close = this.pool.end.bind(this.pool)

    async transaction<TReturn>(callback: (conn: PoolConnection) => Promise<TReturn>): Promise<TReturn>;
    async transaction<TUnionResults=DefaultRecordType>(callback: SqlFrag[]): Promise<QueryResult<TUnionResults>[]>;
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

interface QueryOptions extends MariaDB.QueryConfig {
    sql: SqlFrag
}

type QueryParam = SqlFrag | QueryOptions

function makeOptions(query: QueryParam) {
    if (query instanceof SqlFrag) {
        return {sql: query}
    } else if (typeof query === 'object') {
        return query
    }
    throw new Error(`Expected sql\`template string\` or {options}, got ${typeof query}`)
}

export const META = 'meta'
export type DefaultValueType = string | number | Buffer | boolean | Date | bigint
export type DefaultRecordType = Record<string, DefaultValueType>
export type QueryResult<T = DefaultRecordType> = T[] & { [META]: FieldInfo[] }

class PoolConnection {

    constructor(private readonly conn: MariaDB.PoolConnection) {
    }

    query<TRecord = DefaultRecordType>(query: QueryParam): Promise<QueryResult<TRecord>> {
        const opts = makeOptions(query)
        return this.conn.query({
            ...opts,
            sql: opts.sql.toSqlString(),
        })
    }

    exec: ((...args: Parameters<typeof PoolConnection.prototype.query>) => Promise<MariaDB.UpsertResult>) = this.query.bind(this) as any

    async row<TRecord extends object = DefaultRecordType>(query: QueryParam): Promise<TRecord | null> {
        const opts = makeOptions(query)
        const rows = await this.query<TRecord>({
            ...opts,
            sql: sql`select * from (${opts.sql}) _query limit 1`
        })
        return rows.length ? rows[0] : null
    }

    async value<TValue = DefaultValueType>(query: SqlFrag): Promise<TValue | null> {
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

    release = this.conn.release.bind(this.conn)
    beginTransaction = this.conn.beginTransaction.bind(this.conn)
    commit = this.conn.commit.bind(this.conn)
    rollback = this.conn.rollback.bind(this.conn)
    ping = this.conn.ping.bind(this.conn)
    changeUser = this.conn.changeUser.bind(this.conn)
    isValid = this.conn.isValid.bind(this.conn)
    close = this.conn.end.bind(this.conn)
    destroy = this.conn.destroy.bind(this.conn)
    serverVersion = this.conn.serverVersion.bind(this.conn)
}

export async function createPool(config: MariaDB.PoolConfig) {
    return new ConnectionPool(await MariaDB.createPool({
        supportBigInt: true,
        ...config,
    }))
}

