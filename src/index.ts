export {createPool} from './connection'
export {sql,DuplicateKey,_escapeValue as escapeValue,_escapeIdLoose as escapeIdLoose, _escapeIdStrict as escapeIdStrict} from './sql'
export type {ConnectionPool} from './connection'
export type {PoolConfig} from 'mariadb'




// import {ConnectionPool, createPool} from './connection'
// import {sql,DuplicateKey} from './sql'
//
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
//     // const res = await pool.count(sql`select * from images`)
//     // console.log(res)
//
//     const imgQuery = sql`select * from images limit 100`
//     const count = await pool.count(imgQuery)
//     let i=0;
//     for await(const img of pool.stream<{starred:boolean|null,date_taken_local:Date|null}>(imgQuery)) {
//         console.log(`${++i}/${count}`,img.date_taken_local)
//     }
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
