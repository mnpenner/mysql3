import * as moment from 'moment-timezone';

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


export function selectAs(fields: Record<string, string>): SqlFrag {
    return new SqlFrag(Object.keys(fields).map(fieldName => `${_escapeIdLoose(fieldName)} AS ${_escapeIdStrict(fields[fieldName])}`).join(', '));
}

export function set(fields: Record<string, Value>): SqlFrag {
    return new SqlFrag(Object.keys(fields).map(fieldName => `${_escapeIdLoose(fieldName)}=${escapeValue(fields[fieldName]).toSqlString()}`).join(', '));
}

export function escapeId(id: Id): SqlFrag {
    if (id instanceof SqlFrag) return id;
    if (Array.isArray(id)) {
        return new SqlFrag(id.map(_escapeIdStrict).join('.'));
    }
    return new SqlFrag(_escapeIdStrict(id));
}

export function escapeValue(value: Value): SqlFrag {
    if (value instanceof SqlFrag) return value;
    return new SqlFrag(_escapeValue(value));
}

function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export function escapeLike(value: string, escChar:string = '\\'): string {
    if(escChar.length !== 1 || escChar === '%' || escChar === '_') throw new Error("Bad escape char");
    return value.replace(new RegExp(`[%_${escapeRegExp(escChar)}]`,'g'), m => escChar + m);
}

function _escapeValue(value: UnescapedValue) {
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
    return "'" + value.replace(CHARS_REGEX,m => CHARS_ESCAPE_MAP[m]) + "'";

    return "'" + Array.from(value).map(ch => {
        const cp = ch.codePointAt(0);
        if(cp === undefined) throw new Error("Bad codepoint");
        switch(cp) {
            // https://dev.mysql.com/doc/refman/8.0/en/string-literals.html
            case 0x00: return "\\0";
            case 0x27: return "''";
            case 0x08: return '\\b';
            case 0x0A: return '\\n';
            case 0x0D: return '\\r';
            case 0x09: return '\\t';
            case 0x1A: return '\\Z';
            case 0x5C: return '\\\\';
        }
        return ch;
    }).join('') + "'";
}

function _escapeIdLoose(id: string): string {
    return '`' + String(id).replace(ID_GLOBAL_REGEXP, '``').replace(QUAL_GLOBAL_REGEXP, '`.`') + '`';
}

function _escapeIdStrict(id: string): string {
    return '`' + String(id).replace(ID_GLOBAL_REGEXP, '``') + '`';
}

type UnescapedValue = string | number | Buffer | bigint | boolean | null;
type Value = UnescapedValue|SqlFrag;
type UnescapedId = string|[string]|[string,string]|[string,string,string];
type Id = UnescapedId|SqlFrag;


export function sql(strings: TemplateStringsArray, ...values: Value[]): SqlFrag {
    let out = [];
    let i = 0;
    for (; i < values.length; ++i) {
        out.push(strings.raw[i], escapeValue(values[i]).toSqlString());
    }
    out.push(strings.raw[i]);
    return new SqlFrag(out.join(''));
}


export function raw(sqlString: string | SqlFrag): SqlFrag {
    if (sqlString instanceof SqlFrag) return sqlString;
    return new SqlFrag(sqlString);
}

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

export function point(x: number, y: number): SqlFrag  {
    return sql`PointFromText(${`POINT(${x} ${y})`})`;
}

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
