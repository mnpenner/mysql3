export {createPool} from './connection'
export {sql} from './sql'
export type {ConnectionPool} from './connection'

import {ConnectionPool, createPool} from './connection'
import {sql} from './sql'

async function main(pool: ConnectionPool) {
    const profileId = await pool.transaction(async conn => {
        const user = await conn.exec(sql.insert('users', {username: 'mpen'}))
        const profile = await conn.exec(sql.insert('profiles', {userId: user.insertId, name: 'Mark'}))
        return profile.insertId
    })
    console.log(profileId)
}

createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
}).then(pool => main(pool).finally(pool.close)).catch(err => {
    console.error(err)
    process.exit(1)
})
