// TODO WIP Доделать
const state = {
    PENDING: "pending",
    FULFILLED: "fulfilled",
    REJECTED: "rejected",
};

class MyPromise {
    constructor(executor) {
        this.state = state.PENDING;
        this.result = undefined;

        this.onfulfilledFn = [];
        this.onrejectedFn = [];
        this.onfinally = [];

        const resolve = (value) => {
            if (this.state === state.PENDING) {
                this.state = state.FULFILLED;
                this.result = value;

                this.onfulfilledFn.forEach((fn) => fn(value));
            }
        };

        const reject = (reason) => {
            if (this.state === state.PENDING) {
                this.state = state.REJECTED;
                this.result = reason;

                this.onrejectedFn.forEach((fn) => fn(reason));
            }
        };

        try {
            executor(resolve, reject);
        } catch (error) {
            reject(error);
        }
    }

    then(onfulfilled, onrejected) {
        if (this.state === state.PENDING) {
            if (onfulfilled) {
                this.onfulfilledFn.push(onfulfilled);
            }

            if (onrejected) {
                this.onrejectedFn.push(onrejected);
            }
        }

        if (this.state === state.FULFILLED && onfulfilled) {
            return new MyPromise((resolve, reject) => {
                try {
                    resolve(onfulfilled(this.result));
                } catch (error) {
                    reject(error);
                }
            });
        }

        if (this.state === state.REJECTED && onrejected) {
            return new MyPromise((_, reject) =>
                reject(onrejected(this.result)),
            );
        }

        return this;
    }

    catch(onrejected) {
        return this.then(null, onrejected);
    }

    finally(onfinally) {
        if (this.state !== state.PENDING) {
            try {
                onfinally();
            } catch (error) {
                this.catch(() => new Error(error));
            }
        }

        return this;
    }
}

const flush = () => new Promise((r) => setTimeout(r, 0));

/**
 * 3.1. return value из then → следующий then получает это значение
 */
new MyPromise((r) => r(1))
    .then((v) => v + 1)
    .then((v) => v * 10)
    .then((v) => console.log("3.1 chained:", v)); // → "3.1 chained: 20"

/**
 * 3.2. return PROMISE из then → разворачивается (следующий then получает value, не промис)
 */
new MyPromise((r) => r(1))
    .then(() => new MyPromise((r) => r(2)))
    .then((v) =>
        console.log(
            "3.2 unwrapped:",
            v,
            "| is promise:",
            v instanceof MyPromise,
        ),
    );
// → "3.2 unwrapped: 2 | is promise: false"

/**
 * 3.3. throw в then → rejected, следующий catch ловит
 */
new MyPromise((r) => r(1))
    .then(() => {
        throw new Error("from then");
    })
    .then(() => console.log("3.3 НЕ ДОЛЖНО БЫТЬ"))
    .catch((e) => console.log("3.3 caught:", e.message)); // → "3.3 caught: from then"

/**
 * 3.4. return value из catch → ВОССТАНОВЛЕНИЕ (цепочка снова fulfilled)
 */
new MyPromise((_, rej) => rej(new Error("x")))
    .catch((e) => "recovered")
    .then((v) => console.log("3.4 after catch:", v)); // → "3.4 after catch: recovered"

/**
 * 3.5. return PROMISE из catch → тоже разворачивается
 */
new MyPromise((_, rej) => rej(new Error("x")))
    .catch(() => new MyPromise((r) => r("from-promise")))
    .then((v) =>
        console.log(
            "3.5 catch promise:",
            v,
            "| is promise:",
            v instanceof MyPromise,
        ),
    );
// → "3.5 catch promise: from-promise | is promise: false"

/**
 * 3.6. throw в catch → следующий catch ловит
 */
new MyPromise((_, rej) => rej(new Error("a")))
    .catch(() => {
        throw new Error("b");
    })
    .catch((e) => console.log("3.6 second catch:", e.message)); // → "3.6 second catch: b"

/**
 * 3.7. thenable (объект с .then) разворачивается
 */
const thenable37 = {
    then(resolve) {
        resolve("thenable-result");
    },
};
new MyPromise((r) => r(thenable37)).then((v) =>
    console.log("3.7 thenable:", v),
); // → "3.7 thenable: thenable-result"

/**
 * 3.8. return PENDING promise из then → ждём его settle (не резолвимся раньше)
 */
new MyPromise((r) => r(1))
    .then(() => new MyPromise((r) => setTimeout(() => r("later"), 50)))
    .then((v) => console.log("3.8 pending wait:", v)); // → "3.8 pending wait: later" (через ~50мс)

/**
 * 3.9. return REJECTED promise из then → следующий catch ловит
 */
new MyPromise((r) => r(1))
    .then(
        () =>
            new MyPromise((_, rej) =>
                setTimeout(() => rej(new Error("async-err")), 10),
            ),
    )
    .catch((e) => console.log("3.9 async reject:", e.message)); // → "3.9 async reject: async-err"

/**
 * 🔶 3.10. Циклическая ссылка → rejected с TypeError
 */
let q310;
const p310 = new MyPromise((r) => r(1));
q310 = p310.then(() => q310);
q310.catch((e) => console.log("3.10 cycle:", e.constructor.name)); // → "3.10 cycle: TypeError"
