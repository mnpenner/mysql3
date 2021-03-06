# mysql3

A small OOP wrapper around [`mariadb`](https://github.com/mariadb-corporation/mariadb-connector-nodejs).


## Installation

```bash
yarn add mysql3
# or
npm i mysql3
# or
pnpm add mysql3
```

## Usage

```js
import {createPool, sql} from 'mysql3';

async function main(pool: ConnectionPool) {
    const result = await pool.value(sql`select now()`)
    console.log(result)
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
```

See `tests/test.ts` for more.

## API

```ts
function createPool(config: MariaDB.PoolConfig): Promise<ConnectionPool>
```

### Connections

```ts
class ConnectionPool {
    constructor(pool: MariaDB.Pool);
    getConnection(): Promise<PoolConnection>;
    private _fwd;
    query: <TRecord = Record<string, DefaultValueType>>(query: QueryParam) => Promise<QueryResult<TRecord>>;
    row: <TRecord extends object = Record<string, DefaultValueType>>(query: QueryParam) => Promise<TRecord | null>;
    value: <TValue = DefaultValueType>(query: SqlFrag) => Promise<TValue | null>;
    exists: (query: SqlFrag) => Promise<boolean>;
    count: (query: SqlFrag) => Promise<number>;
    close: () => Promise<void>;
    transaction<TReturn>(callback: (conn: PoolConnection) => Promise<TReturn>): Promise<TReturn>;
    transaction<TUnionResults = DefaultRecordType>(callback: SqlFrag[]): Promise<QueryResult<TUnionResults>[]>;
    get activeConnections(): number;
    get totalConnections(): number;
    get idleConnections(): number;
    get taskQueueSize(): number;
}
```

```ts
class PoolConnection {
    private readonly conn;
    constructor(conn: MariaDB.PoolConnection);
    query<TRecord = DefaultRecordType>(query: QueryParam): Promise<QueryResult<TRecord>>;
    exec: ((...args: Parameters<typeof PoolConnection.prototype.query>) => Promise<MariaDB.UpsertResult>);
    row<TRecord extends object = DefaultRecordType>(query: QueryParam): Promise<TRecord | null>;
    value<TValue = DefaultValueType>(query: SqlFrag): Promise<TValue | null>;
    exists(query: SqlFrag): Promise<boolean>;
    count(query: SqlFrag): Promise<number>;
    release: () => void;
    beginTransaction: () => Promise<void>;
    commit: () => Promise<void>;
    rollback: () => Promise<void>;
    ping: () => Promise<void>;
    changeUser: (options?: MariaDB.UserConnectionConfig | undefined) => Promise<void>;
    isValid: () => boolean;
    close: () => Promise<void>;
    destroy: () => void;
    serverVersion: () => string;
}
```

### SQL Strings

```ts
sql(strings: TemplateStringsArray, ...values: Value[]): SqlFrag

namespace sql {
    function set<T extends TableSchema<T>>(fields: InsertData<T>): SqlFrag;
    function insert<T extends TableSchema<T>>(table: TableId, data: InsertData<T>, options?: InsertOptions): SqlFrag;
    function alias(fields: Record<string, ColumnId> | Array<[column: ColumnId, alias: string]>): SqlFrag;
    function raw(sqlString: string | SqlFrag): SqlFrag;
    function point(x: number, y: number): SqlFrag;
    function id(id: Id): SqlFrag;
    function cols(...columns: Array<ColumnId>): SqlFrag;
    function values(values: Value[][]): SqlFrag;
}

enum DuplicateKey {
    IGNORE = "ignore",
    UPDATE = "update"
}
```

### Transactions

```ts
async function main(pool: ConnectionPool) {
    const userId = ouid();
    const profileId = ouid();
    await pool.transaction([
        sql.insert('users', {id: userId, username: 'mpen'}),
        sql.insert('profiles', {id: profileId, userId, name: "Mark"}),
    ])
}
```

OR

```ts
async function main(pool: ConnectionPool) {
    const profileId = await pool.transaction(async conn => {
        const user = await conn.exec(sql.insert('users', {username: 'mpen'}))
        const profile = await conn.exec(sql.insert('profiles', {userId: user.insertId, name: 'Mark'}))
        return profile.insertId
    })
}
```

### Examples

```ts
console.dir(await pool.query(sql`select ${sql.as({mediaType: 'media_type', width: 'width', height: 'height', aspectRatio: 'aspect_ratio'})}
                                 from ${sql.tbl(['imagegather', 'image_files'])}
                                 limit 2`), {depth: 1})
```

```txt
[
  {
    mediaType: 'image/jpeg',
    width: 296,
    height: 222,
    aspectRatio: 1.33333
  },
  {
    mediaType: 'image/jpeg',
    width: 3264,
    height: 2448,
    aspectRatio: 1.33333
  },
  meta: [ [ColumnDef], [ColumnDef], [ColumnDef], [ColumnDef] ]
]
```

```ts
console.dir(await pool.query({
    sql: sql`select media_type,width,height from image_files limit 2`,
    rowsAsArray: true,
}), {depth: 1})
```
```txt
[
  [ 'image/jpeg', 296, 222 ],
  [ 'image/jpeg', 3264, 2448 ],
  meta: [ [ColumnDef], [ColumnDef], [ColumnDef] ]
]
```

```ts
console.log(sql`insert into foo set ${sql.set({bar:1,baz:"qu'ux"})}`)
```

```txt
SqlFrag { sql: "insert into foo set `bar`=1, `baz`='qu''ux'" }
```

```ts
console.log(sql`insert into foo(bar, baz)
                values ${sql.values([
                    [1, "qu'ux"],
                    [2, null],
                ])}`.toSqlString())
```

```txt
insert into foo(bar,baz) values (1,'qu''ux'), (2,NULL)
```
