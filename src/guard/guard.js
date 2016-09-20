import {approveGuard} from "./_internals"
import {isBoolean, isFunction} from "lodash/lang"
import Promise from "bluebird"

export default class Guard{
    constructor() {
        this[approveGuard] = ()=>{
            let approveRes = this.approve();
            if(approveRes === undefined || !isBoolean(approveRes) && !isFunction(approveRes.then)){
                throw new Error(`Approve functions must return true/false or Promise values! ${this}`);
            }

            if(isFunction(approveRes.then)){
                return approveRes;
            }else{
                return new Promise((resolve)=>{
                    resolve(approveRes);
                });
            }
        }
    }

    approve() {
        return true;
    }
}