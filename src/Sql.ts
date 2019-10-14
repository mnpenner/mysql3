import * as SqlString from 'sqlstring';

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

export function date(value: Date|string|number, timezone?: string): _SqlFrag {

}
