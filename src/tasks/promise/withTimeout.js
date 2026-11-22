import {
    assert,
    assertEqual,
    expectReject,
} from "../../test-utils/promise-test.js";

/**
 * Сигнатура: withTimeout(promise, ms, message = 'Timeout') => Promise<T>
 * Что нужно: обернуть промис таймаутом. Если promise settled раньше ms — вернуть его результат (value или rejection). Если ms истекло раньше — reject с new Error(message).
 * Краевые случаи:
 * – Оригинальный промис продолжает выполняться — таймаут его не отменяет. Это нормально, но нужно убедиться, что его позднее reject не вызовет unhandled rejection.
 * – Ошибка оригинального промиса до таймаута — должна проброситься как есть (не как Timeout).
 * – Таймер после успеха нужно очищать (иначе таймер ещё какое-то время висит в памяти).
 */
async function withTimeout(promise, ms, message = "Timeout") {
    let timer;

    const specificTimeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
    });

    return Promise.race([promise, specificTimeout]).finally(() =>
        clearTimeout(timer),
    );
}

async function testWithTimeout() {
    // 1. Успех до таймаута
    const fast = new Promise((r) => setTimeout(() => r("ok"), 20));
    const result = await withTimeout(fast, 100);
    assertEqual(result, "ok", "успех до таймаута");

    // 2. Таймаут
    const slow = new Promise((r) => setTimeout(() => r("slow"), 200));
    const err = await expectReject(
        withTimeout(slow, 20),
        "таймаут срабатывает",
    );
    assert(err.message === "Timeout", "сообщение по умолчанию: Timeout");

    // 3. Кастомное сообщение
    const err2 = await expectReject(
        withTimeout(new Promise(() => {}), 10, "Слишком долго"),
        "кастомное сообщение",
    );
    assert(
        err2.message === "Слишком долго",
        "кастомное сообщение используется",
    );

    // 4. Ошибка оригинала до таймаута — пробрасывается как есть
    const failing = new Promise((_, rej) =>
        setTimeout(() => rej(new Error("boom")), 10),
    );
    const err3 = await expectReject(
        withTimeout(failing, 100),
        "ошибка оригинала пробрасывается",
    );
    assert(err3.message === "boom", "не заменяется на Timeout");

    // 5. Нет unhandled rejection после таймаута
    let unhandled = null;
    const handler = (e) => {
        unhandled = e;
    };
    window.addEventListener?.("unhandledrejection", handler);

    await expectReject(
        withTimeout(
            new Promise((_, rej) =>
                setTimeout(() => rej(new Error("late")), 50),
            ),
            10,
        ),
        "таймаут раньше поздней ошибки",
    );

    await new Promise((resolve) => setTimeout(resolve, 100)); // даём позднему reject сработать

    window.removeEventListener?.("unhandledrejection", handler);
    assert(unhandled === null, "нет unhandled rejection от поздней ошибки");
}

testWithTimeout().then(() => console.log("✅ withTimeout passed"));
