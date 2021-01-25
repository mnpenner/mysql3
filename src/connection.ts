import Maria, {FieldInfo, QueryConfig} from 'mariadb'
import {sql, SqlFrag} from './sql'

type AsyncFunction = (...args:any[]) => Promise<any>


export class ConnectionPool {

    constructor(private readonly pool: Maria.Pool) {
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
        })
    }

    query = this._fwd('query')
    row = this._fwd('row')
    value = this._fwd('value')
    exists = this._fwd('exists')

    close = this.pool.end.bind(this.pool)

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

interface QueryOptions extends Maria.QueryConfig {
    sql: SqlFrag
}

type QueryParam = SqlFrag|QueryOptions

function makeOptions(query: QueryParam) {
    if(query instanceof SqlFrag) {
        return {sql: query}
    } else if(typeof query === 'object') {
        return query;
    }
    throw new Error(`Expected sql\`template string\` or {options}, got ${typeof query}`)
}

export const META = 'meta'
export type DefaultValueType = string|number|Buffer|boolean|Date|bigint
export type DefaultRecordType = Record<string,DefaultValueType>

class PoolConnection {

    constructor(private readonly conn: Maria.PoolConnection) {
    }

    query<TRecord extends object=DefaultRecordType>(query: QueryParam): Promise<TRecord[] & {[META]: FieldInfo[]}> {
        const opts = makeOptions(query)
        return this.conn.query({
            ...opts,
            sql: opts.sql.toSqlString(),
        })
    }

    exec: ((...args:Parameters<typeof PoolConnection.prototype.query>) => Promise<Maria.UpsertResult>) = this.query.bind(this) as any

    async row<TRecord extends object=DefaultRecordType>(query: QueryParam): Promise<TRecord|null> {
        const opts = makeOptions(query)
        const rows = await this.query<TRecord>({...opts,sql: sql`select * from (${opts.sql}) _query limit 1`})
        return rows.length ? rows[0] : null;
    }

    async value<TValue=DefaultValueType>(query: SqlFrag): Promise<TValue|null> {
        const row = await this.row<TValue[]>({
            sql: query,
            rowsAsArray: true,
        })
        if(!row) return null
        if(row.length !== 1) throw new Error(`Expected exactly 1 field in query, got ${row.length}`)
        return row[0]
    }

    async exists(query: SqlFrag): Promise<boolean> {
        return Boolean(await this.value<0|1>(sql`select exists(${query})`))
    }



    release = this.conn.release.bind(this.conn)
}

export async function createPool(config: Maria.PoolConfig) {
    return new ConnectionPool(await Maria.createPool({
        supportBigInt: true,
        ...config,
    }))
}

