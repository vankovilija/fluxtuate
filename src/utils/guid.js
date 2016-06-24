const format = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
const replaceX = /[xy]/g;

export default {
    generateGUID() {
        let d = Date.now();
        let uuid = format.replace(replaceX, function(c) {
            let r = (d + Math.random()*16)%16 | 0;
            d = Math.floor(d/16);
            return (c=="x" ? r : (r&0x3|0x8)).toString(16);
        });
        return uuid;
    }
}