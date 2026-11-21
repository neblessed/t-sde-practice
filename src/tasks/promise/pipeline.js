import { assertEqual, expectReject, sleep } from "./test/promise-test.js";

/**
Сигнатура: pipeline(value, ...fns) => Promise<Result>

Что нужно: «труба» — значение value прогоняется через функции fns последовательно, каждая получает результат предыдущей.
Каждая функция может быть синхронной или асинхронной (возвращать значение или промис).

Требования:
Функции вызываются по порядку, каждая с результатом предыдущей.
Каждая может вернуть значение или промис — результат «разворачивается».
Если любая кинет/reject — итоговый промис reject.
pipeline(5) (без функций) — resolve 5.
Первая функция получает исходный value.

Зачем нужно: композиция обработчиков (middleware, ETL, валидация + трансформация + сохранение).
 */

async function pipeline(value, ...fns) {
    if (fns.length === 0) {
        return value;
    }

    return fns.reduce(async (result, fn) => {
        const awaitedResult = await result;

        return fn(awaitedResult);
    }, value);
}

async function testPipeline() {
    // 1. Синхронные функции
    const r1 = await pipeline(
        5,
        (x) => x + 1,
        (x) => x * 2,
        (x) => x - 3,
    );
    assertEqual(r1, 9, "синхронные функции: (5+1)*2-3 = 9");

    // 2. Смешанные sync/async
    const r2 = await pipeline(
        2,
        (x) => x * 10, // sync → 20
        async (x) => {
            await sleep(10);
            return x + 5;
        }, // async → 25
        (x) => x.toString(), // sync → '25'
    );
    assertEqual(r2, "25", "смешанные функции");

    // 3. Без функций
    assertEqual(await pipeline(42), 42, "без функций → значение как есть");

    // 4. Ошибка в середине — reject, дальше не идёт
    const called = [];
    await expectReject(
        pipeline(
            1,
            (x) => {
                called.push("a");
                return x;
            },
            (x) => {
                called.push("b");
                throw new Error("boom");
            },
            (x) => {
                called.push("c");
                return x;
            },
        ),
        "ошибка в середине → reject",
    );
    assertEqual(called, ["a", "b"], "третья функция не вызывалась");

    // 5. Async reject
    await expectReject(
        pipeline(1, async () => {
            throw new Error("async boom");
        }),
        "async reject ловится",
    );
}

testPipeline().then(() => console.log("✅ pipeline passed"));
