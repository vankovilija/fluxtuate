import innerArray from "./array"
import instanceOf from "./instance-of"
import number from "./number"
import string from "./string"
import boolean from "./boolean"
import date from "./date"

let object = instanceOf();
let array = innerArray();

let arrayOf = function(requiredField, ...args) {
    if(!requiredField) {
        throw new Error("You must provide a type for the array!");
    }

    return innerArray.apply(undefined, [requiredField, ...args]);
};

export default {
    object, array, instanceOf, arrayOf, number, string, boolean, date
}