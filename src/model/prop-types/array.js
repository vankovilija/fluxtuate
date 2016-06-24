import {primaryKey} from "../_internals"
import {isArray, isFunction} from "lodash/lang"
import instanceOf from "./instance-of"

function defineArrayProps(returnArray) {
    returnArray.merge = (secondArray) => {
        let newArray = defineArrayProps(returnArray.slice());
        secondArray.forEach((elem)=>{
            if(elem[primaryKey]) {
                let realElem = newArray.find(elem[elem[primaryKey]]);
                if(realElem) {
                    if(isFunction(realElem.update))
                        realElem.update(elem.cleanData);
                    else{
                        newArray.splice(newArray.indexOf(realElem), 1, elem);
                    }
                }else{
                    newArray.push(elem);
                }
            }else{
                newArray.push(elem);
            }
        });

        return newArray;
    };

    returnArray.find = (id)=>{
        for(let i = 0; i < returnArray.length; i++) {
            let v = returnArray[i];
            if(v[primaryKey]){
                if(v[v[primaryKey]] == id)
                    return v;
            }else if(v.id){
                if(v.id == id)
                    return v;
            }
        }
        return undefined;
    };

    returnArray.remove = (id) => {
        let newArray = defineArrayProps(returnArray.slice())
        let elem = newArray.find(id);
        if(elem) {
            newArray.splice(newArray.indexOf(elem), 1);
        }

        return newArray;
    };

    returnArray.clear = () => {
        return defineArrayProps([]);
    };

    let pagedData = {};

    Object.defineProperty(returnArray, "pageData", {
        get() {
            return pagedData;
        }
    });

    returnArray.updatePageData = (newPageData) => {
        pagedData = newPageData;
    };

    return returnArray;
}

function convert(conversionFunction, data = [], parentName, parentProperty){
    if(!isArray(data)) throw new Error("Value must be of type Array");

    let returnArray = data.map((d, i)=>{
        return conversionFunction(d, parentName, `${parentProperty}[${i}]`);
    });

    return defineArrayProps(returnArray);
}

export default function (valueClass = Object, typeProperty, typeChecks) {
    if(!isArray(valueClass) && typeChecks) {
        return convert.apply(this, [instanceOf(), valueClass, typeProperty, typeChecks]);
    }else{
        return convert.bind(this, instanceOf(valueClass, typeProperty, typeChecks));
    }
}