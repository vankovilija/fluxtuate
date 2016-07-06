import {isFunction, isArray, isObject} from "lodash/lang"
import getOwnKeys from "../../utils/getOwnKeys"

function convert(valueType, typeProperty, typeChecks, value = {}, parentName, parentProperty) {

    if(!isObject(value)){
        throw new Error(`You must supply a value of object for property ${parentProperty} in ${parentName}!`);
    }

    
    if(isArray(valueType)){
        if(!isArray(typeChecks) || typeChecks.length !== valueType.length) throw new Error(`Type checks must be a array with the same length as value types if you are sending multiple value types for property ${parentProperty}`);
        let v = value;
        let propertyArray = typeProperty.split(".");
        for(let i = 0; i < propertyArray.length; i++) {
            if(!v[propertyArray[i]]) break;
            v = v[propertyArray[i]];
        } 
        valueType = valueType[typeChecks.indexOf(v)];
        if(!valueType) throw new Error(`No valid type found for property ${parentProperty}`);
    }
    
    if(valueType !== Object){
        if(value instanceof valueType) return value;
        let el;
        if(isFunction(valueType.prototype.update)){
            el = new valueType(`${parentName}.${parentProperty}`);
            el.update(value);
        }else{
            el = valueType(value, parentName, parentProperty);
            if(isObject(value)) {
                let keys = getOwnKeys(value);
                keys.forEach(key=> {
                    el[key] = value[key];
                });
            }
        }
        return el;
    }else{
        return value;
    }
}

export default (valueClass = Object, typeProperty, typeChecks) => {
    if(!isArray(valueClass) && typeChecks) {
        return convert.apply(this, [Object, undefined, undefined, valueClass, typeProperty, typeChecks]);
    }else{
        return convert.bind(this, valueClass, typeProperty, typeChecks);
    }
}