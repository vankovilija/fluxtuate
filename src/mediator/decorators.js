import {fluxtuateUpdateFunction, fluxtuateNameProperty, boundModels} from "./_internals"

export function updateFunction(target, name) {
    target[fluxtuateUpdateFunction] = name;
}

export function nameProperty(target, name) {
    target[fluxtuateNameProperty] = name;
}

function processProperty(bindFunction, target, key, descriptor) {

    if(key === undefined || typeof descriptor.value === "function") throw new Error(`You can only bind properties of a mediator!`);

    if(!target[boundModels]) target[boundModels] = [];
    target[boundModels].push({key, bindFunction});
    
    return descriptor;
}

export function bindModel(bindFunction, ...args) {
    if (args.length === 0) {
        return processProperty.bind(this, bindFunction);
    } else if (args.length === 2) {
        return processProperty.apply(this, [(payload)=>payload.data, bindFunction, ...args]);
    }
}