import * as mysql from 'mysql';
import {PoolConfig as _PoolConfig, Pool, TypeCast as _TypeCast, FieldInfo as _FieldInfo, Types as _Types} from "mysql";
import {SqlFrag} from './Sql';
import highlight from 'cli-highlight';
import {inspect} from "util";
import {GeometryType} from "mysql";

export interface PoolConfig extends Omit<_PoolConfig,'typeCast'|'supportBigNumbers'|'bigNumberStrings'> {
    printQueries?: boolean
    typeCast(field: FieldInfo, next: NextFn): any,
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
        this.config = config;
        this.pool = mysql.createPool({
            timezone: 'Z',
            charset: 'utf8mb4',
            typeCast,
            ...config,
        });
    }

    query(query: SqlFrag) {
        return new Promise((resolve, reject) => {
            const sql = query.toSqlString();
            if (this.config.printQueries) {
                const hisql = highlight(sql, {language: 'sql', ignoreIllegals: true});
                console.log(hisql);
            }
            this.pool.query(sql, (error, results, fields) => {
                if (error) return reject(error);
                resolve(results);
            })
        })
    }

    close() {
        return new Promise((resolve, reject) => {
            this.pool.end(err => {
                if (err) return reject(err);
            })
        })
    }
}
