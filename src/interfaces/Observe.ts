import { evaluatorOptions } from './evaluators';
import { observationValueEvaluatorFunc } from './evaluators';

export interface ObserveConstructorInterface {
    observable(obj: object): object;
    observer(obj: object, evaluators: evaluatorOptions[]): object;
}

export abstract class ObserveAbstractParentClass {
    protected static observationValueEvaluator: observationValueEvaluatorFunc | null = null;
}