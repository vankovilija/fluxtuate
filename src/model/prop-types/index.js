import arrayOf from "./array"
import instanceOf from "./instance-of"
import number from "./number"
import string from "./string"
import boolean from "./boolean"
import date from "./date"

let object = instanceOf();
let array = arrayOf();

export default {
    object, array, instanceOf, arrayOf, number, string, boolean, date
}