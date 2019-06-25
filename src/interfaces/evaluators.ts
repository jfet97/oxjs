export interface observationValueEvaluatorFunc {
    (this: void): void
}
export interface expressionValueEvaluatorFunc {
    (): any
}

export interface evaluatorOptions {
    prop: string | number | symbol,
    evaluator: expressionValueEvaluatorFunc,
}

