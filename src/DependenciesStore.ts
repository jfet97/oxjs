import { DependenciesStore } from "./interfaces/DependenciesStore";

export default class implements DependenciesStore {

    private evaluatorsMap: Map<PropertyKey, Evaluator[]> = new Map();

    public init(key: PropertyKey): void {
        this.evaluatorsMap.set(key, [] as Evaluator[]);
    }

    public subscribe(key: PropertyKey, evaluator: Evaluator): void { // record()

        const evaluatorsList: Evaluator[] | undefined = this.evaluatorsMap.get(key);

        if (typeof evaluator === "function" && evaluatorsList && !evaluatorsList.includes(evaluator)) {
            // !evaluatorsList.includes(evaluator)
            // will avoid duplications when:
            // 1) a dependencies is present more than one in a evaluator
            // 2) the evaluator is replayed during update process
            evaluatorsList.push(evaluator);
        }
    }

    public notify(key: PropertyKey): void {
        const evaluators: Evaluator[] | undefined = this.evaluatorsMap.get(key);

        if (evaluators) {
            evaluators.forEach(fn => fn())
        };
    }

    public delete(key: PropertyKey): void {
        this.evaluatorsMap.delete(key);
    }
}

