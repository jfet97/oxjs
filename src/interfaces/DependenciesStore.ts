import { NullableEvaluator } from "../types/Evaluator";
import { Keys } from "../types/Keys";

export interface DependenciesStore {
    init(key: Keys): void;
    subscribe(key: Keys, evaluator: NullableEvaluator): void;
    notify(key: Keys): void;
    delete(key: Keys): void;
}