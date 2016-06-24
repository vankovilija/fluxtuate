const getOwnKeys = Object.getOwnPropertySymbols
    ? function (object) {
    return Object.getOwnPropertyNames(object)
        .concat(Object.getOwnPropertySymbols(object));
}
    : Object.getOwnPropertyNames;

export default getOwnKeys;