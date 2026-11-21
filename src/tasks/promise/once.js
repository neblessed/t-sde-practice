import { assert, expectReject } from "./test/promise-test.js";

/**
Сигнатура: once(fn) => (...args) => Promise<T>

Что нужно: обернуть fn (возвращает промис) так, чтобы fn выполнилась ровно один раз. Все последующие вызовы возвращают тот же промис (тот же объект, ===), а не запускают fn заново.

Требования:
Первый вызов — запускает fn, запоминает промис.
Второй/третий/... вызов — возвращает закэшированный промис (идентичный, ===).
Кэшируется и успех, и ошибка: если первый вызов зареджектился, повторные тоже получают тут же rejection, fn не вызывается снова.
Аргументы при повторных вызовах игнорируются (используются аргументы первого вызова).

Зачем нужно: тяжёлая инициализация (конфиг, соединение, токен), которую нужно выполнить один раз, даже если её «дёргают» параллельно из разных мест.
 */

function once(fn) {
    let cached;
    let called = false;

    return function (...args) {
        if (!called) {
            called = true;
            cached = fn(...args);
        }

        return cached;
    };
}

async function testOnce() {
    // 1. fn вызывается один раз при нескольких вызовах
    let calls = 0;
    const init = once(() => {
        calls++;
        return Promise.resolve("init");
    });

    const [a, b, c] = await Promise.all([init(), init(), init()]);
    assert(calls === 1, "fn вызван ровно 1 раз");
    assert(
        a === "init" && b === "init" && c === "init",
        "все получили результат",
    );

    // 2. Возвращается ТОТ ЖЕ промис
    const p1 = init();
    const p2 = init();
    assert(p1 === p2, "возвращается тот же промис (===)");

    // 3. Ошибка кэшируется: fn не вызывается повторно после reject
    calls = 0;
    const failing = once(() => {
        calls++;
        return Promise.reject(new Error("boom"));
    });

    const err1 = await expectReject(failing(), "первый вызов — reject");
    const err2 = await expectReject(failing(), "второй вызов — тот же reject");
    assert(calls === 1, "fn НЕ вызван повторно после ошибки");
    assert(
        err1.message === "boom" && err2.message === "boom",
        "одна и та же ошибка",
    );

    // 4. Параллельные вызовы — fn один раз
    calls = 0;
    const slow = once(() => {
        calls++;
        return new Promise((r) => setTimeout(() => r("slow"), 50));
    });
    const [x, y] = await Promise.all([slow(), slow()]);
    assert(calls === 1, "параллельные вызовы — fn 1 раз");
    assert(x === "slow" && y === "slow", "оба получили результат");
}

testOnce().then(() => console.log("✅ once passed"));
