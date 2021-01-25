export {createPool} from './connection'
export {sql} from './sql'
export type {ConnectionPool} from './connection'

// import {ConnectionPool, createPool} from './connection'
// import {sql} from './sql'
//
// async function main(pool: ConnectionPool) {
//     const result = await pool.value(sql`select now()`)
//     console.log(result)
// }
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
