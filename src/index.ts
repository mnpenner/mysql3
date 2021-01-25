export {createPool} from './connection'
export {sql} from './sql'



import {createPool} from './connection'
import {sql} from './sql'
(async () => {
    const pool = await createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    })

    // console.log(pool.activeConnections,pool.totalConnections,pool.idleConnections,pool.taskQueueSize)

    const result = await pool.value(sql`select now()`)

    console.log(result)



        await pool.close()


})()
