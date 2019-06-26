export interface ObserveCtor {
    observable<T extends object>(obj: T): T;
    observer(obj: object, evaluators: EvaluatorsConfigList): object;
}