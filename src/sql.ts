


type SingleUnescapedValue = string | number | Buffer | bigint | boolean | null;
type UnescapedValue = SingleUnescapedValue|SingleUnescapedValue[]
type SingleValue = SingleUnescapedValue|SqlFrag
type Value = SingleValue|SingleValue[];
type DatabaseId = string|[string]
type TableId = string|[string]|[string,string]
type ColumnId =  string|[string]|[string,string]|[string,string,string];
type UnescapedId = ColumnId;
type Id = UnescapedId|SqlFrag;
type NumberPair = [number, number]
type PointArray = NumberPair[] | Point[] | LatLng[]

interface Point {
    x: number
    y: number
}

interface LatLng {
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

export function escapeValue(value: Value): SqlFrag {
    if (isFrag(value)) return value;
    return new SqlFrag(_escapeValue(value));
}

export function isFrag(x: any): x is SqlFrag {
    return x instanceof SqlFrag;
}


export function sql(strings: TemplateStringsArray, ...values: Value[]): SqlFrag {
    let out = [];
    let i = 0;
    for (; i < values.length; ++i) {
        out.push(strings[i], escapeValue(values[i]).toSqlString());
    }
    out.push(strings[i]);
    return new SqlFrag(out.join(''));
}


function _escapeValue(value: Value): string {
    if (isFrag(value)) {
        return value.toSqlString();
    }
    if(Array.isArray(value)) {
        if(!value.length) return '/*empty*/NULL'
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
    throw new Error(`Unsupported value type: ${value}`)
}

function hasOwn(obj: object, key: PropertyKey) {
    return Object.prototype.hasOwnProperty.call(obj, key);
}


function _escapeString(value: string): string {
    return "'" + String(value).replace(CHARS_REGEX,m => CHARS_ESCAPE_MAP[m]) + "'";
}

export function escapeId(id: Id): SqlFrag {
    if (isFrag(id)) return id;
    if (Array.isArray(id)) return new SqlFrag(id.map(_escapeIdStrict).join('.'));
    return new SqlFrag(_escapeIdStrict(id));
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



function pointPairs(points: PointArray): NumberPair[] {
    if (!points.length) return [];
    const sample = points[0];
    if (Array.isArray(sample) && sample.length === 2) {
        return [...points] as NumberPair[];
    }
    if (hasOwn(sample, 'x') && hasOwn(sample, 'y')) {
        return (points as Point[]).map(pt => [pt.x, pt.y]);
    }
    if (hasOwn(sample, 'lat') && hasOwn(sample, 'lng')) {
        return (points as LatLng[]).map(pt => [pt.lat, pt.lng]);
    }
    throw new Error("Points are not in an expected format")
}

export interface InsertOptions {
    /**
     * Ignore duplicate records.
     */
    ignoreDupes?: boolean
    updateOnDupe?: boolean
    ignore?: boolean
}


export namespace sql {
    export function set(fields: Record<string, Value>|Array<[Id,Value]>): SqlFrag {
        if(Array.isArray(fields)) {
            return new SqlFrag(fields.map(f => `${escapeId(f[0]).toSqlString()}=${escapeValue(f[1]).toSqlString()}`).join(', '));
        }
        return new SqlFrag(Object.keys(fields).map(fieldName => `${_escapeIdLoose(fieldName)}=${escapeValue(fields[fieldName]).toSqlString()}`).join(', '));
    }
    export function insert<Schema extends object=Record<string, Value>>(table: Id, data: Partial<Schema>|Array<[Id,Value]>, options?: InsertOptions): SqlFrag {
        let q = sql`INSERT ${sql.raw(options?.ignore ? 'IGNORE ' : '')}INTO ${escapeId(table)} SET ${sql.set(data as any)}`;
        if (options?.ignoreDupes) {
            if(options?.updateOnDupe) {
                throw new Error("`ignoreDupes` and `updateOnDupe` are incompatible")
            }
            let firstCol: Id;
            if (Array.isArray(data)) {
                firstCol = data[0][0];
            } else {
                firstCol = Object.keys(data)[0];
            }
            const escCol = new SqlFrag(_escapeIdLoose(firstCol));
            q = sql`${q} ON DUPLICATE KEY UPDATE ${escCol}=VALUES(${escCol})`;
        }
        if(options?.updateOnDupe) {
            let cols: Id[];
            if(Array.isArray(data)) {
                cols = data.map(f => f[0]);
            } else {
                cols = Object.keys(data);
            }
            q = sql`${q} ON DUPLICATE KEY UPDATE ${cols.map(col =>{
                const escCol = new SqlFrag(_escapeIdLoose(col));
                return sql`${escCol}=VALUES(${escCol})`
            })}`;
        }
        return q;
    }

    export function as(fields: Record<string, Id>|Array<[Id,string]>): SqlFrag {
        if(Array.isArray(fields)) {
            return new SqlFrag(fields.map(f => `${escapeId(f[0]).toSqlString()} AS ${_escapeString(f[1])}`).join(', '));
        }
        return new SqlFrag(Object.keys(fields).map(alias => `${_escapeIdStrict(fields[alias])} AS ${_escapeString(alias)}`).join(', '));
    }
    export function raw(sqlString: string | SqlFrag): SqlFrag {
        if (sqlString instanceof SqlFrag) return sqlString;
        return new SqlFrag(sqlString);
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
    //     return new SqlFrag(`TIMESTAMP'${date.format(`YYYY-MM-DD HH:mm:ss${frac}`)}'`)
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
        return escapeId(id)
    }
    export function db(id: DatabaseId): SqlFrag {
        return escapeId(id)
    }
    export function tbl(id: TableId): SqlFrag {
        return escapeId(id)
    }
    export function col(id: ColumnId): SqlFrag {
        return escapeId(id)
    }
    export function columns(columns: Id[]): SqlFrag {
        return new SqlFrag(columns.map(_escapeIdStrict).join(', '))
    }
    export function values(values: Value[][]): SqlFrag {
        return new SqlFrag(values.map(row => `(${row.map(_escapeValue).join(',')})`).join(',\n'))
    }
}
