import Promise from "bluebird"
import {release} from "./_internals"

const releasePromise = Symbol("fluxtuateCommand_releasePromise");


export default class Command {
    constructor() {
        this[releasePromise] = new Promise((releaseFunction)=> {
            this[release] = releaseFunction;
        });

        Object.defineProperty(this, "onComplete", {
            get() {
                return (handler)=>{
                    this[releasePromise].then(()=>{
                        handler();
                    });
                    this[releasePromise].caught(()=>{
                        handler();
                    });
                };
            }
        });
    }

    execute() {}
}