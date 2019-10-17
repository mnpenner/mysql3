import 'mocha';
import { expect } from 'chai';
import * as sql from './Sql';
import * as moment from 'moment';

describe('fields', () => {
    it('should escape fields', () => {
        expect(String(sql.fields({
            'aa': 'bb',
            'cc.dd': 'ee.ff',
        }))).to.equal('`aa` AS `bb`, `cc`.`dd` AS `ee.ff`');
    });
});

describe('timestamp', () => {
    it('handle timezones', () => {
        expect(String(sql.timestamp('2019-10-15 17:12:34'))).to.equal(`TIMESTAMP'2019-10-15 17:12:34'`);
        expect(String(sql.timestamp(1571184754000,'UTC'))).to.equal(`TIMESTAMP'2019-10-16 00:12:34'`);
        expect(String(sql.timestamp('2019-10-15 17:12:34','UTC','UTC'))).to.equal(`TIMESTAMP'2019-10-15 17:12:34'`);
        expect(String(sql.timestamp('2019-10-15 17:12:34','UTC','America/Vancouver'))).to.equal(`TIMESTAMP'2019-10-16 00:12:34'`);
        expect(String(sql.timestamp(1571184754000,'America/Vancouver'))).to.equal(`TIMESTAMP'2019-10-15 17:12:34'`);
        expect(String(sql.timestamp('2019-10-15 17:12:34','America/Toronto','America/Vancouver'))).to.equal(`TIMESTAMP'2019-10-15 20:12:34'`);
        expect(String(sql.timestamp('2019-10-16T08:32:55.520Z','UTC','Atlantic/Faroe'))).to.equal(`TIMESTAMP'2019-10-16 08:32:55.520'`);
    });

    it('supports Date objects', () => {
        expect(String(sql.timestamp(new Date('2019-10-16T08:32:55.520Z'),'UTC'))).to.equal(`TIMESTAMP'2019-10-16 08:32:55.520'`);
    });

    it('supports Moment objects', () => {
        expect(String(sql.timestamp(moment('2019-10-16T08:32:55.520Z'),'UTC'))).to.equal(`TIMESTAMP'2019-10-16 08:32:55.520'`);
        expect(String(sql.timestamp(moment.tz('2019-10-15 17:12:34','America/Vancouver'),'America/Toronto','Atlantic/Faroe'))).to.equal(`TIMESTAMP'2019-10-15 20:12:34'`);
    });

    it('to throw for invalid timezones', () => {
        expect(() => sql.timestamp('2019-10-15 17:12:34','n0t_Re4L')).to.throw("Invalid output timezone: n0t_Re4L");
        expect(() => sql.timestamp('2019-10-15 17:12:34','UTC','n0t_Re4L')).to.throw("Invalid input timezone: n0t_Re4L");
        expect(() => sql.timestamp(new Date("gArBaGe^%&"))).to.throw("Input date is not valid");
        expect(() => sql.timestamp(1234567890123,'America/Godthab','Australia/Eucla',7)).to.throw("fsp out of range")
    })

    it('handle fractional seconds', () => {
        expect(String(sql.timestamp('2019-10-15T17:12:34.567'))).to.equal(`TIMESTAMP'2019-10-15 17:12:34.567'`);
        expect(String(sql.timestamp(1234567890123,'America/Godthab'))).to.equal(`TIMESTAMP'2009-02-13 20:31:30.123'`);
        expect(String(sql.timestamp(1234567890123,'America/Godthab','Australia/Eucla',0))).to.equal(`TIMESTAMP'2009-02-13 20:31:30'`);
        expect(String(sql.timestamp(1234567890199,'America/Godthab','Australia/Eucla',1))).to.equal(`TIMESTAMP'2009-02-13 20:31:30.1'`); // No rounding. Not sure if this is good or bad.
        expect(String(sql.timestamp(1234567890123,'America/Godthab',null,6))).to.equal(`TIMESTAMP'2009-02-13 20:31:30.123000'`);
    });
});
