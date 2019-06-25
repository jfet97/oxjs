export interface ObserveCtor {
    observable(obj: object): object;
    observer(obj: object, evaluators: EvaluatorsConfigList): object;
}