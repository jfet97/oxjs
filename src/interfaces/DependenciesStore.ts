import { observationValueEvaluatorFunc } from './evaluators';

interface DependenciesStoreInterface {
    init(key: string | symbol | number): void;
    subscribe(key: string | symbol | number, evaluator: observationValueEvaluatorFunc | null): void;
    notify(key: string | symbol | number): void;
    delete(key: string | symbol | number): void;
}

export abstract class DependenciesStoreAbstractParentClass implements DependenciesStoreInterface {
    protected evaluatorsMap: Map<string | symbol | number, observationValueEvaluatorFunc[]> = new Map();
    abstract init(key: string | symbol | number): void;
    abstract subscribe(key: string | symbol | number, evaluator: observationValueEvaluatorFunc | null): void;
    abstract notify(key: string | symbol | number): void;
    abstract delete(key: string | symbol | number): void;
}