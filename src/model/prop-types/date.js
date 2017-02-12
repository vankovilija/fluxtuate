import {isDate} from "lodash/lang"
import ObservableDate from "../observable-date"

export default (value, parentName, key) => {
    if(value === undefined) return undefined;

    if(value){
        if(!isDate(value)){
            throw new Error(`Value ${key} in ${parentName} is expected to be date! ${value}`);
        }
        return ObservableDate.getInstance(value, key, parentName);
    }

    return value;
}