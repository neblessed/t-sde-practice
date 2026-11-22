import {
    assert,
    assertEqual,
    expectReject,
} from "../../test-utils/promise-test.js";

/**
Сигнатура: retry(fn, { attempts = 3, delay = 0 } = {}) => Promise<T>

Что нужно: вызывать fn() до успеха или attempts попыток. fn возвращает промис.

Требования:

Всего попыток — attempts (включая первую).
Между попытками — пауза delay мс (после неудачной попытки, не перед первой).
После последней неудачной — reject с последней ошибкой.
Если fn возвращает значение (не промис) — тоже работает (Promise.resolve нормализует).
Краевые случаи:

attempts = 1 — только одна попытка, без retry.
attempts = 0 — не вызывать fn вообще, reject сразу (что кинуть? продумай, например new Error('attempts must be > 0')).
Успех с первой попытки — остальные не вызываются.
delay = 0 — без паузы (но промис всё равно резолвится асинхронно).
 */
async function retry(fn, { attempts = 3, delay = 0 } = {}) {
    if (attempts === 0) {
        return new Error("attempts must be > 0");
    }

    if (attempts === 1) {
        return Promise.resolve(fn());
    }

    const sleep = () => new Promise((r) => setTimeout(r, delay));

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const result = await fn();

            return result;
        } catch (error) {
            if (attempt < attempts) {
                await sleep();
            } else {
                return Promise.reject(error);
            }
        }
    }
}

async function testRetry() {
    // 1. Успех с первой попытки
    let calls = 0;
    const fn1 = () => {
        calls++;
        return Promise.resolve("ok");
    };
    assertEqual(await retry(fn1, { attempts: 3 }), "ok", "успех с 1-й попытки");
    assert(calls === 1, "fn вызван ровно 1 раз");

    // 2. Успех после 2-х неудач
    calls = 0;
    const fn2 = () => {
        calls++;
        if (calls < 3) return Promise.reject(new Error("fail " + calls));
        return Promise.resolve("finally");
    };
    assertEqual(
        await retry(fn2, { attempts: 3 }),
        "finally",
        "успех с 3-й попытки",
    );
    assert(calls === 3, "fn вызван 3 раза");

    // 3. Все попытки провалились — последняя ошибка
    calls = 0;
    const fn3 = () => {
        calls++;
        return Promise.reject(new Error("e" + calls));
    };
    const err = await expectReject(
        retry(fn3, { attempts: 3 }),
        "все попытки fail",
    );
    assert(err.message === "e3", "пробрасывается последняя ошибка");
    assert(calls === 3, "fn вызван 3 раза");

    // 4. delay работает
    const start = Date.now();
    calls = 0;
    await retry(
        () => {
            calls++;
            if (calls < 3) return Promise.reject(new Error("x"));
            return Promise.resolve("ok");
        },
        { attempts: 3, delay: 50 },
    );
    const elapsed = Date.now() - start;
    assert(elapsed >= 90, `delay 50ms × 2 паузы = ~100ms, было ${elapsed}ms`);

    // 5. attempts = 1 — без retry
    calls = 0;
    await expectReject(
        retry(
            () => {
                calls++;
                return Promise.reject(new Error("x"));
            },
            { attempts: 1 },
        ),
        "attempts=1 — одна попытка",
    );
    assert(calls === 1, "fn вызван 1 раз");

    // 6. attempts = 0 — fn не вызывается
    calls = 0;
    await expectReject(
        retry(
            () => {
                calls++;
                return Promise.resolve("x");
            },
            { attempts: 0 },
        ),
        "attempts=0 — reject",
    );
    assert(calls === 0, "fn не вызывается при attempts=0");
}

testRetry().then(() => console.log("✅ retry passed"));
