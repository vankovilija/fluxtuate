import {isArray, isDate, isFunction} from "lodash/lang"

function processProp(prop, deepDataProperty) {
    if (prop !== null && !isDate(prop)
        && (typeof prop === "object" || typeof prop === "function")
        && !Object.isFrozen(prop)) {
        return deepData(prop, deepDataProperty);
    } else {
        return prop;
    }
}

export default function deepData(model, deepDataProperty) {
    let o = model;
    if (o[deepDataProperty]) {
        return o[deepDataProperty];
    }
    if(o.cloneProtected) {
        return o;
    }

    Object.getOwnPropertyNames(o).forEach(function (prop) {
        if(isFunction(o[prop])) {
            return;
        }

        if (isArray(o[prop])) {
            let propArray = [];
            o[prop].forEach((propElem)=> {
                propArray.push(processProp(propElem, deepDataProperty));
            });
            o[prop] = propArray;
        } else {
            o[prop] = processProp(o[prop], deepDataProperty);
        }
    });
    
    Object.freeze(o);

    return o;
}