# mysql3


A small OOP wrapper around [`mariadb`](https://github.com/mariadb-corporation/mariadb-connector-nodejs).


## Installation

```bash
yarn add mysql3
# or
npm i mysql3
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
function createPool(config: Maria.PoolConfig): Promise<ConnectionPool>
```

```ts
class ConnectionPool {
    constructor(pool: Maria.Pool);
    getConnection(): Promise<PoolConnection>;
    private _fwd;
    query: <TRecord extends object = Record<string, DefaultValueType>>(query: QueryParam) => Promise<TRecord[] & {
        meta: Maria.FieldInfo[];
    }>;
    row: <TRecord extends object = Record<string, DefaultValueType>>(query: QueryParam) => Promise<TRecord | null>;
    value: <TValue = DefaultValueType>(query: SqlFrag) => Promise<TValue | null>;
    exists: (query: SqlFrag) => Promise<boolean>;
    close: () => Promise<void>;
    get activeConnections(): number;
    get totalConnections(): number;
    get idleConnections(): number;
    get taskQueueSize(): number;
}
```

```ts
class PoolConnection {
    constructor(conn: Maria.PoolConnection);
    query<TRecord extends object = DefaultRecordType>(query: QueryParam): Promise<TRecord[] & {
        [META]: FieldInfo[];
    }>;
    exec: ((...args: Parameters<typeof PoolConnection.prototype.query>) => Promise<Maria.UpsertResult>);
    row<TRecord extends object = DefaultRecordType>(query: QueryParam): Promise<TRecord | null>;
    value<TValue = DefaultValueType>(query: SqlFrag): Promise<TValue | null>;
    exists(query: SqlFrag): Promise<boolean>;
    release: () => void;
}
```

```ts
sql(strings: TemplateStringsArray, ...values: Value[]): SqlFrag

namespace sql {
    function set(fields: Record<string, Value> | Array<[Id, Value]>): SqlFrag;
    function insert<Schema extends object = Record<string, Value>>(table: Id, data: Partial<Schema> | Array<[Id, Value]>, options?: InsertOptions): SqlFrag;
    function as(fields: Record<string, Id> | Array<[Id, string]>): SqlFrag;
    function raw(sqlString: string | SqlFrag): SqlFrag;
    function point(x: number, y: number): SqlFrag;
    function id(id: Id): SqlFrag;
    function db(id: DatabaseId): SqlFrag;
    function tbl(id: TableId): SqlFrag;
    function col(id: ColumnId): SqlFrag;
    function columns(columns: Id[]): SqlFrag;
    function values(values: Value[][]): SqlFrag;
}
```

### Transactions

```ts
async function main(pool: ConnectionPool) {
    const result = await pool.transaction([
        sql`select now()`,
        sql`select 1+1 as ans`,
    ])
    console.dir(result, {depth: 2})
}
```

```txt
[
  [ { 'now()': 2021-01-25T15:08:39.000Z }, meta: [ [ColumnDef] ] ],
  [ { ans: 2 }, meta: [ [ColumnDef] ] ]
]
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
