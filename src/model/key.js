import {primaryKey} from "./_internals"

export default function (target, key, descriptor) {
    if(key === undefined) throw new Error(`You can't inject values to classes, only to class properties of type function!`);

    if (typeof descriptor.value === "function")
        throw new Error(`You can only inject values to properties of the class!`);

    
    target[primaryKey] = key;
}