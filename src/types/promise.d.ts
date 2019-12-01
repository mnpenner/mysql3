interface PromiseResolution<T> {
    status: 'fulfilled';
    value: T;
}

interface PromiseRejection<E> {
    status: 'rejected';
    reason: E;
}

type PromiseResult<T, E = unknown> = PromiseResolution<T> | PromiseRejection<E>;
type PromiseTuple<T extends [unknown, ...unknown[]]> = {[P in keyof T]: Promise<T[P]>};
type PromiseResultTuple<T extends [unknown, ...unknown[]]> = {[P in keyof T]: PromiseResult<T[P]>};

interface PromiseConstructor {
    allSettled(): Promise<[]>;
    allSettled<T extends [unknown, ...unknown[]]>(iterable: PromiseTuple<T>): Promise<PromiseResultTuple<T>>;
    allSettled<T>(iterable: Iterable<Promise<T> | T>): Promise<Array<PromiseResult<T>>>;
}
