// TODO: copy the latest version of this from jtilz and publish as standalone package

export function isNativeFunction(obj: any): obj is Function {
    return isFunction(obj) && obj.toString().endsWith('{ [native code] }');
}

export function isFunction(obj: any): obj is Function {
    return typeof obj === 'function';
}

export function isIterable(obj: any): obj is Iterable<any> {
    return obj && isFunction(obj[Symbol.iterator]);
}

export function isString(obj: any): obj is string {
    return typeof obj === 'string' || obj instanceof String;
}

export function isNumber(obj: any): obj is number {
    return typeof obj === 'number' || obj instanceof Number;
}

export function isInteger(obj: any): obj is number {
    return isNumber(obj) && obj === (obj|0);
}

/**
 * Checks if value is a number with a non-zero fractional part.
 * 
 * Note: `1.000` is considered an integer, not a float. Similarly, `999999.00000000001` is an integer, but `5e-324` is a float (see Number.MIN_VALUE).
 */
export function isFloat(obj: any): obj is number {
    return isNumber(obj) && obj !== (obj|0);
}

export function isPromise(obj: any): obj is Promise<any> {
    return obj instanceof Promise;
}

export function isBoolean(obj: any): obj is boolean {
    return obj === true || obj === false; // there's also a `Boolean` type but it doesn't behave much like a boolean
}

export function isRegExp(obj: any): obj is RegExp {
    return obj instanceof RegExp;
}

export function isDate(obj: any): obj is Date {
    return obj instanceof Date;
}

export function isSet(obj: any): obj is Set<any> {
    return obj instanceof Set;
}

export function isMap(obj: any): obj is Map<any,any> {
    return obj instanceof Map;
}

export function isWeakMap(obj: any): obj is WeakMap<any, any> {
    return obj instanceof WeakMap;
}

export function isArray(obj: any): obj is Array<any> {
    return Array.isArray(obj);
}

export function isNull(obj: any): obj is null {
    return obj === null;
}

export function isUndefined(obj: any): obj is undefined {
    return obj === undefined;
}

/**
 * Checks if value is `null`, `undefined` or `NaN`
 */
export function isNullish(obj: any): obj is null|undefined|number { // the NaN kind of screws up the type checking...
    return obj === null || obj === undefined || obj !== obj;
}

/**
 * Checks if value is `null` or `undefined`.
 */
export function isNil(obj: any): obj is null|undefined {
    return obj === null || obj === undefined;
}

export function isObject(obj: any): obj is object {
    return obj != null && typeof obj === 'object';
}

/**
 * Checks if value is `NaN`, like `Number.isNaN` but unlike `global.isNaN`.
 */
export function isNaN(obj: any): obj is number {
    return obj !== obj;
}

export function isPlainObject(obj: any): obj is object {
    // https://stackoverflow.com/a/23441431/65387
    // return Object.prototype.toString.call(obj) === '[object Object]';
    if(!isObject(obj)) return false;
    const proto = Object.getPrototypeOf(obj);
    return proto === null || proto === Object.prototype;
}

export function isSymbol(obj: any): obj is symbol {
    return Object.prototype.toString.call(obj) === '[object Symbol]';
}

export function isError(obj: any): obj is Error {
    return obj instanceof Error;
}
