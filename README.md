# oxjs

__OxJS__ is a working in progress library written in TS that enable encapsulated reactivity, distantly inspired by VueJS way to handle properties changes.

## simple observables

```js
const { ox } = require('oxjs');

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
        prop: 'reactiveProp',
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
const { ox } =  require('oxjs');

// it creates an observable source from an object literal with nested properties
const $source = ox.observable({ nested: { value: 0, value2: 0 } });

// the observer will have three reactiver props
const observer = ox.observer({}, [
    {
        prop: 'doubleValue',
        evaluator() {
            return $source.nested.value;
        }
    },
    {
        prop: 'valueMinusOne',
        evaluator() {
            return $source.nested.value2;
        }
    },
    {
        prop: 'n',
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