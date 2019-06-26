export function isObject(entity: unknown): entity is object {
    return entity === Object(entity);
}