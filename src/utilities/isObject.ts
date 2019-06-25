export default function isObject(entity: any): entity is object {
    return entity === Object(entity);
}