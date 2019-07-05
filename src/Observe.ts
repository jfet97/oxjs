import { staticImplements } from './decorators/staticImplements';
import Dependents from './Dependents';
import { ObserveCtor } from "./interfaces/ObserveCtor";
import { UnknownObject } from './interfaces/UnknownObject';
import { Evaluator, NullableEvaluator } from './types/Evaluator';
import { EvaluatorsConfigList } from './types/EvaluatorsConfigList';
import { Keys } from './types/Keys';
import { isArray } from './utilities/isArray';
import { isObject } from './utilities/isObject';
import { isStringOrNumericKey } from './utilities/isStringOrNumericKey';


@staticImplements<ObserveCtor>()
export class Observe {

    public static observable<T extends object>(obj: T): T {

        // initialize a dependents instance for each object/nested object
        const deps = new Dependents();


        // handle obj's keys
        Object.entries(obj).forEach(([key, value]) => {
            if (isObject(value)) {
                // recursively transform non primitive properties into proxed objects
                (obj as any)[key] = Observe.observable(value);
            }

            // initialize deps storage for each key of obj
            deps.init(key);
        })

        return new Proxy(obj, {

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

                // record the current evaluator, also if the property is not
                // already present in the object but not if it is not present because
                // it isn't an own property: properties like array methods
                // for arrays mustn't be recorded
                const isKeyIntoTarget = (key in proxedObj) && proxedObj.hasOwnProperty(key);
                const isKeyIntoTargetProto = (key in proxedObj) && !proxedObj.hasOwnProperty(key);

                if (
                    isStringOrNumericKey(key)
                    && (
                        (!isKeyIntoTarget && !isKeyIntoTargetProto)
                        || (isKeyIntoTarget && !isKeyIntoTargetProto)
                        || !(!isKeyIntoTarget && isKeyIntoTargetProto)
                        || (isKeyIntoTarget && isKeyIntoTargetProto)
                    )
                ) {
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
                const inner: unknown = Reflect.get(proxedObj, key); // inner === proxedObj.key
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
                            (inner as UnknownObject)[k] = v;
                        });

                        // delete props that are not present on newValue
                        const innerKeys = Object.keys((inner as UnknownObject));
                        const newValueKeys = Object.keys(newValue);
                        for (const k of innerKeys) { // ...so this will be automatically executed also for subprops
                            if (!newValueKeys.includes(k)) {
                                delete (inner as UnknownObject)[k];
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

                    removeAllDependenciesRecursively(inner as UnknownObject);

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

                // workaround to the following problematic code, where, unlike the $source.push(4) counterpart,
                // the length property is updated internally
                // the reduce observer watch the length property as well under the hood, so when the length is updated
                // who depends on it is updated too
                // it seems that methods likes push() update the length property in a way (maybe something like this.length)
                // that trigger the observer
                // modifying manually the array insted does not trigger anything, though the length is updated
                /*
                    const $source = ox.observable([1, 2, 3]);
                    const sum = ox.observer(() => source.reduce((a, v) => {
                        return a + v;
                    }, 0));
                    $source[3] = 4;
                */
                //
                // so, if the proxed obect is an array,
                // we notify "length" observer to be sure
                // when the key is not already 'length'
                if (isArray(target) && propertyKey! !== "length") {
                    deps.notify("length");
                }

                return true; // we come here only if there were no errors
            },

            deleteProperty(proxedObj, prop) {
                if (isStringOrNumericKey(prop)) {
                    deps.delete(prop);
                }
                Reflect.deleteProperty(proxedObj, prop);
                return true;
            }
        });
    }

    public static observer<T extends Evaluator>(evaluator: T): ReturnType<T> {

        type returnType = ReturnType<T>;

        // dinamicaly changeable proxy target
        // it could be an object or an array or a function
        // when the evaluator returns a primitive
        // we set realTarget to a corresponding wrapper object
        let realTarget: any;

        // the observer is a fully transparent proxy
        // we will dinamically change its target
        // each time the evaluator function is called
        //
        // I need to know if an array will be returned by the evaluator
        // because if so the fake target should be an array
        // to properly handle Array.isArray() and similar operations

        Observe.currentEvaluator = () => {
            // the function responsible of containing the observation expression is evaluator
            // when we call it, each accessed observables' props will store the evaluator as dependency
            const observationReturnedValue = evaluator.call(null);


            // if the resulting value of calling the evaluator is an object
            // we simply change the already returned proxy target
            // if the resulting value of calling the evaluator is a primitive
            // we set the proxy target to an object that could be used as a primitive
            realTarget = new Object(observationReturnedValue);
        }

        // initial evaluation with implicit dependencies registration thanks to the call
        // to the evaluator fn
        Observe.currentEvaluator();

        // free the static prop for the next calls
        Observe.currentEvaluator = null;


        const observer: returnType = new Proxy(isArray(realTarget) ? [] : ({}), {
            apply(_, thisArg, argumentsList) {
                // tslint:disable-next-line: ban-types
                return Reflect.apply(realTarget, thisArg, argumentsList);
            },
            construct(_, argumentsList) {
                // tslint:disable-next-line: ban-types
                return Reflect.construct(realTarget, argumentsList);
            },
            defineProperty(_, key, descriptor) {
                return Reflect.defineProperty(realTarget, key, descriptor);
            },
            deleteProperty(_, key) {
                return Reflect.deleteProperty(realTarget, key);
            },
            get(_, key) {
                let res = Reflect.get(realTarget, key, realTarget);
                if (typeof res === "function") {
                    res = res.bind(realTarget);
                }
                return res;
            },
            getOwnPropertyDescriptor(_, key) {
                // sorry for this hack, but String objects have got non configurable
                // properties (0,1,2,3,... for the letters and the length)
                // but the unused target, the void object, hasn't got non configurable properties
                // so this trap throws a TypeError if Object.getOwnPropertyDescriptor is called on the returned
                // proxy when the dynamic target is a String object.
                // "A property cannot be reported as non-configurable,
                // if it does not exists as an own property of the target object
                // or if it exists as a configurable own property of the target object."
                //
                // The main problem is that operations like console.log() and JSON.stringify()
                // trigger this trap (IDK why)
                //
                // So the dirty solution consist of force the configurability to true.
                // in reality it remains false, so a client won't be able to change its value anyway
                // but we know that console.log() and JSON.stringify() are not going to try to change anything

                let res = Reflect.getOwnPropertyDescriptor(realTarget, key);
                if (realTarget instanceof String) {
                    res = { ...res, configurable: true };
                }

                // no need to do it for arrays because the fake target
                // is an array too

                return res;
            },
            getPrototypeOf() {
                return Reflect.getPrototypeOf(realTarget)
            },
            has(_, key) {
                return Reflect.has(realTarget, key);
            },
            isExtensible() {
                return Reflect.isExtensible(realTarget);
            },
            ownKeys() {
                return Reflect.ownKeys(realTarget);
            },
            preventExtensions() {
                return Reflect.preventExtensions(realTarget);
            },
            set(_, key, value) {
                return Reflect.set(realTarget, key, value, realTarget);
            },
            setPrototypeOf(_, prototype) {
                return Reflect.setPrototypeOf(realTarget, prototype);
            },
        }) as returnType;

        return observer;
    }

    public static observerByProps<T extends Readonly<EvaluatorsConfigList>>(evaluatorsConfigs: T): {
        [K in T[number]['key']]: ReturnType<Extract<T[number], { key: K }>['evaluator']>
    } {

        type unionOfItems = T[number];
        type keysUnion = unionOfItems['key'];
        type returnType = {
            [K in keysUnion]: ReturnType<Extract<T[number], { key: K }>['evaluator']>
        }
        // example:
        // evaluatorsConfigs = [{key: 'prop1', evaluator: () => string}, {key: 'prop2', evaluator: () => number}]
        // unionOfItems -> [{readonly key: 'prop1', readonly evaluator: () => string}, {readonly key: 'prop2', readonly evaluator: () => number}]
        // keysUnion -> 'prop1' | 'prop2'
        // returnType -> { prop1: string, prop2: number}

        const observerUnderConstruction: returnType = {} as returnType;

        // set the corresponding evaluator for each prop present into evaluatorsConfigs
        evaluatorsConfigs.forEach(({ key, evaluator: expressionValueEvaluator }) => {

            // avoid duplicates key
            if (!(key in observerUnderConstruction)) {
                let observationReturnedValue: any = null;

                Observe.currentEvaluator = () => {
                    // the function responsible of containing the observation expression is expressionValueEvaluator
                    // when we call it, each accessed observables' props will store the evaluator as dependency

                    // if the evaluator is not an af, this will point to the observer obj
                    observationReturnedValue = expressionValueEvaluator.call(observerUnderConstruction);
                }

                // initial evaluation with implicit dependencies registration thanks to the call
                // to the evaluator fn
                Observe.currentEvaluator();

                // initial setting of results is part of the initial evaluation
                Object.defineProperty(observerUnderConstruction, key, {
                    get() {
                        // when evaluatorsConfigs will be called into question
                        // observationReturnedValue will be updated for each key
                        // so the returned value from this getter will change as well
                        return observationReturnedValue;
                    }
                });

                // free the static prop for the next calls
                Observe.currentEvaluator = null;
            }

        });

        return observerUnderConstruction;
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

