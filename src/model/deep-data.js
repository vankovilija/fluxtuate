import {isArray, isDate} from "lodash/lang"

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

    Object.getOwnPropertyNames(o).forEach(function (prop) {
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

    return o;
}