# oxjs
## work in progress

```js
const ox =  require('oxjs');

const source = { nested: { value: 0, value2: 0 } };
const $source = ox.observable(source);

const observer = ox.observer({}, [
    {
        prop: 'doubleValue',
        evaluator: () => function ($source) {
            return $source.nested.value;
        }($source)
    },
    {
        prop: 'valueMinusOne',
        evaluator: () => function ($source) {
            return $source.nested.value2;
        }($source)
    },
    {
        prop: 'n',
        evaluator: () => function ($source) {
            return $source.nested;
        }($source)
    }
]);


setInterval(() => {
    ($source).nested.value++;
    ($source).nested.value2--;
    console.log("observer.doubleValue: ", observer.doubleValue);
    console.log("observer.valueMinusOne: ", observer.valueMinusOne);
    console.log("observer.n: ", observer.n);
}, 3000);

setTimeout(() => {
    $source.nested = { value: 100, value2: 200 };
}, 10000); 
```