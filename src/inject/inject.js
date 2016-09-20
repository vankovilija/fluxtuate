import {injectionKey} from "./_internals"

function processProperty(iKey, target, key, descriptor) {

    if(key === undefined) throw new Error(`You can't inject values to classes, only to class properties of type function!`);

    if (typeof descriptor.value === "function")
        throw new Error(`You can only inject values to properties of the class!`);

    target[key] = {};
    target[key][injectionKey] = iKey;

    descriptor.configurable = true;
    return descriptor;
}

export default function inject(iKey, ...args) {
    if(args.length === 0) {
        return processProperty.bind(this, iKey);
    }else if(args.length === 2){
        return processProperty.apply(this, [args[0], iKey, ...args]);
    }
}
