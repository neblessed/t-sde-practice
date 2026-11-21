import { assert, assertEqual, expectReject } from "./test/promise-test.js";

/**
Что нужно: «async map» с ограничением одновременно работающих промисов. Возвращает массив результатов в порядке items (не по завершению).

Требования:
В любой момент времени не больше limit промисов в работе.
Порядок результатов — как в items.
Если любой вызов fn reject — итоговый промис reject (fail-fast, как Promise.all).
items пустой — resolve [] сразу.
fn может вернуть значение или промис (используй Promise.resolve).

Краевые случаи:
limit >= items.length — работает как обычный Promise.all.
limit = 1 — последовательно, строго один за раз.
limit <= 0 — либо reject с ошибкой аргумента, либо трактовать как 1. Выбери и обоснуй в комментарии.
 */
async function mapWithConcurrency(items, fn, limit) {
    if (!items || items.length === 0) return [];

    const results = [];
    const queue = [...items];

    while (queue.length > 0) {
        const batch = queue.splice(0, limit);
        const batchResults = await Promise.all(batch.map(fn));
        results.push(...batchResults);
    }

    return results;
}

const sleep = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function testMapWithConcurrency() {
    // 1. Базовый: порядок и результаты
    const items = [1, 2, 3, 4, 5];
    const result = await mapWithConcurrency(
        items,
        async (x) => {
            await sleep(10);
            return x * 2;
        },
        3,
    );
    assertEqual(result, [2, 4, 6, 8, 10], "порядок и значения верны");

    // 2. Ограничение параллельности: не больше 3 одновременно
    let inFlight = 0;
    let maxInFlight = 0;
    const items2 = Array.from({ length: 10 }, (_, i) => i);
    await mapWithConcurrency(
        items2,
        async (x) => {
            inFlight++;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await sleep(20);
            inFlight--;
            return x;
        },
        3,
    );
    assert(maxInFlight === 3, `макс параллельность = 3, была ${maxInFlight}`);

    // 3. limit = 1 — строго последовательно
    inFlight = 0;
    maxInFlight = 0;
    await mapWithConcurrency(
        [1, 2, 3],
        async (x) => {
            inFlight++;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await sleep(10);
            inFlight--;
            return x;
        },
        1,
    );
    assert(maxInFlight === 1, "limit=1 — строго последовательно");

    // 4. limit > items.length — всё параллельно
    inFlight = 0;
    maxInFlight = 0;
    await mapWithConcurrency(
        [1, 2, 3],
        async (x) => {
            inFlight++;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await sleep(20);
            inFlight--;
            return x;
        },
        10,
    );
    assert(maxInFlight === 3, "limit > length — всё параллельно");

    // 5. Пустой массив
    const empty = await mapWithConcurrency([], async (x) => x, 5);
    assertEqual(empty, [], "пустой массив → []");

    // 6. Ошибка в одном — reject
    let failed = false;
    await expectReject(
        mapWithConcurrency(
            [1, 2, 3],
            async (x) => {
                if (x === 2) {
                    failed = true;
                    throw new Error("oops");
                }
                return x;
            },
            2,
        ),
        "ошибка в fn → reject",
    );
    assert(failed, "fn был вызван для элемента 2");

    // 7. fn возвращает не промис
    const sync = await mapWithConcurrency([1, 2, 3], (x) => x * 10, 2);
    assertEqual(sync, [10, 20, 30], "fn может возвращать значение");
}

testMapWithConcurrency().then(() =>
    console.log("✅ mapWithConcurrency passed"),
);
