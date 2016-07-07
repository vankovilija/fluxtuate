import {primaryKey, properties} from "./_internals"
import {isBoolean} from "lodash/lang"
import reservedWords from "./reserved"


function applyOnTarget(propertyType, isPrimary, JSONPropertyName, target, key, descriptor) {
    if(key === undefined) throw new Error(`You can't inject values to classes, only to class properties of type function!`);

    if(reservedWords.indexOf(key) !== -1) {
        throw new Error(`${key} is a reserved word, you can't define a property on a model with this name! Please use a different name on the model but define a alternative property as the third parameter in the property descriptor for parsing JSON data with that name.`);
    }

    if(!JSONPropertyName) {
        JSONPropertyName = key;
    }

    if (typeof descriptor.value === "function")
        throw new Error(`You can only inject values to properties of the class!`);

    if(isPrimary) {
        if(target[primaryKey])
            throw new Error(`You are trying to set property ${key} as a primary key on a model that already has a primary key of value ${target[primaryKey]}`);
        target[primaryKey] = key;
    }
    
    if(Object.getOwnPropertySymbols(target).indexOf(properties) === -1) {
        target[properties] = {};
    }
    
    target[properties][JSONPropertyName] = {convert: propertyType, modelKey: key, defaultValue: target[key]};

    descriptor.configurable = true;
    return descriptor;
}

export default function(propertyType, isPrimary = false, JSONPropertyName) {
    if(isBoolean(isPrimary)) {
        return applyOnTarget.bind(this, propertyType, isPrimary, JSONPropertyName);
    }else{
        return applyOnTarget.apply(this, [Object, false, undefined, propertyType, isPrimary, JSONPropertyName]);
    }
}