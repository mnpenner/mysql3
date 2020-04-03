import * as mysql from 'mysql';
import {PoolConfig as _PoolConfig, Pool, TypeCast as _TypeCast, FieldInfo as _FieldInfo, Types as _Types} from "mysql";
import {sql, SqlFrag} from './Sql';
import highlight from 'cli-highlight';
import {inspect} from "util";
import {GeometryType} from "mysql";
import SqlMode from "./SqlMode";
import {PoolConnection as _PoolConnection} from "mysql";

export interface PoolConfig extends Omit<_PoolConfig,'typeCast'|'supportBigNumbers'|'bigNumberStrings'> {
    /**
     * Print SQL queries to STDOUT before executing them.
     */
    printQueries?: boolean
    typeCast?: (field: FieldInfo, next: NextFn) => any,
    /**
     * @deprecated Set in my.cnf under [mysqld]
     */
    sqlMode?: SqlMode[]|string|null,
    /**
     * Enable or disable foreign key checks for the current session. May ease migration scripts, but not recommended
     * for production usage.
     */
    foreignKeyChecks?: boolean|null,
    /**
     * If this variable is enabled, UPDATE and DELETE statements that do not use a key in the WHERE clause or a LIMIT clause produce an error. This makes it possible to catch UPDATE and DELETE statements where keys are not used properly and that would probably change or delete a large number of rows.
     *
     * @link https://mariadb.com/kb/en/library/server-system-variables/#sql_safe_updates
     * @link https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html#sysvar_sql_safe_updates
     * @deprecated Set in my.cnf under [mysqld]
     */
    safeUpdates?: boolean|null,
    /**
     * Array of SQL statements to execute upon connection.
     */
    initSql?: Array<SqlFrag>
}

export type NextFn = () => void
export type Types = keyof typeof _Types
export type FieldInfo = Omit<_FieldInfo, 'type'> & {
    type: Types,
    length: number,
    string(): string | null,
    buffer(): Buffer | null,
    geometry(): GeometryType | null,
}

export interface OkPacket {
    fieldCount: number,
    affectedRows: number,
    insertId: number,
    serverStatus: number,
    warningCount: number,
    message: string,
    protocol41: boolean,
    changedRows: number
}


function typeCast(field: FieldInfo, next: NextFn): any {
    switch (field.type) {
        case 'DATE':
        case 'DATETIME':
        case 'DATETIME2':
        case 'NEWDATE':
        case 'TIMESTAMP':
        case 'TIMESTAMP2':
            // https://github.com/mysqljs/mysql#type-casting
            return field.string();
        case 'LONGLONG':
            const numberString = field.string();
            return numberString === null ? null : BigInt(numberString);
        case 'BIT':
            if (field.length === 1) {
                const buf = field.buffer();
                return buf === null ? null : buf[0] === 1;
            }
            break;
    }
    return next();
}

export class ConnectionPool {
    private pool: Pool;
    private readonly config: PoolConfig;

    constructor(config: PoolConfig) {
        this.config = {
            timezone: 'Z',
            charset: 'utf8mb4',
            typeCast,
            ...config,
        };
        let {sqlMode,foreignKeyChecks,safeUpdates,printQueries,initSql,...other} = this.config;
        // console.log(other);
        this.pool = mysql.createPool(other);

        const connQueries = initSql ? [...initSql] : [];
        if(sqlMode != null) {
            connQueries.push(sql`SET sql_mode=${Array.isArray(sqlMode) ?  sqlMode.join(',') : sqlMode}`);
        }
        if(foreignKeyChecks != null) {
            connQueries.push(sql`SET foreign_key_checks=${foreignKeyChecks ? 1 : 0}`);
        }
        if(safeUpdates) {
            connQueries.push(sql`SET sql_safe_updates=${safeUpdates ? 1 : 0}`);
        }
        if(connQueries.length) {
            this.pool.on('connection', (_conn: _PoolConnection) => {
                const conn = this._wrap(_conn);
                for(const query of connQueries) {
                    conn.query(query); // TODO: do we need to wait for these queries to finish...?
                }
            });
        }
    }

    query<TRecord extends object=Record<string,any>>(query: SqlFrag): Promise<TRecord[]> {
        return this.withConnection(conn => conn.query(query))
    }

    exec(query: SqlFrag): Promise<OkPacket> {
        return this.withConnection(conn => conn.query(query))
    }

    async* stream<TRecord extends object = Record<string, any>>(query: SqlFrag): AsyncGenerator<TRecord, void, any> {
        const sql = query.toSqlString();

        if (this.config.printQueries) {
            const hisql = highlight(sql, {language: 'sql', ignoreIllegals: true});
            console.log(hisql);
        }

        let results: TRecord[] = [];
        let resolve: () => void;
        let promise = new Promise(r => resolve = r);
        let done = false;

        this.pool.query(sql)
            .on('error', err => {
                throw err;
            })
            .on('result', row => {
                results.push(row);
                resolve();
                promise = new Promise(r => resolve = r);
            })
            .on('end', () => {
                done = true;
            })

        while (!done) {
            await promise;
            yield* results;
            results = [];
        }
    }

    withConnection<TResult>(callback: (conn:PoolConnection) => Promise<TResult>): Promise<TResult> {
        return new Promise((resolve, reject) => {
            this.pool.getConnection(async (err, conn) => {
                if (err) return reject(err);
                try {
                    resolve(callback(this._wrap(conn)));
                } finally {
                    conn.release();
                }
            })
        });
    }

    transaction<TResult>(callback: ((conn:PoolConnection) => Promise<TResult>)|SqlFrag[]): Promise<TResult> {
        if(Array.isArray(callback)) {
            return this.transaction<any>(async conn => {
                const results = await Promise.allSettled(callback.map(sql => conn.query(sql)))
                const mapped = zip(callback, results).map((x,i) => ({
                    index: i,
                    query: x[0],
                    result: x[1],
                }))
                const errors = mapped.filter(r => r.result.status === 'rejected');
                if(errors.length) throw Error(`${errors.length} quer${errors.length === 1 ? 'y' : 'ies'} failed:${errors.map(err => `\n[${err.index}] ${err.query.toSqlString()} :: ${(err.result as any).reason}`).join('')}`);
                return results; // TODO: is this the best format for the results?
            });
        }
        return this.withConnection(async conn => {
            await conn.query(sql`START TRANSACTION`);
            let result: TResult;
            try {
                result = await callback(conn);
            } catch(err) {
                await conn.query(sql`ROLLBACK`);
                throw err;
            }
            await conn.query(sql`COMMIT`);
            return result;
        })
    }

    private _wrap(conn: _PoolConnection) {
        return new PoolConnection(conn, !!this.config.printQueries);
    }

    close() {
        return new Promise((resolve, reject) => {
            this.pool.end(err => {
                if (err) return reject(err);
                resolve();
            })
        })
    }
}

function zip<A,B>(a: A[], b: B[]): Array<[A,B]> {
    if(a.length !== b.length) throw new Error("Cannot zip arrays; lengths differ");
    return a.map((x,i) => [x,b[i]]);
}

class PoolConnection {

    constructor(private readonly conn: _PoolConnection, private readonly printQueries: boolean) {

    }

    query(query: SqlFrag): Promise<any> {
        return new Promise((resolve, reject) => {
            const sql = query.toSqlString();
            if (this.printQueries) {
                const hisql = highlight(sql, {language: 'sql', ignoreIllegals: true});
                console.log(hisql);
            }
            this.conn.query(sql, (error, results, fields) => {
                if (error) return reject(error);
                resolve(results);
            })
        })
    }
}
