import credentials = require('./secret.json');
import {ConnectionPool} from "../src";
import * as mysql from "../src";




async function main(args: string[]) {



    const pool = new ConnectionPool(credentials);

    const results = await pool.query("select * from zones");
    console.log(results);

    await pool.close();
}


main(process.argv).catch(err => {
    console.error(err);
    process.exit(1);
})
