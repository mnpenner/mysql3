import moment from 'moment-timezone';

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

function isSafe(x: any): x is SqlFrag {
    return x instanceof SqlFrag;
}

/**
 * @deprecated
 */
export function raw(...args: Parameters<typeof sql.raw>) {
    return sql.raw(...args);
}

/**
 * @deprecated Use sql.as instead.
 */
export function selectAs(fields: Record<string, string>): SqlFrag {
    return new SqlFrag(Object.keys(fields).map(fieldName => `${_escapeIdLoose(fieldName)} AS ${_escapeIdStrict(fields[fieldName])}`).join(', '));
}

/**
 * @deprecated
 */
export function set(...args: Parameters<typeof sql.set>) {
    return sql.set(...args);
}

/**
 * @deprecated
 */
export function timestamp(...args: Parameters<typeof sql.timestamp>) {
    return sql.timestamp(...args);
}

/**
 * @deprecated
 */
export function point(...args: Parameters<typeof sql.point>) {
    return sql.point(...args);
}

/**
 * @deprecated
 */
export function polygon(...args: Parameters<typeof sql.polygon>) {
    return sql.polygon(...args);
}

export function escapeValue(value: Value): SqlFrag {
    if (isSafe(value)) return value;
    return new SqlFrag(_escapeValue(value));
}

function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export function escapeLike(value: string, escChar:string = '\\'): string {
    if(escChar.length !== 1 || escChar === '%' || escChar === '_') throw new Error("Bad escape char");
    return value.replace(new RegExp(`[%_${escapeRegExp(escChar)}]`,'g'), m => escChar + m);
}

function _escapeValue(value: Value): string {
    if (isSafe(value)) {
        return value.toSqlString();
    }
    if(Array.isArray(value)) {
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
    throw new Error("Unsupported value type")
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

function _escapeString(value: string): string {
    return "'" + String(value).replace(CHARS_REGEX,m => CHARS_ESCAPE_MAP[m]) + "'";
}

export function escapeId(id: Id): SqlFrag {
    if (isSafe(id)) return id;
    if (Array.isArray(id)) return new SqlFrag(id.map(_escapeIdStrict).join('.'));
    return new SqlFrag(_escapeIdStrict(id));
}

function _escapeIdLoose(id: Id): string {
    if(isSafe(id)) return id.toSqlString();
    if(Array.isArray(id)) return id.map(_escapeIdStrict).join('.');
    return '`' + String(id).replace(ID_GLOBAL_REGEXP, '``').replace(QUAL_GLOBAL_REGEXP, '`.`') + '`';
}

function _escapeIdStrict(id: Id): string {
    if(isSafe(id)) return id.toSqlString();
    if(Array.isArray(id)) return id.map(_escapeIdStrict).join('.');
    return '`' + String(id).replace(ID_GLOBAL_REGEXP, '``') + '`';
}

type SingleUnescapedValue = string | number | Buffer | bigint | boolean | null;
type UnescapedValue = SingleUnescapedValue|SingleUnescapedValue[]
type SingleValue = SingleUnescapedValue|SqlFrag
type Value = SingleValue|SingleValue[];
type UnescapedId = string|[string]|[string,string]|[string,string,string];
type Id = UnescapedId|SqlFrag;

export function date(value: Date | string | number | moment.Moment, outputTimezone?: string, inputTimezone?: string): SqlFrag {
    // https://dev.mysql.com/doc/refman/5.7/en/date-and-time-literals.html
    const date = makeMoment(value, outputTimezone, inputTimezone);
    return new SqlFrag(`DATE'${date.format('YYYY-MM-DD')}'`)
}

type nil = null | undefined;

function makeMoment(value: moment.MomentInput, outputTimezone?: string | null, inputTimezone?: string | null): moment.Moment {
    let d;
    if (inputTimezone) {
        const zone = moment.tz.zone(inputTimezone);
        if (!zone) throw new Error(`Invalid input timezone: ${inputTimezone}`);
        d = moment.tz(value, zone.name);
    } else {
        d = moment(value);
    }
    if (!d.isValid()) {
        throw new Error(`Input date is not valid`);
    }
    if (outputTimezone) {
        const zone = moment.tz.zone(outputTimezone);
        if (!zone) throw new Error(`Invalid output timezone: ${outputTimezone}`);
        d.tz(zone.name)
    }
    return d;
}

interface Point {
    x: number
    y: number
}

interface LatLng {
    lat: number
    lng: number
}

type NumberPair = [number, number]
type PointArray = NumberPair[] | Point[] | LatLng[]

function hasOwn(obj: object, key: PropertyKey) {
    return Object.prototype.hasOwnProperty.call(obj, key);
}

function toPairs(points: PointArray): NumberPair[] {
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


/**
 * @deprecated Experimental.
 */
export enum IntervalUnit {
    // https://dev.mysql.com/doc/refman/8.0/en/expressions.html
    MICROSECOND = 'MICROSECOND',
    MILLISECOND = 'MILLISECOND',
    SECOND = 'SECOND',
    MINUTE = 'MINUTE',
    HOUR = 'HOUR',
    DAY = 'DAY',
    WEEK = 'WEEK',
    MONTH = 'MONTH',
    QUARTER = 'QUARTER',
    YEAR = 'YEAR',
    // TODO: support the other compound types.
}

/**
 * @deprecated Experimental.
 */
export function interval(value:number, unit:IntervalUnit=IntervalUnit.MILLISECOND): SqlFrag {
    // https://dev.mysql.com/doc/refman/8.0/en/expressions.html
    if(unit === IntervalUnit.MILLISECOND) {
        // Millisecond doesn't actually exist in MySQL for some reason.
        value *= 1000
        unit = IntervalUnit.MICROSECOND;
    }
    // Intervals appear to be rounded in MySQL
    // SELECT TIME'12:00:00' + INTERVAL 1.5 HOUR -- 14:00:00
    return new SqlFrag(`INTERVAL ${Math.round(value)} ${unit}`);
}

export function sql(strings: TemplateStringsArray, ...values: Value[]): SqlFrag {
    let out = [];
    let i = 0;
    for (; i < values.length; ++i) {
        out.push(strings.raw[i], escapeValue(values[i]).toSqlString());
    }
    out.push(strings.raw[i]);
    return new SqlFrag(out.join(''));
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
    export function timestamp(value: moment.MomentInput, outputTimezone?: string | null, inputTimezone?: string | null, fsp?: number | null): SqlFrag {
        // https://dev.mysql.com/doc/refman/5.7/en/date-and-time-literals.html
        // https://momentjs.com/docs/#/displaying/format/
        const date = makeMoment(value, outputTimezone, inputTimezone);
        let frac = '';
        if (fsp != null) {
            if (fsp < 0 || fsp > 6) {
                // https://dev.mysql.com/doc/refman/8.0/en/date-and-time-type-overview.html
                throw new Error(`fsp out of range: ${fsp}`);
            } else if (fsp > 0) {
                frac = '.' + 'S'.repeat(fsp);
            }
        } else if (date.milliseconds() !== 0) {
            frac = '.SSS';
        }

        return new SqlFrag(`TIMESTAMP'${date.format(`YYYY-MM-DD HH:mm:ss${frac}`)}'`)
    }
    export function point(x: number, y: number): SqlFrag  {
        return sql`PointFromText(${`POINT(${x} ${y})`})`;
    }
    export function polygon(points: PointArray, autoComplete = true): SqlFrag  {
        // https://dev.mysql.com/doc/refman/5.7/en/gis-data-formats.html
        // https://en.wikipedia.org/wiki/Well-known_text_representation_of_geometry#Well-known_binary
        if (!points.length) throw new Error("Cannot create an empty polygon");
        points = toPairs(points);
        if (autoComplete) {
            const l = points.length - 1;
            if (!(points[0][0] === points[l][0] && points[0][1] === points[l][1])) {
                points.push([points[0][0], points[0][1]]);
            }
        }
        return sql`PolyFromText(${`POLYGON((${
            points.map(([x, y]) => `${x} ${y}`).join(',')
        }))`})`;
    }

}
