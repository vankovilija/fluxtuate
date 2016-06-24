import {isNumber} from "lodash/lang"

export default (value = 0, parentName, key) => {
    let orignalValue = value;
    value = Number(value);
    if(!isNumber(value)){
        throw new Error(`Value ${key} in ${parentName} is expected to be number! ${orignalValue}`);
    }

    return value;
}