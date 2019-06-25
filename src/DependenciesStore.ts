import { DependenciesStoreAbstractParentClass } from './interfaces/DependenciesStore';
import { observationValueEvaluatorFunc } from './interfaces/evaluators';

export class DependenciesStore extends DependenciesStoreAbstractParentClass {

    init(key: string | symbol | number): void {
        this.evaluatorsMap.set(key, []);
    }

    subscribe(key: string | symbol | number, evaluator: observationValueEvaluatorFunc | null): void { // record()

        const entry: observationValueEvaluatorFunc[]|undefined = this.evaluatorsMap.get(key);

        if (evaluator && (entry && !entry.includes(evaluator))) {
            // !this.evaluatorsMap.get(key).includes(evaluator)
            // will avoid duplications when:
            // 1) a dependencies is present more than one in a evaluator
            // 2) the evaluator is replayed during update process
            entry.push(evaluator);
        }
    }

    notify(key: string | symbol | number, ): void {
        const entry: observationValueEvaluatorFunc[] | undefined = this.evaluatorsMap.get(key);
        entry && entry.forEach(fn => fn());
    }

    delete(key: string | symbol | number): void {
        this.evaluatorsMap.delete(key);
    }
}

