import { DependenciesStore } from "./interfaces/DependenciesStore";
import { Evaluator, NullableEvaluator } from "./types/Evaluator";
import { Keys } from "./types/Keys";

export default class implements DependenciesStore {

    private evaluatorsMap: Map<Keys, Evaluator[]> = new Map();

    public init(key: Keys): void {
        this.evaluatorsMap.set(key, [] as Evaluator[]);
    }

    public subscribe(key: Keys, evaluator: NullableEvaluator): void {

        // an 'undefined' evaluatorsList should not happen because of 'init()' method
        const evaluatorsList: Evaluator[] = this.evaluatorsMap.get(key) as Evaluator[];

        if (typeof evaluator === "function" && !evaluatorsList.includes(evaluator)) {
            // !evaluatorsList.includes(evaluator)
            // will avoid duplications when:
            // 1) a dependencies is present more than one in a evaluator
            // 2) the evaluator is replayed during update process
            evaluatorsList.push(evaluator);
        }
    }

    public notify(key: Keys): void {
        // an 'undefined' evaluatorsList should not happen because of 'init()' method
        const evaluators: Evaluator[] = this.evaluatorsMap.get(key) as Evaluator[];

        evaluators.forEach(fn => fn())
    }

    public delete(key: Keys): void {
        this.evaluatorsMap.delete(key);
    }
}

