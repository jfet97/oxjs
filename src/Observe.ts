import Dependents from './Dependents';
import { ObserveCtor } from "./interfaces/ObserveCtor";
import { isObject } from './utilities/isObject';
import { isStringOrNumericKey } from './utilities/isStringOrNumericKey'
import { shallowCloneObjects } from './utilities/shallowCloneObjects'

staticImplements<ObserveCtor>();
export class Observe {

    public static observable(obj: UnknownObject): UnknownObject {

        // clone the input object to mantain immutability
        let inputObjCopy: UnknownObject;
        try {
            inputObjCopy = shallowCloneObjects(obj);
        } catch {
            throw new TypeError('Method observable method cannot work on primitives')
        }

        // initialize a dependents instance for each object/nested object
        const deps = new Dependents();

        // handle inputObjCopy keys
        Object.entries(inputObjCopy).forEach(([key, value]) => {
            if (isObject(value)) {
                // recursively transform non primitive properties into proxed objects
                inputObjCopy[key] = Observe.observable(value);
            }

            // initialize deps storage for each key of inputObjCopy
            deps.init(key);
        })

        return new Proxy(inputObjCopy, {

            get(proxedObj, key) {
                /* obj={a:{b:2}} due to Observe.observable ->  Proxy(obj){Proxy(a){b:2}}

                    when we read 'b' in 'obj.a.b'
                    Proxy(obj).a will trigger this trap returning Proxy(a)
                    Proxy(a).b will trigger this trap and it will return Proxy(a).b
                    Both will set the evaluator dependency because if obj.a would be changed,
                    obj.a.b should be revaluated as well
                */

                // if the accessed prop is an object (a proxy in practice)
                // it will be returned to be accessed in the chain
                // triggering the inner get trap
                const res = Reflect.get(proxedObj, key);

                // record the current evaluator
                if (isStringOrNumericKey(key)) {
                    deps.subscribe(key, Observe.currentEvaluator);
                }

                return res;
            },

            set(proxedObj, key, newValue) {

                if (!isStringOrNumericKey(key)) {
                    return Reflect.set(proxedObj, key, newValue);
                }

                /* obj={a:{b:2}} due to Observe.observable -> Proxy(obj){Proxy(a){b:2}}

                    when we change 'b' in obj.a.b = 9
                    Proxy(obj).a will trigger the 'obj' get trap returning Proxy(a)
                    without particular effects because of the null guard
                    Proxy(a).b = 9 will trigger the current Proxy trap,
                    setting the new value and notifying only obj.a.b observers.
                    obj.a should not be notified because if them depends on obj.a itself
                    it means that they are interested to the obj.a reference.
                    If they were interested to one or more specific props of obj.a
                    they would have writte obj.a.prop like obj.a.b, becoming dependents of
                    both obj.a and obj.a.b

                    when we change 'a' in obj.a.b
                    Proxy(obj).a will trigger this trap setting the new value and notifying obj.a and obj.a.b observers
                    to correctly reevaluate them all. That is possible because, as is written into the get trap, 
                    when obj.a.b is accessed, the evaluator is collected as dependency also for obj.a
                */

                /*
                    Four possibilities:
                        O-O) proxedObj.key is an object, newValue is an object
                        O-NO) proxedObj.key is an object, newValue is not an object
                        NO-O) proxedObj.key is not an object, newValue is an object
                        NO-NO) proxedObj.key is not an object, newValue is not an object

                    What to do:
                    O-O) To not loose already setted evaluators and to properly remove no more necessary references to evaluators,
                         instead of replacing proxedObj.key with newValue, we assign to each prop of proxedObj.key
                         the corresponding value present on newValue, recursively.
                         Because proxedObj.key is already an observable, we haven't to restore reactivity.
                         Then we have to remove those keys into the proxedObj.key object that aren't present 
                         inside newValue.
                         Also the deleting of references has to made recursively: if a property is itself an object
                         we have to handle all its properties references deletion and then delete the initial property reference
                         (reference = reference to evaluators)

                    O-NO) If newValue is a primitive value, before discarding the reactive object contained by proxedObj.key,
                          we have to recursively remove all its references to its evaluators.

                    NO-O) We can simply make newValue a reactive object

                    NO-NO) Nothing special to do
                */


                // no problem for a possible evaluator insertion due to the get access to proxedObj.key
                // because Observe.currentEvaluator wioll be null
                const inner = Reflect.get(proxedObj, key) as UnknownObject; // inner === proxedObj.key
                const isProxedObjKeyObject: boolean = isObject(inner);
                const isNewValueObject: boolean = isObject(newValue);


                let useReflectSet: boolean = false;
                const target = proxedObj;
                let propertyKey: Keys;
                let value: unknown;


                // O-O)
                if (isProxedObjKeyObject && isNewValueObject) {

                    // is strict mode, an unsuccessful Reflect.set operation applied to a proxed obj will trigger an Error
                    // Reflect.set is implied into the Object.entries(newValue) forEach

                    try {
                        Object.entries(newValue).forEach(([k, v]) => {
                            // to not loose current props' evaluators, instead of setting the new object value ref into proxedObj.key
                            // we assign to each prop of proxedObj.key the corresponding value present on the new object value,
                            // recursivelytrigger the set trap of the proxedObj notifying their observers

                            // this implies a sort of recursion on each subprop...
                            // because if inner[k] were an object, inners set traps will be called
                            inner[k] = v;
                        });

                        // delete props that are not present on newValue
                        const innerKeys = Object.keys(inner);
                        const newValueKeys = Object.keys(newValue);
                        for (const k of innerKeys) { // ...so this will be automatically executed also for subprops
                            if (!newValueKeys.includes(k)) {
                                delete inner[k];
                                // the proxy will handle the deletion of
                                // references to evaluators
                            }
                        }


                    } catch (e) {
                        throw e;
                    }

                    // we have not to call ReflectSet later because we
                    // don't plan to replace proxedObj.key with newValue
                    useReflectSet = false;

                    // proxedObj.key reference has not changed but it should have done
                    // this is only a workaround to not loose evaluators
                    // so we must anyway to notify the fake change to proxedObj.key
                    // calling deps.notify(propertyKey) later
                    propertyKey = key;
                }

                // O-NO)
                if (isProxedObjKeyObject && !isNewValueObject) {

                    removeAllDependenciesRecursively(inner);

                    // we have to call ReflectSet later because we
                    // have to replace proxedObj.key with newValue
                    // and we will notify observers
                    useReflectSet = true;
                    propertyKey = key;
                    value = newValue;
                }

                // NO-O)
                if (!isProxedObjKeyObject && isNewValueObject) {
                    // if the inner value was a primitve
                    // and the newValue is an object
                    // we can simply made the new one reactive

                    // we have to call ReflectSet later because we
                    // have to replace proxedObj.key with newValue
                    // and we will notify observers
                    useReflectSet = true;
                    propertyKey = key;
                    value = Observe.observable(newValue);
                }

                // NO-NO)
                if (!isProxedObjKeyObject && !isNewValueObject) {

                    // we have to call ReflectSet later because we
                    // have to replace proxedObj.key with newValue
                    // and we will notify observers
                    useReflectSet = true;
                    propertyKey = key;
                    value = newValue;
                }

                if (useReflectSet) {
                    // is strict mode, an unsuccessful Reflect.set operation applied to a proxed obj will trigger an Error
                    try {
                        Reflect.set(target, propertyKey!, value);
                    } catch (e) {
                        throw e;
                    }

                }

                deps.notify(propertyKey!); // to always notify subscribers about the change
                return true; // we come here only if there were no errors
            },

            deleteProperty(proxedObj, prop) {
                if (isStringOrNumericKey(prop)) {
                    deps.delete(prop);
                }
                Reflect.deleteProperty(proxedObj, prop);
                return true;
            }
        })
    }

    public static observer(futureObserver: object = {}, evaluators: EvaluatorsConfigList = []): object {
        // set the corresponding evaluator for each prop present into evaluators
        evaluators.forEach(({ key, evaluator: expressionValueEvaluator }) => {

            let observationReturnedValue: any = null;

            Observe.currentEvaluator = () => {
                // the function responsible of containing the observation expression is expressionValueEvaluator
                // when we call it, each accessed observables' props will store the evaluator as dependency

                // if the evaluator is not an af, this will point to the observer obj
                observationReturnedValue = expressionValueEvaluator.call(futureObserver);
            }

            // initial evaluation with implicit dependencies registration thanks to the call
            Observe.currentEvaluator();

            // initial setting of results is part of the initial evaluation
            Object.defineProperty(futureObserver, key, {
                get() {
                    return observationReturnedValue;
                }
            })

            // free the static prop for the next call to Observe.observer
            Observe.currentEvaluator = null;

        });

        return futureObserver;
    }

    private static currentEvaluator: NullableEvaluator = null;

}

/**
 * Used by the 'set' trap when an object has to be replaced
 * with a non object. It will clean up all references to executors
 * of the object we are replacing
 *
 * @param {UnknownObject} innerObj the object to clean
 */
function removeAllDependenciesRecursively(innerObj: UnknownObject) {
    for (const k in innerObj) {
        if (innerObj.hasOwnProperty(k)) {
            if (isObject(innerObj[k])) {
                // recursively erase all dependencies
                removeAllDependenciesRecursively(innerObj[k]);
            }
            // the proxy will handle the deletion of
            // references to evaluators
            delete innerObj[k];
        }
    }
}

