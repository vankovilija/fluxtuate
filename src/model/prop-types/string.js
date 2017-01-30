import {isString} from "lodash/lang"

export default (value, parent, key) => {
    if(value === undefined) return undefined;

    let originalValue = value;
    value = String(value);
    if(!isString(value)) {
        throw new Error(`Value ${key} in ${parent} is expected to be string! ${originalValue}`)
    }
    
    return value;
}