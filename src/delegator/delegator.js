import { isFunction, isObject } from "lodash/lang"

import {dispatchToDelegate} from "./_internals";

const delegates = Symbol("fluxtuateDelegator_delegates");

export default class Delegator {
    constructor (){
        this[delegates] = [];

        this[dispatchToDelegate] = function(functionName, params, delegate){
            let args = [functionName, ...params];
            if(delegate instanceof Delegator){
                delegate.dispatch.apply(delegate, args);
            }else {
                if (isFunction(delegate[functionName])) {
                    delegate[functionName].apply(delegate, params);
                }
            }
        };
    }

    dispatch(functionName, ...params){
        let dels = this[delegates].slice();
        dels.forEach(this[dispatchToDelegate].bind(this, functionName, params));
    }

    attachDelegate(delegate){
        if(!isObject(delegate)){
            throw new Error("Delegates must be javascript objects with methods!");
        }

        if(this[delegates].indexOf(delegate) !== -1){
            return;
        }

        this[delegates].push(delegate);
    }

    detachDelegate(delegate){
        let index = this[delegates].indexOf(delegate);

        if(index === -1){
            return;
        }

        this[delegates].splice(index, 1);
    }

    destroy() {
        this[delegates] = [];
    }
}