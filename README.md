[![NPM version](https://img.shields.io/npm/v/oxjs.svg)](https://www.npmjs.com/package/oxjs) [![license](https://img.shields.io/github/license/mashape/apistatus.svg)](https://github.com/jfet97/oxjs/blob/master/LICENSE) ![](https://img.shields.io/npm/dt/oxjs.svg) ![](https://img.shields.io/badge/dependencies-no%20dependencies-%231e88e5%20.svg)
# oxjs

__OxJS__ is a working in progress library written in TS that enable encapsulated reactivity, distantly inspired by VueJS reactivity system.\
The library is compiled into UMD format and uses ES6 Proxies.

```sh
$ npm i -S oxjs
```

* [oxjs bases](#oxjs-bases)
* [reactive primitives](#reactive-primitives)
* [reactive objects](#reactive-objects)
* [mixed observers](#mixed-observers)
* [nested observables props](#nested-observables-props)
* [reactive arrays](#reactive-arrays)
* [observable observers](#observable-observers)
* [observerByProps](#observerByProps)
* [tips for TS devs](#tips-for-ts-devs)
* [tests](#tests)
* [issues](#issues)

&nbsp;

## oxjs bases

### ox.observable<T extends object\>(obj: T): T
This method takes an object or an array and transform it into an __observable__, so its fields can be used inside an evaluator to be observed (more on evaluators later):
```js
const $observable = ox.observable({ a: 5 });

// or

const obj = { a: 5 };
const $observable = ox.observable(obj);
```

In the latter case, be sure to apply changes on `$observable` from this point on or observers won't be notified:
```js
obj.a = newValue; // WRONG

$observable.a = newValue; // NICE
```

### ox.observer<T extends Evaluator\>(evaluator: T): ReturnType<T\>
This method takes a function, called __evaluator__, and uses it to produce an __observer__.\
Inside the evaluator, observables' fields will be used, and a value should be retured as the result of the observation process.

```js
const $observable = ox.observable([1, 2, 3]);

const sumObserver = ox.observer(function evaluator() {
    // take values from the observable
    const _0 = $observable[0];
    const _1 = $observable[1];
    const _2 = $observable[2];

    // return a result
    return _0 + _1 + _2;
});
```
The `sumObserver` observer is called __reactive primitive__ because it will act as a `number`. In particular its value will be always the sum of the first three fields of the `$observable` array, also when one of them will change.\
That is because those fileds are accessed into the __evaluator__, so each time one of them changes, the __evaluator__ will be called updating the `sumObserver` value:

```js
console.log(`${sumObserver}`); // 6

// update the $observable
$observable[0] = 5;

console.log(`${sumObserver}`); // 10
```

## reactive primitives
__OxJS__ let you create special reactive objects that act like a primitive:

```js
const { ox } = require('oxjs');

// it creates two observable sources from two object literals
const $source1 = ox.observable({
    years: 32,
});

const $source2 = ox.observable({
    name: 'Mario',
});

// it creates an observer that will behave as a string
const stringObserver = ox.observer(() => `My name is ${$source2.name} and I'm ${$source1.years} years old`);

// WARNING
typeof stringObserver; // object

// initial evaluation
// interpolation is used because 'stringObserver' is not a real string primitive, it behaves like a String object
// so you need to use interpolation, or to call methods like valueOf(), toString()
console.log(`${stringObserver}`); // My name is Mario and I'm 32 years old

// we change the stored 'years' inside $source1
$source1.years = 28;

// the 'stringObserver' is updated
console.log(`${stringObserver}`); // My name is Mario and I'm 28 years old

// we change the stored 'name' inside $source2
$source2.name = 'Luigi';

// the 'stringObserver' is updated
console.log(`${stringObserver}`); // My name is Luigi and I'm 28 years old

// because 'stringObserver' behaves like a String object, you can use it
// almost everywhere a string is expected and you have access to all of String.prototype methods
stringObserver + "!!!"; // My name is Luigi and I'm 28 years old!!!
stringObserver.toUpperCase(); // MY NAME IS LUIGI AND I'M 28 YEARS OLD!!!

// WARNING HERE: 'stringObserver' is a String object and objects are truthy values
if(stringObserver) { // the condition is always true
// you have to extract its value implicitly or explicitly
if(stringObserver != "") { // coercion :3
if(stringObserver.toString()) {


// same for number and boolean observers
const numberObserver = ox.observer(() => $source1.years * 10);
const booleanObserver = ox.observer(() => $source1.years < 100);

// WARNING
typeof numberObserver; // object
typeof booleanObserver; // object

console.log(`${numberObserver}`); // 280
console.log(`${booleanObserver}`); // true

// we change the stored 'years' inside $source1
$source1.years = 100;

console.log(`${numberObserver}`); // 1000
console.log(`${booleanObserver}`); // false

numberObserver.toExponential(); // 1.00e+3

// WARNING HERE: 'booleanObserver' is a Boolean object and objects are truthy values
booleanObserver && true; // true
// you have to extract its value
booleanObserver.valueOf() && true; // false

// WARNING HERE: 'numberObserver' is a Number object and objects are truthy values
if(numberObserver) { // the condition is always true
// you have to extract its value implicitly or explicitly
if(numberObserver != 0) { // coercion, again :)
if(numberObserver.valueOf()) {
```

## reactive objects
Obviously we are not limited to primitives:

```js
const { ox } = require('oxjs');

// it creates two observable sources from two object literals
const $source1 = ox.observable({
    years: 32,
});

const $source2 = ox.observable({
    name: 'Mario',
});

// it creates a reactive object
const reactiveObject = ox.observer(() => {
    const years = $source1.years;
    const name = $source2.name;
    return {
        years,
        identity: {
            name
        }
    }
});


// initial evaluation
console.log(reactiveObject); // { years: 32, identity: { name: 'Mario' } }

// we change the stored 'years' inside $source1
$source1.years = 28;

// the 'reactiveObject' is updated
console.log(reactiveObject); // { years: 28, identity: { name: 'Mario' } }

// we change the stored 'name' inside $source2
$source2.name = 'Luigi';

// the 'reactiveObject' is updated
console.log(reactiveObject); // { years: 28, identity: { name: 'Luigi' } }
```

## mixed observers
You can mix primitives and objects observers, if you ever find a valid reason to do it:

```js
const { ox } = require('oxjs');

// it creates two observable sources from two object literals
const $source1 = ox.observable({
    years: 32,
});

const $source2 = ox.observable({
    name: 'Mario',
});

const reactiveMess = ox.observer(() => {
    const years = $source1.years;
    const name = $source2.name;

    if (years < 40) {
        return `${years} years aren't enough`;
    } else {
        return {
            years,
            identity: {
                name
            }
        }
    }
});

// initial evaluation
console.log(reactiveMess.valueOf()); // "32 years aren't enough"

// update years
$source1.years = 50;

console.log(reactiveMess.valueOf()); // { years: 50, identity: { name: 'Mario' } }
```

## nested observables props
Observables could have nested props:

```js
const { ox } = require('oxjs');

// it creates an observable source from an object literal with nested properties
const $source = ox.observable({ nested: { value1: 0, value2: 0 } });

// the observer will have three reactiver props
const observer = ox.observer(() => ({
    doubleValue1: $source.nested.value1 * 2,
    value2MinusOne: $source.nested.value2 - 1,
    nested: $source.nested,
}));

// see how encapsulated reactivity works
setInterval(() => {
    $source.nested.value1++;
    $source.nested.value2--;

    console.log("observer.doubleValue: ", observer.doubleValue1);
    console.log("observer.valueMinusOne: ", observer.value2MinusOne);
    console.log("observer.nested: ", observer.nested);
}, 1000);

// after three seconds the '$source.nested' parent reference will be changed
// but also nested observables will update accordingly
setTimeout(() => {
    $source.nested = { value1: 100, value2: 200 };
}, 3000);
```
## reactive arrays
__OxJS__ is pretty good with arrays as well:
```js
const { ox } = require("oxjs");

const $source = ox.observable([1, 2, 3]);

const sum = ox.observer(() => $source.reduce((a, v) => {
    return a + v;
}, 0));

console.log(`reduce result is: ${sum}`); // reduce result is: 6

$source[3] = 4;

console.log(`reduce result is: ${sum}`); // reduce result is: 10

$source.push(10)

console.log(`reduce result is: ${sum}`); // reduce result is: 20

$source.shift()

console.log(`reduce result is: ${sum}`); // reduce result is: 19
```

## observable observers
Observers can be used as observables, increasing the power in your hands.

Example with __objects__:
```js
const {ox} = require("oxjs");

const $source = ox.observable({foo: 42}); 

// { foo: 84 }
const $doubleSource = ox.observable(ox.observer(() => ({foo: $source.foo * 2})));

// 83
const doubledFooMinusOne = ox.observer(() => $doubleSource.foo - 1);

// "doubledFooMinusOne is 83"
console.log(`doubledFooMinusOne is ${doubledFooMinusOne}`);

$source.foo = 10; // $doubleSource: { foo: 20 }

// "doubledFooMinusOne is 19"
console.log(`doubledFooMinusOne is ${doubledFooMinusOne}`);
```
Here _$doubleSource_ is both an __observer__, because it does observe _$source.foo_ doubling its value as result, and an __observable__, used by another observer: _doubledFooMinusOne_.
&nbsp;

Example with __arrays__:
```js
const { ox } = require("oxjs");

const $source = ox.observable([1, 2, 3]);

// [2, 4, 6]
const $doubleMappedSource = ox.observable(ox.observer(() => $source.map(x => x * 2)));

// 12
const sum = ox.observer(() => $doubleMappedSource.reduce((a, b) => a + b, 0));
// 3
const length = ox.observer(() => $doubleMappedSource.length);

// 12 - 3
console.log(`${sum} - ${length}`);

$source.push(4); // $source: [1, 2, 3, 4], $doubleMappedSource: [2, 4, 6, 8]

// 20 - 4
console.log(`${sum} - ${length}`);
```
Here _$doubleMappedSource_ is both an __observer__, because it does observe _$$source_ doubling its values as result, and an __observable__, used by both _sum_ and _length_ observers.

## observerByProps
The `observer` method is very powerful, because let you return an observable of any kind. But when it comes to create a _reactive object_, each time an observable source on which it depends changes, the whole observer is recreated from scratch.\
This could constitute performance problems when heavy reactive objects are needed.\
Thankfully __OxJS__ provides an API to let you specify a separate observer for each reactive property:

```js
const { ox } = require('oxjs');

// it creates an observable source from an object literal with nested properties
const $source = ox.observable({ nested: { value1: 0, value2: 0 } });

// the observer will have three reactive props
const observer = ox.observerByProps([
    {
        key: 'doubleValue1',
        evaluator() {
            return $source.nested.value1 * 2;
        }
    },
    {
        key: 'value2MinusOne',
        evaluator() {
            return $source.nested.value2 - 1;
        }
    },
    {
        key: 'nested',
        evaluator() {
            return $source.nested;
        }
    }
]);

// see how encapsulated reactivity works
setInterval(() => {
    $source.nested.value1++;
    $source.nested.value2--;

    console.log("observer.doubleValue: ", observer.doubleValue1);
    console.log("observer.valueMinusOne: ", observer.value2MinusOne);
    console.log("observer.nested: ", observer.nested);
}, 1000);

// after three seconds the '$source.nested' parent reference will be changed
// but also nested observables will update accordingly
setTimeout(() => {
    $source.nested = { value1: 100, value2: 200 };
}, 3000);
```

Currenlty nested props into the `observer` are not supported. You cannot use Symbols as keys.


## tips for TS devs

__OxJS__ is written in TS and it's able to mantain types for _observables_ and is able to extract types from the array of `key`-`executor` pair for _observers_ created with `observerByProps`.\
For the latter though TS needs a little help.


### observable
```js
const $source1 = ox.observable({
    years: 32,
});

// typeof $source1 is { years: number }
```

### observer created with observerByProps
You have to pass an array as narrow as possible (from a type point of view) to correctly exctract type info.
```js
const observer = ox.observerByProps([
    {
        key: 'doubleValue',
        evaluator() {
            return $source1.years * 2;
        }
    },
] as const); // <- see here

// typeof observer is { doubleValue: number }
```

### observer created with observer
_Observers_ created with `observe` deserve a separate discussion.\
If a _reactive object_ is generated, TS will infer the correct type:
```js
const observer = ox.observer(() => ({
    doubleValue: $source1.years * 2,
}));

// typeof observer is { doubleValue: number }
```

If a _reactive primitive_ is generated, TS will infer the primitive type:
```js
const observer = ox.observer(() => $source1.years * 2));

// typeof observer is number, not Number
```

## tests
Incoming...

## issues
Creating __reactive primitives__ was a mess for me, for Typescript and for ES6 proxies. Have you ever seen a proxy with a dynamic target?\
So if something does explode, please be patient and open a polite issue.
