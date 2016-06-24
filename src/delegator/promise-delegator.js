import Delegator from "./delegator"
import Promise from "bluebird"

export default class PromiseDelegator extends Delegator {
    dispatchPromise(functionName, ...params){
        let promises = [];
        params = [function(promiseCallback) {
            promises.push(new Promise(promiseCallback));
        }, ...params];
        super.dispatch.apply(this, [functionName, ...params]);
        if(promises.length > 0) {
            return Promise.all(promises);
        }else{
            return new Promise((resolve)=>{
                resolve([]);
            });
        }
    }
}