export default function isObject(entity: any): boolean {
    return ((entity && typeof entity === "object") || (typeof entity === "function"));
}