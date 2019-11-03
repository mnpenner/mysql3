import credentials = require('./secret.json');
import {ConnectionPool, sql,raw} from "../src";
import * as util from 'util';
import * as mysql from "../src";
import * as crypto from 'crypto';



async function main(args: string[]) {

    const pool = new ConnectionPool({
        ...credentials,
        printQueries: true,
    });

    dump(await pool.query(sql`select * from _test`));
    // dump(await pool.query(sql`select * from zones`));
    dump(await pool.query(sql`select '💩', ${"💩"}`));
    dump(await pool.query(sql`set character_set_results='utf8mb4'`));
    dump(await pool.query(sql`select '💩', ${"💩"}`));
    // dump(results);

    // testInject(pool);

    // const badString = "'foo\\0''\"\\b\\n\\r\\t\\Z\\\\%_\v\fbar'";
    // const result = await pool.query(sql`select ${badString} as x`) as any[];
    // dump(result);
    // dump(result[0].x === badString);

    try {
        await pool.transaction(async conn => {
            await conn.query(sql`insert into _test set str='a', bool=1`)
            await conn.query(sql`insert into _test set str='b', bool='donkey'`)
        })
    } catch(err) {
        console.error('Transaction failed: ',err.message);
    }



    await pool.close();
}

async function testStrings(pool:ConnectionPool) {
    for(;;) {
        const buf = crypto.randomBytes(100);
        const str = buf.toString('utf8');
        const result = await pool.query(sql`select ${str} as x`) as any[];
        if(result[0].x !== str) {
            throw new Error(`Bad match: ${buf.toString('hex')}`);
        }
    }
}

async function testInject(pool:ConnectionPool) {
    for(const charset of ['cp932','sjis']) {
        // https://stackoverflow.com/a/36082818/65387
        await pool.query(sql`SET NAMES ${raw(charset)}`);
        await pool.query(sql`CREATE TABLE _inject (bar VARCHAR(16) CHARSET ${raw(charset)} NOT NULL)`);
        await pool.query(sql`INSERT INTO _inject (bar) VALUES ('baz'), ('qux')`);
        const input =  "\x81\x27 OR 1=1 #";
        try {
            const result = await pool.query(sql`SELECT * FROM _inject WHERE bar = ${input} LIMIT 1`) as any[];
            dump(result);
            if (result.length) throw new Error("Injection detected!")
        }finally {
            await pool.query(sql`DROP TABLE _inject`);
        }
    }
}


main(process.argv).catch(err => {
    console.error(err);
    process.exit(1);
})


function dump(...args: any[]) {
    console.log(...args.map(a => util.inspect(a, {colors: true, depth: 10, maxArrayLength: 1000})));
}
