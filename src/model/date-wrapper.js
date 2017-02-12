import {context, updateable} from "./_internals"
import {dateGetterMethods as baseDateGetterMethods, dateSetterMethods as baseDateSetterMethods} from "./date-methods"

const innerDate = Symbol("fluxtuateArrayWrapper_innerDate");
const listeners = Symbol("fluxtuateArrayWrapper_listeners");
const destroyed = Symbol("fluxtuateArrayWrapper_destroyed");
const checkDestroyed = Symbol("fluxtuateArrayWrapper_checkDestroyed");
const dispatchUpdate = Symbol("fluxtuateArrayWrapper_dispatchUpdate");
const updateTimer = Symbol("fluxtuateArrayWrapper_updateTimer");

const dateGetterMethods = baseDateGetterMethods.concat(["compare"]);
const dateSetterMethods = baseDateSetterMethods.concat(["setValue", "clear"]);

export default class DateWrapper {
    constructor(wrappedDate, holderContext) {
        this[innerDate] = wrappedDate;
        this[listeners] = [];
        this[context] = holderContext;
        this[updateable] = false;
        this[destroyed] = false;

        this[checkDestroyed] = ()=>{
            if(this[destroyed]){
                throw new Error("You are trying to access a destroyed date.");
            }
        };

        this[dispatchUpdate] = (callback, payload)=>{
            if(this[updateTimer]) {
                clearTimeout(this[updateTimer]);
                this[updateTimer] = undefined;
            }

            if(this[destroyed]) return;

            this[updateTimer] = setTimeout(()=>{
                callback({model: this, data: payload.data, name: payload.name});
            }, 0)
        };

        dateSetterMethods.forEach((methodName)=>{
            Object.defineProperty(this, methodName, {
                value: (...args)=>{
                    this[checkDestroyed]();

                    if(!this[updateable]){
                        throw new Error("You are trying to alter a array that is not editable, you must do all data alteration from a command!");
                    }

                    return this[innerDate][methodName].apply(this[innerDate], [this, ...args]);
                },
                configurable: false
            })
        });
        dateGetterMethods.forEach((methodName)=>{
            Object.defineProperty(this, methodName, {
                value: (...args)=>{
                    this[checkDestroyed]();

                    return this[innerDate][methodName].apply(this[innerDate], args);
                },
                configurable: false
            })
        });
    }

    get modelName() {
        this[checkDestroyed]();

        return this[innerDate].modelName;
    }

    onUpdate(callback) {
        this[checkDestroyed]();

        let listener = this[innerDate].onUpdate(this[dispatchUpdate].bind(this, callback));
        let removeFunction = listener.remove;
        let index = this[listeners].length;
        this[listeners].push(listener);
        listener.remove = () => {
            this[listeners].splice(index, 1);
            removeFunction();
        };
        return listener;
    }

    get modelData() {
        this[checkDestroyed]();

        return this[innerDate].modelData;
    }

    get cleanData() {
        this[checkDestroyed]();

        return this[innerDate].cleanData;
    }

    destroy() {
        if(this[destroyed]) return;

        this[listeners].forEach((listener)=>{
            listener.remove();
        });

        this[destroyed] = true;
    }
}