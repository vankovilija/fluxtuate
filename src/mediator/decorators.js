import {fluxtuateUpdateFunction, fluxtuateNameProperty} from "./_internals"

export function updateFunction(target, name) {
    target[fluxtuateUpdateFunction] = name;
}

export function nameProperty(target, name) {
    target[fluxtuateNameProperty] = name;
}