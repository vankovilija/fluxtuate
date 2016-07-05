import ObservableArray from "../observable-array"
import {isArray} from "lodash/lang"
import instanceOf from "./instance-of"

function defineArrayProps(returnArray, name) {
    return new ObservableArray(returnArray, name);
}

function convert(conversionFunction, data = [], parentName, parentProperty){
    if(!isArray(data)) throw new Error("Value must be of type Array");

    let returnArray = data.map((d, i)=>{
        return conversionFunction(d, parentName, `${parentProperty}[${i}]`);
    });

    return defineArrayProps(returnArray, parentProperty);
}

export default function (valueClass = Object, typeProperty, typeChecks) {
    if(!isArray(valueClass) && typeChecks) {
        return convert.apply(this, [instanceOf(), valueClass, typeProperty, typeChecks]);
    }else{
        return convert.bind(this, instanceOf(valueClass, typeProperty, typeChecks));
    }
}