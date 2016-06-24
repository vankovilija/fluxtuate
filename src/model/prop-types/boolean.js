import {isBoolean} from "lodash/lang"

export default (value = false, parentName, key) => {
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