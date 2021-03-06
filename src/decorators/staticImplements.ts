// class decorator factory to check static side against a constructor interface
export function staticImplements<WANTED>() {
    return (
        <TO_CHECK extends WANTED>(constructor: TO_CHECK): TO_CHECK => constructor
    );
}