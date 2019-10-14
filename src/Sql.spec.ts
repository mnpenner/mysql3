import 'mocha';
import { expect } from 'chai';
import * as sql from './Sql';


describe('fields', () => {
    it('should escape fields', () => {
        expect(String(sql.fields({
            'aa': 'bb',
            'cc.dd': 'ee.ff',
        }))).to.equal('`aa` AS `bb`, `cc`.`dd` AS `ee.ff`');
    });
});
