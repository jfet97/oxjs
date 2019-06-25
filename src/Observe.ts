import { ObserveAbstractParentClass, ObserveConstructorInterface } from './interfaces/Observe';
import { DependenciesStore } from './DependenciesStore'
import { evaluatorOptions } from './interfaces/evaluators';
import isObject from './utilities/isObject';
import isArray from './utilities/isArray';

class _Observe extends ObserveAbstractParentClass {

    static observable(obj: object | any[]): object | never {

        // immutability is the way
        let mutable: object | any[] = {};

        let copy: object | any[] = {};
        if (isArray(obj)) {
            // if it is an array
            copy = [...(obj as any[])];
        } else if (isObject(obj)) {
            // if obj is not null, an 'object' but not an array or a function
            copy = { ...obj }
        } else {
            throw new TypeError('observable method cannot work on primitives')
        }

        mutable = copy;


        // initialize a deps instance for each object/nested object
        const deps = new DependenciesStore();

        // recursively transform non primitive properties into proxed objects
        // mantaining immutability
        Object.entries(mutable).forEach(([key, value]) => {
            if ((value && typeof value === "object") || typeof value === "function") {
                (mutable as any)[key] = _Observe.observable(value);
            }
            // initialize deps storage for current key to an empty array
            deps.init(key);
        })

        return new Proxy(mutable, {

            get(proxedObj, key) {
                /* obj={a:{b:2}} -> (due to _Observe.observable) Proxy(obj){Proxy(a){b:2}}
                    
                    when we read 'b' in 'obj.a.b'
                    Proxy(obj).a will trigger this trap returning Proxy(a)
                    Proxy(a).b will trigger this trap and it will return Proxy(a).b
                    Both will set the evaluator dependency because if obj.a would be changed,
                    obj.a.b should be revaluated as well
                */

                // if the accessed prop is an object (a proxy in practice)
                // it will be returned to be accessed in a chain
                const res = Reflect.get(proxedObj, key);

                // record a evaluator
                deps.subscribe(key, _Observe.observationValueEvaluator);

                return res;
            },

            set(proxedObj, key, newValue) {
                /* obj={a:{b:2}} -> (due to _Observe.observable) Proxy(obj){Proxy(a){b:2}}
                    
                    when we change 'b' in obj.a.b = 9
                    Proxy(obj).a will trigger the get trap returning Proxy(a) without particular effects
                    because the evaluator dependency will already have been collected
                    Proxy(a).b = 9 will trigger this trap setting the new value and notifying obj.a.b observers

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
                    O-O) To not loose setted evaluators and to properly remove references from those referenced
                         by properties (deps) not present into the newValue, instead of replacing proxedObj.key with newValue
                         we assign to each prop of proxedObj.key the corresponding property present on newValue, recursively.
                         Because proxedObj.key is alreadyan observable, we haven't to restore reactivity.
                         Also the deleting of references has to made recursively: if a property is itself an object
                         we have to handle all its properties references deletion and then delete the initial property reference
                        
                    O-NO) If newValue is a primitive value, before discarding the reactive object contained by proxedObj.key,
                          we have to recursively remove all its references (deps) to its evaluators.

                    NO-O) We can simply make newValue a reactive object

                    NO-NO) Nothing special to do
                */


                // no problem for a possible evaluator insertion due to the get access to proxedObj.key
                // because _Observe.observationValueEvaluator is null
                const inner = Reflect.get(proxedObj, key);
                const isProxedObjKeyObject: boolean = isObject(inner);
                const isNewValueObject: boolean = isObject(newValue);


                let useReflectSet: boolean = false;
                let target: any = null;
                let propertyKey: any = '';
                let value: any = null;


                // O-O)
                if (isProxedObjKeyObject && isNewValueObject) {

                    // is strict mode, an unsuccessful Reflect.set operation applied to a proxed obj will trigger an Error
                    // Reflect.set is implied into the Object.entries(newValue) forEach

                    try {
                        Object.entries(newValue).forEach(([p, v]) => {
                            // to not loose current props' evaluators, instead of setting the new object value into proxedObj.key
                            // we assign to each prop to the inner proxed object
                            // to recursively trigger the set trap on the already presents props
                            // updating their vaues
                            (inner as any)[p] = v; // this implies a sort of recursion on each subprop...
                        });

                        // delete props that are not present on newValue
                        const innerKeys = Object.keys(inner);
                        const newValueKeys = Object.keys(inner);
                        for (const k of innerKeys) { // ...so this will be automatically executed also for subprops
                            if (!newValueKeys.includes(k)) {
                                delete inner[k];
                                // the proxy will handle the deletion of 
                                // references to evaluators
                            }
                        }

                        // proxedObj.key reference has not changed but it should have done
                        // this is only a workaround to not loose evaluators
                        // so we must anyway to notify the fake change to proxedObj.key
                        // calling deps.notify(propertyKey) later
                    } catch (e) {
                        throw e;
                    }

                    useReflectSet = false;
                    propertyKey = key;
                }

                // O-NO)
                if (isProxedObjKeyObject && !isNewValueObject) {

                    (function removeAllDependencies(obj) {
                        for (const k of obj) {
                            if (isObject(obj[k])) {
                                // recursively erase all dependencies
                                removeAllDependencies(obj[k]);
                            }
                            delete obj[k];
                        }
                    })(inner);

                    useReflectSet = true;
                    target = proxedObj;
                    propertyKey = key;
                    value = newValue;
                }

                // NO-O)
                if (!isProxedObjKeyObject && isNewValueObject) {
                    // if the inner value was a primitve
                    // and the newValue is an object
                    // we can simply made the new one reactive

                    useReflectSet = true;
                    target = proxedObj;
                    propertyKey = key;
                    value = _Observe.observable(newValue);
                }

                // NO-NO)
                if (!isProxedObjKeyObject && !isNewValueObject) {

                    useReflectSet = true;
                    target = proxedObj;
                    propertyKey = key;
                    value = newValue;
                }

                if (useReflectSet) {
                    // is strict mode, an unsuccessful Reflect.set operation applied to a proxed obj will trigger an Error
                    try {
                        Reflect.set(target, propertyKey, value);
                    } catch (e) {
                        throw e;
                    }

                }

                deps.notify(propertyKey); // to always notify subscribers about the change
                return true; // we come here only if there were no errors
            },

            deleteProperty(proxedObj, prop) {
                deps.delete(prop);
                Reflect.deleteProperty(proxedObj, prop);
                return true;
            }
        })
    }

    static observer(obj: object = {}, evaluators: evaluatorOptions[] = []): object {
        // set the corresponding evaluator for each prop present into evaluatorOptions[]
        evaluators.forEach(({ prop, evaluator }) => {

            let observationReturnedValue: any = null;

            _Observe.observationValueEvaluator = () => {
                // the function responsible of containing the observation expression
                // is expressionValueEvaluator
                // when we call it, all the dependencies will store this evaluator
                // the observationValueEvaluator will be stored in each observed prop's storage

                observationReturnedValue = evaluator.call(obj);
                // if the evaluator is not an af, this will be the observer obj
            }

            // initial evaluation + dependencies registration
            _Observe.observationValueEvaluator();

            Object.defineProperty(obj, prop, {
                get() {
                    return observationReturnedValue;
                }
            })

            // free the static for the next call to setObserver
            _Observe.observationValueEvaluator = null;

        });

        return obj;
    }

}

// constructor interface check
const Observe: ObserveConstructorInterface = _Observe;
export default Observe;

