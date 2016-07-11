import {fluxtuateUpdateFunction, fluxtuateNameProperty, boundModels, autoDispatches} from "./_internals"

export function updateFunction(target, name) {
    target[fluxtuateUpdateFunction] = name;
}

export function nameProperty(target, name) {
    target[fluxtuateNameProperty] = name;
}

function processBindProperty(bindFunction, target, key, descriptor) {

    if(key === undefined || typeof descriptor.value === "function") throw new Error(`You can only bind properties of a mediator!`);

    if(!target[boundModels]) target[boundModels] = [];
    target[boundModels].push({key, bindFunction});
    
    return descriptor;
}

export function bindModel(bindFunction, ...args) {
    if (args.length === 0) {
        return processBindProperty.bind(this, bindFunction);
    } else if (args.length === 2) {
        return processBindProperty.apply(this, [(payload)=>payload.data, bindFunction, ...args]);
    }
}

function processDispatchProperty(dispatchKey, target, key, descriptor) {

    if(key === undefined ) throw new Error(`You can only bind properties of a mediator!`);
    
    if(!target[autoDispatches]) target[autoDispatches] = [];
    target[autoDispatches].push({key, dispatchKey});

    descriptor.configurable = true;

    return descriptor;
}

export function autoDispatch(dispatchKey, ...args) {
    if (args.length === 0) {
        return processDispatchProperty.bind(this, dispatchKey);
    } else if (args.length === 2) {
        return processDispatchProperty.apply(this, [args[0], dispatchKey, ...args]);
    }
}