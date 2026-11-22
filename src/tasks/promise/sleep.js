import { assert } from "../../test-utils/promise-test.js";

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testSleep() {
    // 1. Базовый: резолвится через ~ms
    const start = Date.now();
    await sleep(100);
    const elapsed = Date.now() - start;
    assert(elapsed >= 90 && elapsed < 200, `sleep(100) занял ${elapsed}ms`);

    // 2. sleep(0) не синхронный
    let resolved = false;
    sleep(0).then(() => {
        resolved = true;
    });
    assert(resolved === false, "sleep(0) не должен резолвиться синхронно");
    await sleep(10);
    assert(resolved === true, "sleep(0) резолвится в microtask/macrotask");

    // 3. Возвращает undefined
    const val = await sleep(1);
    assert(val === undefined, "sleep возвращает undefined");
}

testSleep().then(() => console.log("✅ sleep passed"));
