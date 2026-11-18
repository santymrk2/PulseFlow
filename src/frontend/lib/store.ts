export type Subscriber<T> = (value: T) => void
export type Unsubscriber = () => void
export type Updater<T> = (value: T) => T
export type Invalidator<T> = (value?: T) => void

export interface Readable<T> {
    subscribe(run: Subscriber<T>, invalidate?: Invalidator<T>): Unsubscriber
}

export interface Writable<T> extends Readable<T> {
    set(value: T): void
    update(updater: Updater<T>): void
}

export type StartStopNotifier<T> = (
    set: (value: T) => void,
    update: (fn: Updater<T>) => void
) => void | (() => void)

type Stores = Readable<unknown> | readonly Readable<unknown>[]
export type StoresValues<S> = S extends Readable<infer T>
    ? T
    : { [K in keyof S]: S[K] extends Readable<infer T> ? T : never }

const subscriberQueue: Array<{
    subscriber: Subscriber<unknown>
    value: unknown
    invalidate: Invalidator<unknown> | undefined
}> = []

function safeNotEqual(a: unknown, b: unknown): boolean {
    return a !== b || ((a !== null && typeof a === "object") || typeof a === "function")
}

function noop(): void {}

export function writable<T>(value?: T, start: StartStopNotifier<T> = noop): Writable<T> {
    let stop: (() => void) | null = null
    const subscribers = new Set<[Subscriber<T>, Invalidator<T> | undefined]>()

    function set(newValue: T): void {
        if (safeNotEqual(value, newValue)) {
            value = newValue
            if (stop) {
                const runQueue = subscriberQueue.length === 0
                for (const subscriber of subscribers) {
                    subscriber[1]?.()
                    subscriberQueue.push({
                        subscriber: subscriber[0] as Subscriber<unknown>,
                        value: value as unknown,
                        invalidate: subscriber[1] as Invalidator<unknown> | undefined
                    })
                }
                if (runQueue) {
                    for (let index = 0; index < subscriberQueue.length; index++) {
                        const queued = subscriberQueue[index]
                        queued.subscriber(queued.value)
                    }
                    subscriberQueue.length = 0
                }
            }
        }
    }

    function update(updater: Updater<T>): void {
        set(updater(value as T))
    }

    function subscribe(run: Subscriber<T>, invalidate?: Invalidator<T>): Unsubscriber {
        const subscriber: [Subscriber<T>, Invalidator<T> | undefined] = [run, invalidate]
        subscribers.add(subscriber)
        if (subscribers.size === 1) {
            stop = start(set, update) || noop
        }
        run(value as T)
        return () => {
            subscribers.delete(subscriber)
            if (subscribers.size === 0 && stop) {
                stop()
                stop = null
            }
        }
    }

    return { set, update, subscribe }
}

export function readable<T>(value: T | undefined, start: StartStopNotifier<T>): Readable<T> {
    return {
        subscribe: writable(value, start).subscribe
    }
}

export function derived<S extends Stores, T>(
    stores: S,
    fn: ((values: StoresValues<S>) => T) | ((values: StoresValues<S>, set: (value: T) => void, update?: (fn: Updater<T>) => void) => void | (() => void)),
    initial?: T
): Readable<T> {
    const single = !Array.isArray(stores)
    const storesArray: readonly Readable<unknown>[] = single ? [stores as Readable<unknown>] : (stores as readonly Readable<unknown>[])

    const auto = fn.length < 2

    return readable(initial, (set, update) => {
        let started = false
        const values: unknown[] = []
        let pending = 0
        let cleanup: void | (() => void) = noop

        const sync = () => {
            if (pending > 0) return
            const result = cleanup
            if (typeof result === "function") result()
            if (auto) {
                set((fn as (values: StoresValues<S>) => T)(single ? (values[0] as StoresValues<S>) : (values as StoresValues<S>)))
            } else {
                cleanup = (fn as (values: StoresValues<S>, set: (value: T) => void, update: (fn: Updater<T>) => void) => void | (() => void))(
                    single ? (values[0] as StoresValues<S>) : (values as StoresValues<S>),
                    set,
                    update
                ) || noop
            }
        }

        const unsubscribers = storesArray.map((store, index) =>
            store.subscribe(
                (value) => {
                    values[index] = value
                    pending &= ~(1 << index)
                    if (started) sync()
                },
                () => {
                    pending |= 1 << index
                }
            )
        )

        started = true
        sync()

        return () => {
            for (const unsubscribe of unsubscribers) unsubscribe()
            const result = cleanup
            if (typeof result === "function") result()
        }
    })
}

export function get<T>(store: Readable<T>): T {
    let value: T
    store.subscribe(($value) => {
        value = $value
    })()
    return value!
}
