import { Evaluator } from "../types/Evaluator";
import { Keys } from "../types/Keys";

export interface EvaluatorsConfig {
    readonly key: Keys,
    readonly evaluator: Evaluator,
}