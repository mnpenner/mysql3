import {DuplicateKey, sql, SqlFrag} from './sql'

function normalizeSql(sql: string): string {
    return sql
        .replace(/\t/g,' ')
        .replace(/ *(\r?\n|\r) */g,' ')
        .replace(/ *, */g, ', ')
        .replace(/ *= */g,'=')
}

function expectSql(query: SqlFrag, result: string) {
    return expect(normalizeSql(query.toSqlString())).toBe(normalizeSql(result))
}

describe('sql', () => {
    it('autoescapes values', () => {
        expectSql(sql`select ${4}`, `select 4`)
        expectSql(sql`select ${4n}`, `select 4`)
        expectSql(sql`select ${true}, ${false}, ${null}`, `select 1, 0, NULL`)
        expectSql(sql`select ${'foo'}`, `select 'foo'`)
        expectSql(sql`select ${Buffer.from([0x12, 0xAB])}`, `select x'12ab'`)
        expectSql(sql`select * from t where x in (${[1, 2, 'x']})`, "select * from t where x in (1,2,'x')")
        expectSql(sql`select ${new Date('2021-01-31T07:10:01.302Z')}`, `select TIMESTAMP'2021-01-31 07:10:01.302'`)
        expectSql(sql`select ${new Date('2021-01-31T07:10:01.310Z')}`, `select TIMESTAMP'2021-01-31 07:10:01.310'`)
        expectSql(sql`select ${new Date('2021-01-31T07:10:01.000Z')}`, `select TIMESTAMP'2021-01-31 07:10:01'`)
    })

    it("raw", () => {
        expectSql(sql`select ${sql.raw('foo')}`, 'select foo')
    })

    it("alias", () => {
        expectSql(sql`select ${sql.alias({a: 'b', 'c.d': '4',e:sql`count(*)`})}`, "select `b` AS `a`, `4` AS `c.d`, count(*) AS `e`")
        expectSql(sql`select ${sql.alias([['a', 'b'], [['c', 'd'], 'e'], ['f.g', 'h']])}`, "select `a` AS `b`, `c`.`d` AS `e`, `f.g` AS `h`")
    })

    it('prevents classical SQL injection', () => {
        // https://www.owasp.org/index.php/Testing_for_SQL_Injection_(OTG-INPVAL-005)
        const username = "1' or '1' = '1"
        const password = "1' or '1' = '1"
        expectSql(sql`SELECT *
                   FROM Users
                   WHERE Username = ${username}
                     AND Password = ${password}`, "SELECT * FROM Users WHERE Username='1'' or ''1'' = ''1' AND Password='1'' or ''1'' = ''1'")
    })

    // it("prevents Express SQL injection", () => {
    //     // https://github.com/mysqljs/mysql/issues/501
    //     const id = {id:'1'};
    //     expectSql(sql`SELECT * FROM users WHERE id = ${id}`,
    //         "SELECT * FROM users WHERE id = id = '1'");
    // })

    it("prevents Shift-JIS attack", () => {
        // https://stackoverflow.com/a/36082818/65387
        const input = "\x81\x27 OR 1=1 #"
        expectSql(sql`SELECT *
                      FROM foo
                      WHERE bar = ${input}
                      LIMIT 1`, "SELECT * FROM foo WHERE bar = '\x81'' OR 1=1 #' LIMIT 1")
    })

    it('ids', () => {
        expectSql(sql`select ${sql.id('foo')}`, 'select `foo`')
        expectSql(sql.id(['foo', 'bar']), '`foo`.`bar`')
        expectSql(sql.id('foo.bar'), '`foo.bar`')
        expectSql(sql`using ${sql.db('db')}`, 'using `db`')
        expectSql(sql`select *
                      from ${sql.tbl(['db', 'tbl'])}`, 'select * from `db`.`tbl`')
        expectSql(sql`select ${sql.col(['db', 'tbl', 'col'])}
                      from dual`, 'select `db`.`tbl`.`col` from dual')
    })

    it('columns', () => {
        expectSql(sql`select ${sql.cols('a','b.c',['d','e'])}`, "select `a`, `b.c`, `d`.`e`")
        expectSql(sql`select ${sql.columns(['foo', 'bar'])}`, 'select `foo`, `bar`')
    })

    it('values', () => {
        expectSql(sql`insert into t (foo, bar)
                      values ${sql.values([[1, '2'], [3, '4']])}`, "insert into t (foo,bar) values (1,'2'),(3,'4')")
    })

    it('insert', () => {
        expectSql(sql.insert('t',{a:1,'b.c':'x'}), "INSERT INTO `t` SET `a`=1, `b`.`c`='x'")
        expectSql(sql.insert('t',{a:1,'b.c':'x'},{ignore:true}), "INSERT IGNORE INTO `t` SET `a`=1, `b`.`c`='x'")
        expectSql(sql.insert('t',{a:1,'b.c':'x'},{onDuplicateKey:DuplicateKey.IGNORE}), "INSERT INTO `t` SET `a`=1, `b`.`c`='x' ON DUPLICATE KEY UPDATE `a`=`a`")
        expectSql(sql.insert('t',{a:1,'b.c':'x'},{onDuplicateKey:DuplicateKey.UPDATE}), "INSERT INTO `t` SET `a`=1, `b`.`c`='x' ON DUPLICATE KEY UPDATE `a`=VALUES(`a`), `b`.`c`=VALUES(`b`.`c`)")

        expectSql(sql.insert('t',[['a',1],['b.c','x'],[['e','f'],'y']]), "INSERT INTO `t` SET `a`=1, `b.c`='x', `e`.`f`='y'")

        expectSql(sql.insert<FakeTable>('users',{
            id: 1,
            name: 'mpen',
            data: Buffer.from('deadbeef','hex'),
        }), "INSERT INTO `users` SET `id`=1, `name`='mpen', `data`=x'deadbeef'")
    })
})

interface FakeTable {
    id: number
    name: string
    data: Buffer
}

describe('SqlFrag', () => {
    it("doesn't add extra backslashes", () => {
        expectSql(sql`select *
                      from oauth
                      where provider = 'GOOGLE'
                        and \`key\` = ${555}`,
            "select * from oauth where provider='GOOGLE' and `key`=555")
    })
})
