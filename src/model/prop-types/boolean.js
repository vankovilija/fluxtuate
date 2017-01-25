import {isBoolean} from "lodash/lang"

export default (value, parentName, key) => {
    if(value === undefined) return undefined;

    if(value === "true")
        value = true;
    else if (value === "false") {
        value = false;
    }

    if(!isBoolean(value)){
        throw new Error(`Value ${key} in ${parentName} is expected to be boolean! ${value}`);
    }

    return value;
}