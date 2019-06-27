# oxjs

__OxJS__ is a working in progress library written in TS that enable encapsulated reactivity, distantly inspired by VueJS way to handle properties changes.

* [simple observables](#simple-observables)
* [nested observables](#nested-observables)
* [tips for TS devs](#tips-for-ts-devs)

## simple observables

```js
import { ox } from 'oxjs';

// it creates two observable sources from two object literals
const $source1 = ox.observable({
    years: 32,
});

const $source2 = ox.observable({
    name: 'Mario',
});

// it creates an observer from an empty object
// setting to it a prop called 'reactiveProp'
const observer = ox.observer({}, [
    {
        key: 'reactiveProp',
        // we need an evaluator prop that will be called each time
        // one of the used observables changes
        evaluator() {
            // the value of 'reactiveProp' will be the
            // returned value
            return `My name is ${$source2.name} and I'm ${$source1.years} years old`;
        }
    },
]);

// initial evaluation
console.log(observer.reactiveProp); // My name is Mario and I'm 32 years old

// we change the stored 'years' inside $source1
$source1.years = 28;

// the observer is updated
console.log(observer.reactiveProp); // My name is Mario and I'm 28 years old

// we change the stored 'name' inside $source2
$source2.name = 'Luigi';

// the observer is updated, again
console.log(observer.reactiveProp); // My name is Luigi and I'm 28 years old
```

## nested observables

```js
import { ox } from 'oxjs';

// it creates an observable source from an object literal with nested properties
const $source = ox.observable({ nested: { value: 0, value2: 0 } });

// the observer will have three reactiver props
const observer = ox.observer({}, [
    {
        key: 'doubleValue',
        evaluator() {
            return $source.nested.value;
        }
    },
    {
        key: 'valueMinusOne',
        evaluator() {
            return $source.nested.value2;
        }
    },
    {
        key: 'n',
        evaluator() {
            return $source.nested;
        }
    }
]);

// see how encapsulated reactivity works
setInterval(() => {
    $source.nested.value++;
    $source.nested.value2--;

    console.log("observer.doubleValue: ", observer.doubleValue);
    console.log("observer.valueMinusOne: ", observer.valueMinusOne);
    console.log("observer.n: ", observer.n);
}, 1000);

// after three seconds the '$source.nested' parent reference will be changed
// but also nested observables will update accordingly
setTimeout(() => {
    $source.nested = { value: 100, value2: 200 };
}, 3000);
```

## tips for TS devs

__OxJS__ is written in TS and it's able to mantain types for _observables_ and is able to extract types from the array of `key`-`executor` pair for _observers_.
For the latter though TS needs a little help.


### observable
```js
const $source1 = ox.observable({
    years: 32,
});

// typeof $source1 is { years: number }
```

### observer
You have to pass an array as narrow as possible (from a type point of view) to correctly exctract type info.
```js
const observer = ox.observer([
    {
        key: 'doubleValue',
        evaluator() {
            return $source1.years * 2,
        }
    },
] as const); // <- see here 

// typeof observer is { doubleValue: number }
```