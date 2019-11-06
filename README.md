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
import {ConnectionPool, sql} from 'mysql3';

(async () => {
    const db = new ConnectionPool({
        user: 'AzureDiamond',
        password: 'hunter2',
        host: 'example.com',
        database: 'some_daterbase',
    });
    
    const username = "george";
    const users = await db.query(sql`select * from users where username=${username}`);

    db.close();
})();
```

See `tests/test.ts` for more.
