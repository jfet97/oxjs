export interface ObserveCtor {
    observable(obj: UnknownObject): UnknownObject;
    observer(obj: UnknownObject, evaluators: EvaluatorsConfigList): UnknownObject;
}