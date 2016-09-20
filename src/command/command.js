import Promise from "bluebird"

const releasePromise = Symbol("fluxtuateCommand_releasePromise");

export default class Command {
    constructor() {
        this[releasePromise] = new Promise((release)=>{
            Object.defineProperty(this, "release", {
                get() {
                    return release;
                }
            });
        });

        Object.defineProperty(this, "onComplete", {
            get() {
                return (handler)=>{
                    this[releasePromise].then(()=>{
                        handler();
                    });
                };
            }
        });
    }

    execute() {}
}