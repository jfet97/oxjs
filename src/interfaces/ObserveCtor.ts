import { Evaluator } from "../types/Evaluator";
import { EvaluatorsConfigList } from "../types/EvaluatorsConfigList";

export interface ObserveCtor {
    observable<T extends object>(obj: T): T;
    observer<T extends Evaluator>(evaluator: T): ReturnType<T>;
    observerByProps<T extends Readonly<EvaluatorsConfigList>>(evaluatorsConfigs: T): {
        [K in T[number]['key']]: ReturnType<Extract<T[number], { key: K }>['evaluator']>
    }
}