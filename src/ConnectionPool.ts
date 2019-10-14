import * as mysql from 'mysql';
import {PoolConfig,Pool} from "mysql";


export default class ConnectionPool {
    private pool: Pool;

    constructor(config: PoolConfig) {
        this.pool = mysql.createPool(config);
    }

    query(query: string) {
        return new Promise((resolve,reject) => {
            this.pool.query(query, (error, results, fields) => {
                if(error) return reject(error);
                resolve(results);
            })
        })
    }

    close() {
        return new Promise((resolve,reject) => {
            this.pool.end(err => {
                if(err) return reject(err);
            })
        })
    }
}
