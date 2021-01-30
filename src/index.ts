export {createPool} from './connection'
export {sql} from './sql'
export type {ConnectionPool} from './connection'

import {ConnectionPool, createPool} from './connection'
import {sql} from './sql'

// async function main(pool: ConnectionPool) {
//     // const result = await pool.transaction([
//     //     sql`select now()`,
//     //     sql`select 1+1 as ans`,
//     // ])
//     // console.dir(result, {depth: 2})
//
//     // console.log(sql`insert into foo(bar, baz)
//     //                 values ${sql.values([
//     //                     [1, "qu'ux"],
//     //                     [2, null],
//     //                 ])}`.toSqlString())
//
//     const res = await pool.count(sql`select * from images`)
//     console.log(res)
// }
//
//
// createPool({
//     host: process.env.DB_HOST,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME,
// }).then(pool => main(pool).finally(pool.close)).catch(err => {
//     console.error(err)
//     process.exit(1)
// })
