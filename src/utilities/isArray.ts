export function isArray(entity: unknown): entity is unknown[] {
    return Array.isArray(entity);
}