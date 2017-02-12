import RetainEventDispatcher from "../event-dispatcher/retain-event-dispatcher"
import {elementResponsible, dataType} from "./_internals"
import {destroy} from "../event-dispatcher/_internals"
import {dateGetterMethods, dateSetterMethods} from "./date-methods"

const innerDate = Symbol("fluxtuateObservableDate_innerDate");
const sendUpdate = Symbol("fluxtuateObservableDate_sendUpdate");
const dateName = Symbol("fluxtuateObservableDate_dateName");
const dateParent = Symbol("fluxtuateObservableDate_dateParent");
const updateTimeout = Symbol("fluxtuateObservableDate_updateTimeout");
const listeners = Symbol("fluxtuateObservableDate_listners");

const oDateCache = [];

export default class ObservableDate extends RetainEventDispatcher{
    static getInstance(wrappedDate, name, parentName) {
        let oDate;
        if(oDateCache.length > 0) {
            oDate = oDateCache.shift();
            oDate[dateParent] = parentName;
            oDate[dateName] = name;
            oDate[innerDate] = wrappedDate;
        }else{
            oDate = new ObservableDate(wrappedDate, name, parentName);
        }

        return oDate;
    }

    constructor(wrappedDate, name, parentName) {
        super();
        this[dataType] = "date";
        this[dateParent] = parentName;
        this[dateName] = name;
        this[innerDate] = wrappedDate;
        this[listeners] = [];

        this[sendUpdate] = (elementR)=>{
            if(this[updateTimeout]) {
                clearTimeout(this[updateTimeout]);
                this[updateTimeout] = null;
            }

            this[updateTimeout] = setTimeout(()=>{
                let payload = {
                    data: this.modelData, name: this.modelName
                };
                payload[elementResponsible] = elementR;
                this.dispatch("update", payload);
            }, 100);
        };
        dateSetterMethods.forEach((methodName)=>{
            Object.defineProperty(this, methodName, {
                value: (elementR, ...args)=>{

                    this[innerDate] = new Date(this[innerDate].getTime());
                    let returnValue = this[innerDate][methodName].apply(this[innerDate], args);
                    this[sendUpdate](elementR);
                    return returnValue;
                },
                configurable: false
            });
        });
        dateGetterMethods.forEach((methodName)=>{
            Object.defineProperty(this, methodName, {
                value: (...args)=>{
                    let dateData = this.modelData;
                    return dateData[methodName].apply(dateData, args);
                },
                configurable: false
            })
        });
    }

    get modelName() {
        return this[dateName];
    }

    onUpdate(callback) {
        let listener = this.addListener("update", (ev, payload)=>{
            callback(payload);
        });

        this[listeners].push(listener);
        return listener;
    }

    get modelData() {
        return new Date(this[innerDate].getTime());
    }

    get cleanData() {
        return this.modelData;
    }

    clear(elementR) {
        this[innerDate] = new Date();
        this[sendUpdate](elementR);
    }

    setValue(date, elementR) {
        this[innerDate] = new Date(date.getTime());

        this[sendUpdate](elementR);
    }

    compare(secondDate) {
        return this[innerDate].getTime() === secondDate.getTime();
    }

    destroy() {
        this[listeners].forEach((listener)=>{
            listener.remove();
        });

        this.clear(this);


        this[listeners] = [];

        this[dateParent] = "";
        this[dateName] = "";
        this[innerDate] = new Date();

        this[destroy]();

        if(this[updateTimeout]) {
            clearTimeout(this[updateTimeout]);
            this[updateTimeout] = null;
        }

        oDateCache.push(this);
    }
}