type PrimitiveValue = string | number | Buffer | bigint | boolean | null | Date;
type SingleValue = PrimitiveValue | SqlFrag
type Value = SingleValue | SingleValue[];
type OptionalValue = Value|undefined

type StrictDatabaseId = [database: string]
type LooseDatabaseId = StrictDatabaseId | string

type StrictTableId = [database: string, table: string] | [table: string]
type LooseTableId = StrictTableId | string
type TableId = LooseTableId | SqlFrag

type StrictColumnId = [column: string] | [table: string, column: string] | [database: string, table: string, column: string]
type LooseColumnId = StrictColumnId | string;
type ColumnId = LooseColumnId | SqlFrag

type LooseId = LooseColumnId;
type Id = LooseId | SqlFrag;

type LatLngPair = [lat: number, lng: number]
type PointArray = LatLngPair[] | Point[] | LatLngObj[]

interface Point {
    x: number
    y: number
}

interface LatLngObj {
    lat: number
    lng: number
}

const CHARS_REGEX = /[\x00\b\n\r\t\x1A'\\]/gu;
const CHARS_ESCAPE_MAP: Record<string,string> = {
    '\0': '\\0',
    '\b': '\\b',
    '\n': '\\n',
    '\r': '\\r',
    '\t': '\\t',
    '\x1a': '\\Z',
    '\'': "''",
    '\\': '\\\\'
};
const ID_GLOBAL_REGEXP = /`/g;
const QUAL_GLOBAL_REGEXP = /\./g;

export class SqlFrag {
    constructor(private readonly sql: string) {
    }

    toString() {
        throw new Error("SqlFrag cannot be cast to string");
    }

    toSqlString() {
        return this.sql;
    }
}

export function isFrag(x: any): x is SqlFrag {
    return x instanceof SqlFrag;
}

function frag(sql: string): SqlFrag {
    return new SqlFrag(sql)
}

export function escapeValue(value: Value): SqlFrag {
    if (isFrag(value)) return value;
    return frag(_escapeValue(value));
}

export function sql(strings: TemplateStringsArray, ...values: Value[]): SqlFrag {
    let out = [];
    let i = 0;
    for (; i < values.length; ++i) {
        out.push(strings[i], escapeValue(values[i]).toSqlString());
    }
    out.push(strings[i]);
    return frag(out.join(''));
}

function _escapeValue(value: Value): string {
    if (isFrag(value)) {
        return value.toSqlString();
    }
    if(Array.isArray(value)) {
        if(!value.length) return '/*emptyArr*/NULL'
        return value.map(v => _escapeValue(v)).join(',');
    }
    if(Buffer.isBuffer(value)) {
        return `x'${value.toString('hex')}'`;
    }
    if(typeof value === 'number' || typeof value === 'bigint') {
        return String(value);
    }
    if(typeof value === 'string') {
        return _escapeString(value);
    }
    if(value === true) {
        return '1';
    }
    if(value === false) {
        return '0';
    }
    if(value === null) {
        return 'NULL';
    }
    if(value instanceof Date) {
        return `TIMESTAMP'${value.toISOString().slice(0,-1)}'`
    }
    throw new Error(`Unsupported value type: ${value}`)
}

function hasOwn(obj: object, key: PropertyKey) {
    return Object.prototype.hasOwnProperty.call(obj, key);
}


function _escapeString(value: string): string {
    return "'" + String(value).replace(CHARS_REGEX,m => CHARS_ESCAPE_MAP[m]) + "'";
}

function escapeIdStrictFrag(id: Id): SqlFrag {
    if (isFrag(id)) return id;
    if (Array.isArray(id)) return frag(id.map(_escapeIdStrict).join('.'));
    return frag(_escapeIdStrict(id));
}


function _escapeIdLoose(id: Id): string {
    if(isFrag(id)) return id.toSqlString();
    if(Array.isArray(id)) return id.map(_escapeIdStrict).join('.');
    return '`' + String(id).replace(ID_GLOBAL_REGEXP, '``').replace(QUAL_GLOBAL_REGEXP, '`.`') + '`';
}

function _escapeIdStrict(id: Id): string {
    if(isFrag(id)) return id.toSqlString();
    if(Array.isArray(id)) return id.map(_escapeIdStrict).join('.');
    return '`' + String(id).replace(ID_GLOBAL_REGEXP, '``') + '`';
}

function pointPairs(points: PointArray): LatLngPair[] {
    if (!points.length) return [];
    const sample = points[0];
    if (Array.isArray(sample) && sample.length === 2) {
        return [...points] as LatLngPair[];
    }
    if (hasOwn(sample, 'x') && hasOwn(sample, 'y')) {
        return (points as Point[]).map(pt => [pt.x, pt.y]);
    }
    if (hasOwn(sample, 'lat') && hasOwn(sample, 'lng')) {
        return (points as LatLngObj[]).map(pt => [pt.lat, pt.lng]);
    }
    throw new Error("Points are not in an expected format")
}

export interface InsertOptions {
    /**
     * What to do if a duplicate key is found.
     */
    onDuplicateKey?: DuplicateKey
    /**
     * Ignore all errors.
     */
    ignore?: boolean
}

const EMPTY_OBJECT: Record<string,any> = Object.freeze({__proto__:null})

export enum DuplicateKey {
    /** Don't insert duplicate records. */
    IGNORE = 'ignore',
    /** Update record with new values. */
    UPDATE = 'update',
}

// https://stackoverflow.com/questions/65976300/how-to-properly-extend-a-record
type Columns<T> = keyof T & string
type TableSchema<T> = Record<Columns<T>, Value>
// type TableSchema<T> = {[P in keyof T]?: Value}
type AnySchema = Record<string, Value>
type ColumnValueTuple<T> = [column: Columns<T>|ColumnId, value: Value]
type InsertData<T extends TableSchema<T>> =  T|ColumnValueTuple<T>[]


function getFields<T extends TableSchema<T>>(o: T) {
    return Object.keys(o).filter(k => (o as any)[k] !== undefined) as Array<keyof T & string>
}


// interface ObjectConstructor {
//     keys<T extends object>(o: T): Array<keyof T & string>
// }

const TRUE_SQL = sql`1`
const FALSE_SQL = sql`0`

export namespace sql {
    export function set<T extends TableSchema<T>>(fields: InsertData<T>): SqlFrag {
        if(Array.isArray(fields)) {
            const filteredFields = fields.filter(p => p[1] !== undefined)
            if(!filteredFields.length) throw new Error("No fields defined")
            return frag(
                filteredFields
                    .map(f => `${_escapeIdStrict(f[0])}=${_escapeValue(f[1] as Value)}`)
                    .join(', ')
            );
        }
        const filteredFields = getFields(fields)
        if(!filteredFields.length) throw new Error("No fields defined")
        return frag(
            filteredFields
                .map(fieldName => `${_escapeIdLoose(fieldName)}=${_escapeValue((fields as AnySchema)[fieldName])}`)
                .join(', ')
        );
    }
    export function insert<T extends TableSchema<T>>(table: TableId, data: InsertData<T>, options: InsertOptions=EMPTY_OBJECT): SqlFrag {
        let q = sql`INSERT ${frag(options.ignore ? 'IGNORE ' : '')}INTO ${escapeIdStrictFrag(table)} SET ${sql.set(data)}`;

        if (options.onDuplicateKey === DuplicateKey.IGNORE) {
            let firstCol: Id;
            if (Array.isArray(data)) {
                firstCol = data[0][0]
            } else {
                firstCol = Object.keys(data)[0];
            }
            const escCol = frag(_escapeIdLoose(firstCol));
            q = sql`${q} ON DUPLICATE KEY UPDATE ${escCol}=${escCol}`;
        } else if(options.onDuplicateKey === DuplicateKey.UPDATE) {
            let cols: Id[];
            if(Array.isArray(data)) {
                cols = data.map(f => f[0] as ColumnId);
            } else {
                cols = getFields(data);
            }
            q = sql`${q} ON DUPLICATE KEY UPDATE ${cols.map(col =>{
                const escCol = frag(_escapeIdLoose(col));
                return sql`${escCol}=VALUES(${escCol})`
            })}`;
        }
        return q;
    }
    // TODO: bulkInsert
    // TODO: update?

    export function alias(fields: Record<string, ColumnId>|Array<[column:ColumnId,alias:string]>): SqlFrag {
        if(Array.isArray(fields)) {
            return frag(fields.map(f => `${_escapeIdStrict(f[0])} AS ${_escapeIdStrict(f[1])}`).join(', '));
        }
        return frag(getFields(fields).map(alias => `${_escapeIdStrict(fields[alias])} AS ${_escapeIdStrict(alias)}`).join(', '));
    }
    export function raw(sqlString: string | SqlFrag): SqlFrag {
        if (isFrag(sqlString)) return sqlString;
        return frag(sqlString);
    }
    // export function timestamp(value: moment.MomentInput, outputTimezone?: string | null, inputTimezone?: string | null, fsp?: number | null): SqlFrag {
    //     // https://dev.mysql.com/doc/refman/5.7/en/date-and-time-literals.html
    //     // https://momentjs.com/docs/#/displaying/format/
    //     const date = makeMoment(value, outputTimezone, inputTimezone);
    //     let frac = '';
    //     if (fsp != null) {
    //         if (fsp < 0 || fsp > 6) {
    //             // https://dev.mysql.com/doc/refman/8.0/en/date-and-time-type-overview.html
    //             throw new Error(`fsp out of range: ${fsp}`);
    //         } else if (fsp > 0) {
    //             frac = '.' + 'S'.repeat(fsp);
    //         }
    //     } else if (date.milliseconds() !== 0) {
    //         frac = '.SSS';
    //     }
    //
    //     return raw(`TIMESTAMP'${date.format(`YYYY-MM-DD HH:mm:ss${frac}`)}'`)
    // }
    export function point(x: number, y: number): SqlFrag  {
        return sql`PointFromText(${`POINT(${x} ${y})`})`;
    }
    // export function polygon(points: PointArray, autoComplete = true): SqlFrag  {
    //     // https://dev.mysql.com/doc/refman/5.7/en/gis-data-formats.html
    //     // https://en.wikipedia.org/wiki/Well-known_text_representation_of_geometry#Well-known_binary
    //     if (!points.length) throw new Error("Cannot create an empty polygon");
    //     points = pointPairs(points);
    //     if (autoComplete) {
    //         const l = points.length - 1;
    //         if (!(points[0][0] === points[l][0] && points[0][1] === points[l][1])) {
    //             points.push([points[0][0], points[0][1]]);
    //         }
    //     }
    //     return sql`PolyFromText(${`POLYGON((${
    //         points.map(([x, y]) => `${x} ${y}`).join(',')
    //     }))`})`;
    // }
    export function id(id: Id): SqlFrag {
        return escapeIdStrictFrag(id)
    }
    /** @deprecated */
    export function db(id: LooseDatabaseId): SqlFrag {
        return escapeIdStrictFrag(id)
    }
    /** @deprecated */
    export function tbl(id: LooseTableId): SqlFrag {
        return escapeIdStrictFrag(id)
    }
    /** @deprecated */
    export function col(id: LooseColumnId): SqlFrag {
        return escapeIdStrictFrag(id)
    }
    export function cols(...columns: Array<ColumnId>): SqlFrag {
        // TODO: make this even stricter? use max array len of 3
        return frag(columns.map(_escapeIdStrict).join(', '))
    }
    /** @deprecated */
    export function columns(columns: Array<ColumnId>): SqlFrag {
        return frag(columns.map(_escapeIdStrict).join(', '))
    }
    export function values(values: Value[][]): SqlFrag {
        return frag(values.map(row => `(${row.map(_escapeValue).join(',')})`).join(',\n'))
    }
}
