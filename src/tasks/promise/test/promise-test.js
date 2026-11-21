export function assert(cond, msg) {
    if (!cond) throw new Error("FAIL: " + msg);
    console.log("PASS:", msg);
}

export function assertEqual(actual, expected, msg) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok)
        throw new Error(
            `FAIL: ${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
        );
    console.log("PASS:", msg);
}

export async function expectReject(promise, msg) {
    try {
        await promise;
    } catch (e) {
        console.log("PASS:", msg, "— rejected with:", e.message);
        return e;
    }
    throw new Error(`FAIL: ${msg} — expected rejection, but resolved`);
}
