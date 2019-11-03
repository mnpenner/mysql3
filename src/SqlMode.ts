enum SqlMode {
    /**
     * Do not perform full checking of dates. Check only that the month is in the range from 1 to 12 and the day is in the range from 1 to 31. This may be useful for Web applications that obtain year, month, and day in three different fields and store exactly what the user inserted, without date validation. This mode applies to DATE and DATETIME columns. It does not apply TIMESTAMP columns, which always require a valid date.
     *
     * With ALLOW_INVALID_DATES disabled, the server requires that month and day values be legal, and not merely in the range 1 to 12 and 1 to 31, respectively. With strict mode disabled, invalid dates such as '2004-04-31' are converted to '0000-00-00' and a warning is generated. With strict mode enabled, invalid dates generate an error. To permit such dates, enable ALLOW_INVALID_DATES.
     */
    AllowInvalidDates = 'ALLOW_INVALID_DATES',

    /**
     * Treat " as an identifier quote character (like the ` quote character) and not as a string quote character. You can still use ` to quote identifiers with this mode enabled. With ANSI_QUOTES enabled, you cannot use double quotation marks to quote literal strings because they are interpreted as identifiers.
     */
    AnsiQuotes = 'ANSI_QUOTES',

    /**
     * The ERROR_FOR_DIVISION_BY_ZERO mode affects handling of division by zero, which includes MOD(N,0). For data-change operations (INSERT, UPDATE), its effect also depends on whether strict SQL mode is enabled.
     *
     * - If this mode is not enabled, division by zero inserts NULL and produces no warning.
     * - If this mode is enabled, division by zero inserts NULL and produces a warning.
     * - If this mode and strict mode are enabled, division by zero produces an error, unless IGNORE is given as well. For INSERT IGNORE and UPDATE IGNORE, division by zero inserts NULL and produces a warning.
     *
     * For SELECT, division by zero returns NULL. Enabling ERROR_FOR_DIVISION_BY_ZERO causes a warning to be produced as well, regardless of whether strict mode is enabled.
     *
     * ERROR_FOR_DIVISION_BY_ZERO is deprecated. ERROR_FOR_DIVISION_BY_ZERO is not part of strict mode, but should be used in conjunction with strict mode and is enabled by default. A warning occurs if ERROR_FOR_DIVISION_BY_ZERO is enabled without also enabling strict mode or vice versa.
     *
     * Because ERROR_FOR_DIVISION_BY_ZERO is deprecated, it will be removed in a future MySQL release as a separate mode name and its effect included in the effects of strict SQL mode.
     */
    ErrorForDivisionByZero = 'ERROR_FOR_DIVISION_BY_ZERO',

    /**
     * The precedence of the NOT operator is such that expressions such as NOT a BETWEEN b AND c are parsed as NOT (a BETWEEN b AND c). In some older versions of MySQL, the expression was parsed as (NOT a) BETWEEN b AND c. The old higher-precedence behavior can be obtained by enabling the HIGH_NOT_PRECEDENCE SQL mode.
     */
    HighNotPrecedence = 'HIGH_NOT_PRECEDENCE',

    /**
     * Permit spaces between a function name and the ( character. This causes built-in function names to be treated as reserved words. As a result, identifiers that are the same as function names must be quoted as described in Section 9.2, “Schema Object Names”.
     */
    IgnoreSpace = 'IGNORE_SPACE',

    /**
     * NO_AUTO_VALUE_ON_ZERO affects handling of AUTO_INCREMENT columns. Normally, you generate the next sequence number for the column by inserting either NULL or 0 into it. NO_AUTO_VALUE_ON_ZERO suppresses this behavior for 0 so that only NULL generates the next sequence number.
     *
     * This mode can be useful if 0 has been stored in a table's AUTO_INCREMENT column. (Storing 0 is not a recommended practice, by the way.) For example, if you dump the table with mysqldump and then reload it, MySQL normally generates new sequence numbers when it encounters the 0 values, resulting in a table with contents different from the one that was dumped. Enabling NO_AUTO_VALUE_ON_ZERO before reloading the dump file solves this problem. For this reason, mysqldump automatically includes in its output a statement that enables NO_AUTO_VALUE_ON_ZERO.
     */
    NoAutoValueOnZero = 'NO_AUTO_VALUE_ON_ZERO',

    /**
     * Disable the use of the backslash character (\) as an escape character within strings and identifiers. With this mode enabled, backslash becomes an ordinary character like any other.
     *
     * @deprecated Will break escaping. Strongly discouraged.
     */
    NoBackslashEscapes = 'NO_BACKSLASH_ESCAPES',

    /**
     * When creating a table, ignore all INDEX DIRECTORY and DATA DIRECTORY directives. This option is useful on slave replication servers.
     */
    NoDirInCreate = 'NO_DIR_IN_CREATE',

    /**
     * Control automatic substitution of the default storage engine when a statement such as CREATE TABLE or ALTER TABLE specifies a storage engine that is disabled or not compiled in.
     *
     * By default, NO_ENGINE_SUBSTITUTION is enabled.
     *
     * Because storage engines can be pluggable at runtime, unavailable engines are treated the same way:
     *
     * With NO_ENGINE_SUBSTITUTION disabled, for CREATE TABLE the default engine is used and a warning occurs if the desired engine is unavailable. For ALTER TABLE, a warning occurs and the table is not altered.
     *
     * With NO_ENGINE_SUBSTITUTION enabled, an error occurs and the table is not created or altered if the desired engine is unavailable.
     */
    NoEngineSubstitution = 'NO_ENGINE_SUBSTITUTION',

    /**
     * Subtraction between integer values, where one is of type UNSIGNED, produces an unsigned result by default. If the result would otherwise have been negative, an error results.
     */
    NoUnsignedSubtraction = 'NO_UNSIGNED_SUBTRACTION',

    /**
     * The NO_ZERO_DATE mode affects whether the server permits '0000-00-00' as a valid date. Its effect also depends on whether strict SQL mode is enabled.
     *
     * - If this mode is not enabled, '0000-00-00' is permitted and inserts produce no warning.
     * - If this mode is enabled, '0000-00-00' is permitted and inserts produce a warning.
     * - If this mode and strict mode are enabled, '0000-00-00' is not permitted and inserts produce an error, unless IGNORE is given as well. For INSERT IGNORE and UPDATE IGNORE, '0000-00-00' is permitted and inserts produce a warning.
     *
     * NO_ZERO_DATE is deprecated. NO_ZERO_DATE is not part of strict mode, but should be used in conjunction with strict mode and is enabled by default. A warning occurs if NO_ZERO_DATE is enabled without also enabling strict mode or vice versa.
     *
     * Because NO_ZERO_DATE is deprecated, it will be removed in a future MySQL release as a separate mode name and its effect included in the effects of strict SQL mode.
     */
    NoZeroDate = 'NO_ZERO_DATE',

    /**
     * The NO_ZERO_IN_DATE mode affects whether the server permits dates in which the year part is nonzero but the month or day part is 0. (This mode affects dates such as '2010-00-01' or '2010-01-00', but not '0000-00-00'. To control whether the server permits '0000-00-00', use the NO_ZERO_DATE mode.) The effect of NO_ZERO_IN_DATE also depends on whether strict SQL mode is enabled.
     *
     * - If this mode is not enabled, dates with zero parts are permitted and inserts produce no warning.
     * - If this mode is enabled, dates with zero parts are inserted as '0000-00-00' and produce a warning.
     * - If this mode and strict mode are enabled, dates with zero parts are not permitted and inserts produce an error, unless IGNORE is given as well. For INSERT IGNORE and UPDATE IGNORE, dates with zero parts are inserted as '0000-00-00' and produce a warning.
     *
     * NO_ZERO_IN_DATE is deprecated. NO_ZERO_IN_DATE is not part of strict mode, but should be used in conjunction with strict mode and is enabled by default. A warning occurs if NO_ZERO_IN_DATE is enabled without also enabling strict mode or vice versa.
     *
     * Because NO_ZERO_IN_DATE is deprecated, it will be removed in a future MySQL release as a separate mode name and its effect included in the effects of strict SQL mode.
     */
    NoZeroInDate = 'NO_ZERO_IN_DATE',

    /**
     * Reject queries for which the select list, HAVING condition, or ORDER BY list refer to nonaggregated columns that are neither named in the GROUP BY clause nor are functionally dependent on (uniquely determined by) GROUP BY columns.
     *
     * A MySQL extension to standard SQL permits references in the HAVING clause to aliased expressions in the select list. The HAVING clause can refer to aliases regardless of whether ONLY_FULL_GROUP_BY is enabled.
     */
    OnlyFullGroupBy = 'ONLY_FULL_GROUP_BY',

    /**
     * By default, trailing spaces are trimmed from CHAR column values on retrieval. If PAD_CHAR_TO_FULL_LENGTH is enabled, trimming does not occur and retrieved CHAR values are padded to their full length. This mode does not apply to VARCHAR columns, for which trailing spaces are retained on retrieval.
     */
    PadCharToFullLength = 'PAD_CHAR_TO_FULL_LENGTH',

    /**
     * Treat || as a string concatenation operator (same as CONCAT()) rather than as a synonym for OR.
     */
    PipesAsConcat = 'PIPES_AS_CONCAT',

    /**
     * Treat REAL as a synonym for FLOAT. By default, MySQL treats REAL as a synonym for DOUBLE.
     */
    RealAsFloat = 'REAL_AS_FLOAT',

    /**
     * Enable strict SQL mode for all storage engines. Invalid data values are rejected. For details, see Strict SQL Mode.
     */
    StrictAllTables = 'STRICT_ALL_TABLES',

    /**
     * Enable strict SQL mode for transactional storage engines, and when possible for nontransactional storage engines. For details, see Strict SQL Mode.
     */
    StrictTransTables = 'STRICT_TRANS_TABLES',

    /**
     * Control whether rounding or truncation occurs when inserting a TIME, DATE, or TIMESTAMP value with a fractional seconds part into a column having the same type but fewer fractional digits. The default behavior is to use rounding. If this mode is enabled, truncation occurs instead.
     */
    TimeTruncateFractional = 'TIME_TRUNCATE_FRACTIONAL',

    /**
     * Equivalent to REAL_AS_FLOAT, PIPES_AS_CONCAT, ANSI_QUOTES, IGNORE_SPACE, and ONLY_FULL_GROUP_BY.
     *
     * ANSI mode also causes the server to return an error for queries where a set function S with an outer reference S(outer_ref) cannot be aggregated in the outer query against which the outer reference has been resolved.
     */
    Ansi = 'ANSI',

    /**
     * TRADITIONAL is equivalent to STRICT_TRANS_TABLES, STRICT_ALL_TABLES, NO_ZERO_IN_DATE, NO_ZERO_DATE, ERROR_FOR_DIVISION_BY_ZERO, and NO_ENGINE_SUBSTITUTION.
     */
    Traditional = 'TRADITIONAL',

    /**
     * Prevent the GRANT statement from automatically creating new user accounts if it would otherwise do so, unless authentication information is specified. The statement must specify a nonempty password using IDENTIFIED BY or an authentication plugin using IDENTIFIED WITH.
     *
     * It is preferable to create MySQL accounts with CREATE USER rather than GRANT. NO_AUTO_CREATE_USER is deprecated and the default SQL mode includes NO_AUTO_CREATE_USER. Assignments to sql_mode that change the NO_AUTO_CREATE_USER mode state produce a warning, except assignments that set sql_mode to DEFAULT. NO_AUTO_CREATE_USER will be removed in a future MySQL release, at which point its effect will be enabled at all times (GRANT will not create accounts).
     *
     * Previously, before NO_AUTO_CREATE_USER was deprecated, one reason not to enable it was that it was not replication safe. Now it can be enabled and replication-safe user management performed with CREATE USER IF NOT EXISTS, DROP USER IF EXISTS, and ALTER USER IF EXISTS rather than GRANT. These statements enable safe replication when slaves may have different grants than those on the master. See Section 13.7.1.2, “CREATE USER Syntax”, Section 13.7.1.3, “DROP USER Syntax”, and Section 13.7.1.1, “ALTER USER Syntax”.
     *
     * @deprecated Removed in MySQL 8.
     */
    NoAutoCreateUser = 'NO_AUTO_CREATE_USER',
}


export default SqlMode;
