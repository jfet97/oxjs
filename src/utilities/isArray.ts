export default function isArray(entity: any): entity is any[] {
    return Array.isArray(entity);
}