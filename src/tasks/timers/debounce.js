import { assert, assertEqual, sleep } from "../../test-utils/promise-test.js";

function debounce(fn, wait, options) {
    let timerId;
    let isCalled = false;

    const action = function (...args) {
        clearTimeout(timerId);

        if (options?.leading === true && !isCalled) {
            fn.call(this, ...args);
            isCalled = true;
        }

        timerId = setTimeout(() => {
            isCalled = false;
            if (options?.trailing !== false) {
                fn.call(this, ...args);
            }
        }, wait);
    };

    action.cancel = function () {
        clearTimeout(timerId);
        isCalled = false;
        timerId = null;
    };

    return action;
}

async function testDebounce() {
    // 1. Базовое: N вызовов → 1 вызов fn через wait после последнего
    let calls = 0;
    const d1 = debounce(() => {
        calls++;
    }, 50);
    d1();
    d1();
    d1();
    assert(calls === 0, "trailing: fn ещё не вызван");
    await sleep(100);
    assert(calls === 1, "trailing: fn вызван ровно 1 раз");

    // 2. this и аргументы
    let received = null;
    const obj = {
        value: 10,
        method: debounce(function (a, b) {
            received = [this.value, a, b];
        }, 30),
    };
    obj.method(1, 2);
    await sleep(60);
    assertEqual(received, [10, 1, 2], "this и аргументы пробрасываются");

    // 3. Таймер перезапускается
    calls = 0;
    const d3 = debounce(() => {
        calls++;
    }, 50);
    d3();
    await sleep(20);
    d3();
    await sleep(20);
    d3(); // через ~90мс от старта, но fn ждёт 50 после последнего
    assert(calls === 0, "таймер перезапустился, fn ещё не вызван");
    await sleep(80);
    assert(calls === 1, "fn вызван 1 раз после последнего");

    // 4. cancel() отменяет
    calls = 0;
    const d4 = debounce(() => {
        calls++;
    }, 50);
    d4();
    d4();
    d4.cancel();
    await sleep(100);
    assert(calls === 0, "cancel() отменил вызов");

    // 5. cancel() не ломает последующий вызов
    d4();
    await sleep(100);
    assert(calls === 1, "после cancel() снова работает");

    // 6. leading: true — первый вызов сразу
    calls = 0;
    const d6 = debounce(
        () => {
            calls++;
        },
        50,
        { leading: true },
    );
    d6();
    assert(calls === 1, "leading: первый вызов — сразу");
    d6();
    d6();
    await sleep(100);
    assert(calls === 2, "leading + trailing: всего 2 вызова (first + last)");

    // 7. leading: true, trailing: false — только первый
    calls = 0;
    const d7 = debounce(
        () => {
            calls++;
        },
        50,
        { leading: true, trailing: false },
    );
    d7();
    d7();
    d7();
    assert(calls === 1, "leading+no trailing: только первый");
    await sleep(100);
    assert(calls === 1, "trailing выключен — второго вызова нет");

    // 8. wait = 0 — асинхронно, но схлопывается
    calls = 0;
    const d8 = debounce(() => {
        calls++;
    }, 0);
    d8();
    d8();
    d8();
    assert(calls === 0, "wait=0: синхронно ещё не вызвано");
    await sleep(10);
    assert(calls === 1, "wait=0: все схлопнулись в один");

    calls = 0;
    const d9 = debounce(
        () => {
            calls++;
        },
        20,
        { leading: true, trailing: false },
    );

    d9(); // leading: calls=1, isCalled=true
    await sleep(50); // окно закрылось, но isCalled всё ещё true

    d9(); // ❌ НОВОЕ окно → leading должен сработать снова
    await sleep(50);

    assert(calls === 2, "leading должен срабатывать в каждом новом окне");

    calls = 0;
    const d10 = debounce(
        () => {
            calls++;
        },
        20,
        { leading: true, trailing: false },
    );

    d10(); // leading: calls=1, isCalled=true
    d10.cancel(); // окно отменено, но isCalled всё ещё true

    d10(); // ❌ должно быть новое окно → leading снова
    await sleep(50);

    assert(calls === 2, "после cancel() leading должен работать");
}

testDebounce().then(() => console.log("✅ debounce passed"));
