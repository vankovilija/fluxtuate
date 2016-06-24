import getOwnKeys from "./getOwnKeys"

export default function getOwnPropertyDescriptors(obj) {
    const descs = {};

    getOwnKeys(obj).forEach(
        key => (descs[key] = Object.getOwnPropertyDescriptor(obj, key))
    );

    return descs;
}