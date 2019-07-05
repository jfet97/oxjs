import { DependenciesStore } from "./interfaces/DependenciesStore";
import { Evaluator, NullableEvaluator } from "./types/Evaluator";
import { Keys } from "./types/Keys";

export default class implements DependenciesStore {

    private evaluatorsMap: Map<Keys, Evaluator[]> = new Map();

    public init(key: Keys): void {
        this.evaluatorsMap.set(key, [] as Evaluator[]);
    }

    public subscribe(key: Keys, evaluator: NullableEvaluator): void {

        // an 'undefined' evaluators should not happen because of 'init()' method
        // but it happens if a client tries to get a property that was not initially defined
        // this could happen inside an evaluator for example
        let evaluators: Evaluator[];

        if (typeof this.evaluatorsMap.get(key) === "undefined") {
            this.init(key);
        }

        evaluators = this.evaluatorsMap.get(key) as Evaluator[];

        if (typeof evaluator === "function" && !evaluators.includes(evaluator)) {
            // !evaluators.includes(evaluator)
            // will avoid duplications when:
            // 1) a dependencies is present more than one in a evaluator
            // 2) the evaluator is replayed during update process
            evaluators.push(evaluator);
        }
    }

    public notify(key: Keys): void {
        // an 'undefined' evaluatorsList should not happen because of 'init()' method
        // but it happens if a client tries to set a property that was not initially defined
        // nor already used in a evaluator

        let evaluators: Evaluator[];

        if (typeof this.evaluatorsMap.get(key) === "undefined") {
            this.init(key);
        }

        evaluators = this.evaluatorsMap.get(key) as Evaluator[];

        evaluators.forEach(fn => fn())
    }

    public notifyAll(): void {
        [...this.evaluatorsMap.entries()].forEach(([key, evaluators]) => {
            evaluators.forEach(fn => fn())
        });
    }

    public delete(key: Keys): void {
        this.evaluatorsMap.delete(key);
    }
}

