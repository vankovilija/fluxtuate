import Delegator from "./delegator"
import {findIndex} from "lodash/array"
import {dispatchToDelegate} from "./_internals";

const lastEvents = Symbol("fluxtuateRetainDelegator_lastEvents");

export default class RetainDelegator extends Delegator {
    constructor(){
        super();
        this[lastEvents] = [];
    }

    dispatch(functionName, ...params){
        super.dispatch.apply(this, [functionName, ...params]);
        
        let index = findIndex(this[lastEvents], {functionName});
        if(index !== -1){
            this[lastEvents].splice(index, 1);
        }
        
        this[lastEvents].push({
            functionName, params
        });
    }

    attachDelegate(delegate){
        super.attachDelegate(delegate);

        setTimeout(()=>{
            this[lastEvents].forEach((event)=>{
                this[dispatchToDelegate](event.functionName, event.params, delegate);
            });
        },0);
    }
}