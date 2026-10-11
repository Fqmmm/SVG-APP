// Acquires exclusive structural access; an attached group has already been claimed.
export const acquireTreeAccess: unique symbol = Symbol("acquireTreeAccess");
