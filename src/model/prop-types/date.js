import {isDate} from "lodash/lang"

export default (value, parentName, key) => {
    if(value && !isDate(value)){
        throw new Error(`Value ${key} in ${parentName} is expected to be date! ${value}`);
    }

    return value;
}