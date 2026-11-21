import { assert, assertEqual, expectReject } from "./test/promise-test.js";

/**
 * Сигнатура: promisify(fn) => (...args) => Promise<T>
 * Что нужно: взять функцию в Node.js-стиле (fn(...args, (err, result) => ...)) и вернуть функцию, возвращающую промис.
 *
 * Краевые случаи:
 * – fn может принимать любое количество аргументов до колбэка.
 * – Ошибка → reject(err), успех → resolve(result).
 * – Если fn использует this — обёрнутая функция должна сохранять this.
 */
function promisify(fn) {
    return function (...args) {
        return new Promise((resolve, reject) => {
            fn.call(this, ...args, (err, result) => {
                if (err) {
                    reject(err);
                }

                resolve(result);
            });
        });
    };
}

async function testPromisify() {
    // 1. Успех
    const readValue = promisify((cb) => setTimeout(() => cb(null, 42), 10));
    assertEqual(await readValue(), 42, "успех — resolve с результатом");

    // 2. Ошибка
    const fail = promisify((cb) => setTimeout(() => cb(new Error("bad")), 10));
    const err = await expectReject(fail(), "ошибка — reject");
    assert(err.message === "bad", "reason пробрасывается");

    // 3. Несколько аргументов
    const add = promisify((a, b, cb) => setTimeout(() => cb(null, a + b), 5));
    assertEqual(await add(2, 3), 5, "аргументы пробрасываются");

    // 4. this сохраняется
    const obj = {
        value: 10,
        method: promisify(function (cb) {
            setTimeout(() => cb(null, this.value), 5);
        }),
    };
    assertEqual(await obj.method(), 10, "this сохраняется");
}

testPromisify().then(() => console.log("✅ promisify passed"));
