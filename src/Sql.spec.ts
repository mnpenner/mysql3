import 'mocha';
import { expect } from 'chai';
import * as Sql from './Sql';
import * as moment from 'moment';
import {sql, IntervalUnit, SqlFrag} from "./Sql";


describe('escapeId', () => {
    it('strings', () => {
        expect(Sql.escapeId('foo').toSqlString()).to.equal('`foo`');
        expect(Sql.escapeId('foo.bar').toSqlString()).to.equal('`foo.bar`');
        expect(Sql.escapeId('foo`bar').toSqlString()).to.equal('`foo``bar`');

    });
    it('arrays', () => {
        expect(Sql.escapeId(['foo']).toSqlString()).to.equal('`foo`');
        expect(Sql.escapeId(['foo','bar']).toSqlString()).to.equal('`foo`.`bar`');
        expect(Sql.escapeId(['foo','bar','baz']).toSqlString()).to.equal('`foo`.`bar`.`baz`');
    })
});

describe('escapeValue', () => {
    it('strings', () => {
        expect(Sql.escapeValue('foo bar').toSqlString()).to.equal(`'foo bar'`);
        expect(Sql.escapeValue(`foo'bar`).toSqlString()).to.equal(`'foo''bar'`);
        expect(Sql.escapeValue(`foo\0bar`).toSqlString()).to.equal(`'foo\\0bar'`);
        expect(Sql.escapeValue(`foo\0'"\b\n\r\t\x1A\\%_\v\fbar`).toSqlString()).to.equal("'foo\\0''\"\\b\\n\\r\\t\\Z\\\\%_\v\fbar'");
    });
    it('buffers', () => {
        expect(Sql.escapeValue(Buffer.from([0x12,0xAB])).toSqlString()).to.equal(`x'12ab'`);
    });
    it('numbers', () => {
        expect(Sql.escapeValue(4).toSqlString()).to.equal(`4`);
        expect(Sql.escapeValue(3.14).toSqlString()).to.equal(`3.14`);
        expect(Sql.escapeValue(-9).toSqlString()).to.equal(`-9`);
        expect(Sql.escapeValue(2e300).toSqlString()).to.equal(`2e+300`);
    });
    it('bigints', () => {
        expect(Sql.escapeValue(18446744073709551616n).toSqlString()).to.equal(`18446744073709551616`);
        expect(Sql.escapeValue(-1n).toSqlString()).to.equal(`-1`);
    });
    it('booleans', () => {
        expect(Sql.escapeValue(true).toSqlString()).to.equal(`1`);
        expect(Sql.escapeValue(false).toSqlString()).to.equal(`0`);
    });
    it('null', () => {
        expect(Sql.escapeValue(null).toSqlString()).to.equal(`NULL`);
    });
});

describe('escapeLike', () => {
    it('strings', () => {
        expect(Sql.escapeLike('foo%bar')).to.equal(String.raw`foo\%bar`);
        expect(Sql.escapeLike('foo_bar')).to.equal(String.raw`foo\_bar`);
        expect(Sql.escapeLike('foo\\bar')).to.equal(String.raw`foo\\bar`);
        // SELECT 'G%' LIKE 'G!%'; -- 0
        // SELECT 'G%' LIKE 'G!%' ESCAPE '!'; -- 1
        expect(Sql.escapeLike('G%','!')).to.equal(String.raw`G!%`);
    });
});

describe('selectAs', () => {
    it('objects', () => {
        expect(Sql.selectAs({
            'aa': 'bb',
            'cc.dd': 'ee.ff',
        }).toSqlString()).to.equal('`aa` AS `bb`, `cc`.`dd` AS `ee.ff`');
    });
});

describe('set', () => {
    it('objects', () => {
        expect(Sql.set({
            'aa': 'bb',
            'cc.dd': 5,
        }).toSqlString()).to.equal("`aa`='bb', `cc`.`dd`=5");
    });
});


describe('timestamp', () => {
    it('handle timezones', () => {
        expect(Sql.timestamp('2019-10-15 17:12:34').toSqlString()).to.equal(`TIMESTAMP'2019-10-15 17:12:34'`);
        expect(Sql.timestamp(1571184754000,'UTC').toSqlString()).to.equal(`TIMESTAMP'2019-10-16 00:12:34'`);
        expect(Sql.timestamp('2019-10-15 17:12:34','UTC','UTC').toSqlString()).to.equal(`TIMESTAMP'2019-10-15 17:12:34'`);
        expect(Sql.timestamp('2019-10-15 17:12:34','UTC','America/Vancouver').toSqlString()).to.equal(`TIMESTAMP'2019-10-16 00:12:34'`);
        expect(Sql.timestamp(1571184754000,'America/Vancouver').toSqlString()).to.equal(`TIMESTAMP'2019-10-15 17:12:34'`);
        expect(Sql.timestamp('2019-10-15 17:12:34','America/Toronto','America/Vancouver').toSqlString()).to.equal(`TIMESTAMP'2019-10-15 20:12:34'`);
        expect(Sql.timestamp('2019-10-16T08:32:55.520Z','UTC','Atlantic/Faroe').toSqlString()).to.equal(`TIMESTAMP'2019-10-16 08:32:55.520'`);
    });

    it('supports Date objects', () => {
        expect(Sql.timestamp(new Date('2019-10-16T08:32:55.520Z'),'UTC').toSqlString()).to.equal(`TIMESTAMP'2019-10-16 08:32:55.520'`);
    });

    it('supports Moment objects', () => {
        expect(Sql.timestamp(moment('2019-10-16T08:32:55.520Z'),'UTC').toSqlString()).to.equal(`TIMESTAMP'2019-10-16 08:32:55.520'`);
        expect(Sql.timestamp(moment.tz('2019-10-15 17:12:34','America/Vancouver'),'America/Toronto','Atlantic/Faroe').toSqlString()).to.equal(`TIMESTAMP'2019-10-15 20:12:34'`);
    });

    it('to throw for invalid timezones', () => {
        expect(() => Sql.timestamp('2019-10-15 17:12:34','n0t_Re4L')).to.throw("Invalid output timezone: n0t_Re4L");
        expect(() => Sql.timestamp('2019-10-15 17:12:34','UTC','n0t_Re4L')).to.throw("Invalid input timezone: n0t_Re4L");
        expect(() => Sql.timestamp(new Date("gArBaGe^%&"))).to.throw("Input date is not valid");
        expect(() => Sql.timestamp(1234567890123,'America/Godthab','Australia/Eucla',7)).to.throw("fsp out of range")
    })

    it('handle fractional seconds', () => {
        expect(Sql.timestamp('2019-10-15T17:12:34.567').toSqlString()).to.equal(`TIMESTAMP'2019-10-15 17:12:34.567'`);
        expect(Sql.timestamp(1234567890123,'America/Godthab').toSqlString()).to.equal(`TIMESTAMP'2009-02-13 20:31:30.123'`);
        expect(Sql.timestamp(1234567890123,'America/Godthab','Australia/Eucla',0).toSqlString()).to.equal(`TIMESTAMP'2009-02-13 20:31:30'`);
        expect(Sql.timestamp(1234567890199,'America/Godthab','Australia/Eucla',1).toSqlString()).to.equal(`TIMESTAMP'2009-02-13 20:31:30.1'`); // No rounding. Not sure if this is good or bad.
        expect(Sql.timestamp(1234567890123,'America/Godthab',null,6).toSqlString()).to.equal(`TIMESTAMP'2009-02-13 20:31:30.123000'`);
    });
});

describe('timestamp', () => {
    it('handle timezones', () => {
        expect(Sql.date('2019-10-15 17:12:34').toSqlString()).to.equal(`DATE'2019-10-15'`);
        expect(Sql.date(1571184754000, 'UTC').toSqlString()).to.equal(`DATE'2019-10-16'`);
        expect(Sql.date('2019-10-15 17:12:34', 'UTC', 'UTC').toSqlString()).to.equal(`DATE'2019-10-15'`);
        expect(Sql.date('2019-10-15 17:12:34', 'UTC', 'America/Vancouver').toSqlString()).to.equal(`DATE'2019-10-16'`);
        expect(Sql.date(1571184754000, 'America/Vancouver').toSqlString()).to.equal(`DATE'2019-10-15'`);
        expect(Sql.date('2019-10-15 17:12:34', 'America/Toronto', 'America/Vancouver').toSqlString()).to.equal(`DATE'2019-10-15'`);
        expect(Sql.date('2019-10-16T08:32:55.520Z', 'UTC', 'Atlantic/Faroe').toSqlString()).to.equal(`DATE'2019-10-16'`);
    });
});

describe('polygon', () => {
    it('supports number pairs', () => {
        expect(Sql.polygon([[0,1],[2,3],[3,4],[0,1]]).toSqlString()).to.equal(`PolyFromText('POLYGON((0 1,2 3,3 4,0 1))')`);
    })

    it('supports points', () => {
        expect(Sql.polygon([{x:0,y:1},{x:2,y:3},{x:3,y:4},{x:0,y:1}]).toSqlString()).to.equal(`PolyFromText('POLYGON((0 1,2 3,3 4,0 1))')`);
    })

    it('supports latlng', () => {
        expect(Sql.polygon([{lat:0,lng:1},{lat:2,lng:3},{lat:3,lng:4},{lat:0,lng:1}]).toSqlString()).to.equal(`PolyFromText('POLYGON((0 1,2 3,3 4,0 1))')`);
    })

    it('throws for other types', () => {
        expect(() => Sql.polygon([{x:0,lng:1} as any]).toSqlString()).to.throw();
    })

    it('completes the polygon', () => {
        expect(Sql.polygon([[0,1],[2,3],[3,4]]).toSqlString()).to.equal(`PolyFromText('POLYGON((0 1,2 3,3 4,0 1))')`);
    })

    it('allows disabling autocomplete', () => {
        expect(Sql.polygon([[0,1],[2,3],[3,4]],false).toSqlString()).to.equal(`PolyFromText('POLYGON((0 1,2 3,3 4))')`);
    })
})

describe('point', () => {
    it('encodes points', () => {
        expect(Sql.point(4,3.14).toSqlString()).to.equal(`PointFromText('POINT(4 3.14)')`);
    })
})


describe('interval', () => {
    it('creates intervals', () => {
        expect(Sql.interval(1).toSqlString()).to.equal(`INTERVAL 1000 MICROSECOND`);
        expect(Sql.interval(1.234).toSqlString()).to.equal(`INTERVAL 1234 MICROSECOND`);
        expect(Sql.interval(5,IntervalUnit.HOUR).toSqlString()).to.equal(`INTERVAL 5 HOUR`);
    })
})

function expectSql(query: SqlFrag, result: string) {
    return expect(query.toSqlString()).to.equal(result);
}

describe('sql', () => {
    it('autoescapes values', () => {
        expect(sql`select ${4}`.toSqlString()).to.equal(`select 4`);
        expect(sql`select ${4n}`.toSqlString()).to.equal(`select 4`);
        expect(sql`select ${'foo'}`.toSqlString()).to.equal(`select 'foo'`);
        expect(sql`select ${Sql.escapeId('foo')}`.toSqlString()).to.equal('select `foo`');
        expect(sql`select ${Sql.escapeValue('foo')}`.toSqlString()).to.equal(`select 'foo'`);
        expect(sql`select ${Sql.raw('foo')}`.toSqlString()).to.equal('select foo');
        expect(sql`select ${Buffer.from([0x12,0xAB])}`.toSqlString()).to.equal(`select x'12ab'`);
        expect(sql`select ${Sql.selectAs({a:'b',c:'4'})}`.toSqlString()).to.equal("select `a` AS `b`, `c` AS `4`");
        // TODO arrays?? select * from t where x in (?)
    })

    it('prevents classical SQL injection', () => {
        // https://www.owasp.org/index.php/Testing_for_SQL_Injection_(OTG-INPVAL-005)
        const username = "1' or '1' = '1"
        const password = "1' or '1' = '1"
        expect(sql`SELECT * FROM Users WHERE Username=${username} AND Password=${password}`.toSqlString()).to.equal("SELECT * FROM Users WHERE Username='1'' or ''1'' = ''1' AND Password='1'' or ''1'' = ''1'");
    })

    // it("prevents Express SQL injection", () => {
    //     // https://github.com/mysqljs/mysql/issues/501
    //     const id = {id:'1'};
    //     expectSql(sql`SELECT * FROM users WHERE id = ${id}`,
    //         "SELECT * FROM users WHERE id = id = '1'");
    // })

    it("prevents Shift-JIS attack", () => {
        // https://stackoverflow.com/a/36082818/65387
        const input = "\x81\x27 OR 1=1 #";
        expectSql(sql`SELECT * FROM foo WHERE bar = ${input} LIMIT 1`,"SELECT * FROM foo WHERE bar = '\x81'' OR 1=1 #' LIMIT 1")
    });
})
