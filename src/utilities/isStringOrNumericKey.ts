import { Keys } from "../types/Keys";

export function isStringOrNumericKey(key: unknown): key is Keys {
    return typeof key === "string" || typeof key === "number"
}