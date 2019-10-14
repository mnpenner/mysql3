## Node MySQL 3

A small OOP wrapper around [Node MySQL 2](https://github.com/sidorares/node-mysql2). 


### Installation

```bash
yarn add mysql3
# or
npm i mysql3
```

### Usage

```js
import DbConnectionPool from 'mysql3';

(async () => {
    const db = new DbConnectionPool({
        user: 'AzureDiamond',
        password: 'hunter2',
        host: 'example.com',
        database: 'some_daterbase',
    });
    
    const users = await db.query("select * from users limit 3").fetchAll();

    db.close();
})();
```

See `tests/test.ts` for more.