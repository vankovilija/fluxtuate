export default function forEachPrototype(elem, callback, continueClass = Object){
    let proto = Object.getPrototypeOf(elem);
    while(proto && proto instanceof continueClass){
        callback(proto);
        proto = Object.getPrototypeOf(proto);
    }
}