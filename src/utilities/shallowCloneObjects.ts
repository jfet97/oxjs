import { isArray } from './isArray';
import { isObject } from './isObject';
/**
 *
 *
 * @export
 * @param {UnknownObject} entity object to be shallow cloned
 * @returns {UnknownObject} the clone
 * @throws {TypeError} if the argument is not an object
 */
export function shallowCloneObjects<T extends object>(entity: T): T {
    if (isArray(entity)) {
        return [...entity] as T;
    } else if (isObject(entity)) {
        return { ...entity };
    } else {
        throw new TypeError('Cannot shallowClone primitives');
    }
}