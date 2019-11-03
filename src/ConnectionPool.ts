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
    sqlMode?: SqlMode[]|string|null,
    foreignKeyChecks?: boolean|null,
    /**
     * If this variable is enabled, UPDATE and DELETE statements that do not use a key in the WHERE clause or a LIMIT clause produce an error. This makes it possible to catch UPDATE and DELETE statements where keys are not used properly and that would probably change or delete a large number of rows.
     *
     * @link https://mariadb.com/kb/en/library/server-system-variables/#sql_safe_updates
     * @link https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html#sysvar_sql_safe_updates
     */
    safeUpdates?: boolean|null,
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

export default class ConnectionPool {
    private pool: Pool;
    private readonly config: PoolConfig;

    constructor(config: PoolConfig) {
        this.config = {
            timezone: 'Z',
            charset: 'utf8mb4',
            safeUpdates: true,
            sqlMode: [
                SqlMode.OnlyFullGroupBy,
                SqlMode.StrictTransTables,
                SqlMode.StrictAllTables,
                SqlMode.NoZeroInDate,
                SqlMode.NoZeroDate,
                SqlMode.ErrorForDivisionByZero,
                SqlMode.NoEngineSubstitution,
                SqlMode.NoUnsignedSubtraction,
                SqlMode.PadCharToFullLength,
            ],
            typeCast,
            ...config,
        };
        let {sqlMode,foreignKeyChecks,safeUpdates,printQueries,...other} = this.config;
        this.pool = mysql.createPool(other);

        if(sqlMode != null || foreignKeyChecks != null || safeUpdates != null) {
            const strSqlMode = Array.isArray(sqlMode) ?  sqlMode.join(',') : sqlMode;

            this.pool.on('connection', (_conn: _PoolConnection) => {
                const conn = this._wrap(_conn);
                if(strSqlMode != null) {
                    conn.query(sql`SET sql_mode=${strSqlMode}`);
                }
                if(foreignKeyChecks != null) {
                    conn.query(sql`SET foreign_key_checks=${foreignKeyChecks ? 1 : 0}`);
                }
                if(safeUpdates != null) {
                    conn.query(sql`SET sql_safe_updates=${safeUpdates ? 1 : 0}`);
                }
            });
        }
    }

    query<TRecord extends object=Record<string,any>>(query: SqlFrag): Promise<TRecord[]> {
        return this.withConnection(conn => conn.query(query))
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

    transaction(callback: (conn:PoolConnection) => Promise<void>): Promise<void> {
        return this.withConnection(async conn => {
            await conn.query(sql`START TRANSACTION`);
            try {
                await callback(conn);
            } catch(err) {
                await conn.query(sql`ROLLBACK`);
                throw err;
            }
            await conn.query(sql`COMMIT`);
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


class PoolConnection {

    constructor(private readonly conn: _PoolConnection, private readonly printQueries: boolean) {

    }

    query<TRecord extends object=Record<string,any>>(query: SqlFrag): Promise<TRecord[]> {
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
