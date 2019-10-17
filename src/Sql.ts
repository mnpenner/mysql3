import * as SqlString from 'sqlstring';
import * as moment from 'moment-timezone';

const ID_GLOBAL_REGEXP    = /`/g;
const QUAL_GLOBAL_REGEXP  = /\./g;

class _SqlFrag {
    constructor(readonly sql: string){}

    toString() {
        return this.sql;
    }
}

export function fields(fields:Record<string,string>): _SqlFrag {
    return raw(Object.keys(fields).map(fieldName => `${_escapeIdLoose(fieldName)} AS ${_escapeIdStrict(fields[fieldName])}`).join(', '));
}

export function escapeId(id:string|string[]|_SqlFrag): _SqlFrag {
    if(id instanceof _SqlFrag) return id;
    if(Array.isArray(id)) {
        return raw(id.map(_escapeIdStrict).join('.'));
    }
    return raw(_escapeIdStrict(id));
}

function _escapeIdLoose(id: string): string {
    return '`' + String(id).replace(ID_GLOBAL_REGEXP, '``').replace(QUAL_GLOBAL_REGEXP, '`.`') + '`';
}

function _escapeIdStrict(id: string): string {
    return '`' + String(id).replace(ID_GLOBAL_REGEXP, '``') + '`';
}

export function sql(strings: TemplateStringsArray, ...values: any[]): _SqlFrag {
    let out = [];
    let i = 0;
    for(; i<values.length; ++i) {
        out.push(strings.raw[i]);
        if(values[i] instanceof _SqlFrag) {
            out.push(String(values[i]));
        } else {
            out.push(SqlString.escape(values[i]));
        }
    }
    out.push(strings.raw[i]);
    return raw(out.join(''));
}


export function raw(sqlString: string|_SqlFrag): _SqlFrag {
    if(sqlString instanceof _SqlFrag) return sqlString;
    return new _SqlFrag(sqlString);
}

export function date(value: Date|string|number|moment.Moment, outputTimezone?: string, inputTimezone?: string): _SqlFrag {
    // https://dev.mysql.com/doc/refman/5.7/en/date-and-time-literals.html
    const d = inputTimezone ? moment.tz(value, inputTimezone) : moment(value);
    if(outputTimezone) d.tz(outputTimezone);
    return raw(`DATE '${d.format('YYYY-MM-DD')}'`)
}

type nil = null|undefined;

export function timestamp(value: moment.MomentInput, outputTimezone?: string|null, inputTimezone?: string|null, fsp?: number|null): _SqlFrag {
    // https://dev.mysql.com/doc/refman/5.7/en/date-and-time-literals.html
    // https://momentjs.com/docs/#/displaying/format/
    let d;
    if(inputTimezone) {
        const zone = moment.tz.zone(inputTimezone);
        if(!zone) throw new Error(`Invalid input timezone: ${inputTimezone}`);
        d = moment.tz(value, zone.name);
    } else {
        d = moment(value);
    }
    if(!d.isValid()) {
        throw new Error(`Input date is not valid`);
    }
    if(outputTimezone) {
        const zone = moment.tz.zone(outputTimezone);
        if(!zone) throw new Error(`Invalid output timezone: ${outputTimezone}`);
        d.tz(zone.name)
    }
    let frac = '';
    if(fsp != null) {
        if(fsp < 0 || fsp > 6) {
            // https://dev.mysql.com/doc/refman/8.0/en/date-and-time-type-overview.html
            throw new Error(`fsp out of range: ${fsp}`);
        } else if(fsp > 0) {
            frac = '.' + 'S'.repeat(fsp);
        }
    } else if(d.milliseconds() !== 0) {
        frac = '.SSS';
    }

    return raw(`TIMESTAMP'${d.format(`YYYY-MM-DD HH:mm:ss${frac}`)}'`)
}
