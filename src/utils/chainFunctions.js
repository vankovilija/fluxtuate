export default function (...functions) {
    return function chainedFunctions(...args) {
        functions.forEach((func)=> {
            if (typeof func === "function") {
                if(func.apply(this, args) === false) return false;
            }
        });
    };
}