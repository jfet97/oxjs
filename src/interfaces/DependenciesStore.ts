export interface DependenciesStore {
    init(key: PropertyKey): void;
    subscribe(key: PropertyKey, evaluator: Evaluator): void;
    notify(key: PropertyKey): void;
    delete(key: PropertyKey): void;
}