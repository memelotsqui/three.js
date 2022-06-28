import { SmartObject, ObjectComponent } from 'builder3D/SmartObjects/SmartObject.js'

class meme_SmartKeyboard extends SmartObject {
    constructor(gltf, customData, builder, onLoad) { // must be called when loaded-
        super(gltf, customData, builder, onLoad);

        this.builder = builder;

    }
    setupVars() {
        const data = this.gltf.userData.smartObject;
        this.keySubmits = [];
        this.height = 0;
        this.input = "";
        this.inputField = null;

    }
    beforeExtras() {
        this.gltf.nodes.forEach(o => {
            o.userData.keepMat = true;
            if (o.userData.keyPad !== undefined) {
                this.addComponent(new KeyPad(o, this));
                o.visible = false;
                o.userData.batching = false;
            }
        });
    }
    afterExtras() {
        const data = this.gltf.userData.smartObject;
        if (data.targetInputField !== undefined) {
            const obj = this.getObjectByID(data.targetInputField);
            if (obj != null) {
                this.inputField = obj.userData.textContent;
            }
        }
        this.gltf.nodes.forEach(o => {
            if (o.userData.matStickers !== undefined) { //remove collide detection on stickers, must be added after extras to find mesh connection
                if (o.userData.mesh !== undefined) {
                    if (o.userData.mesh.length === undefined) {
                        o.userData.mesh.layers.disable(30);
                    } else {
                        o.userData.mesh.forEach(m => {
                            m.layers.disable(30);
                        });
                    }
                }
            }
        });
    }

    setSmartObjectData(customData) {

        if (!customData) customData = {};

        //if (customData.onSubmit !== undefined) this.onSubmit = customData.onSubmit;
        //if (customData.context !== undefined) this.context = customData.context;

        if (customData.targetLookAt !== undefined) {
            this.targetLookAt = customData.targetLookAt;
        }
        if (customData.height !== undefined) this.height = customData.height;

        this.model.position.set(this.model.position.x, this.model.position.y + this.height, this.model.position.z);
    }
    smartTick() {
        if (this.targetLookAt !== undefined) {
            this.model.lookAt(this.targetLookAt.position);
        }
    }
    callSubmit() {
        //this.onSubmit.call(this.context, this.input)
        this.builder.loadPage(this.input);
        this.clearInput();
    }
    callDelete() {
        this.input = this.input.slice(0, -1);
        if (this.inputField != null)
            this.inputField.set({ content: this.input });
    }
    addInput(val) {
        this.input += val;
        if (this.inputField != null) {
            this.inputField.set({ content: this.input });
        }
    }
    clearInput() {
        this.input = "";
        if (this.inputField != null)
            this.inputField.set({ content: this.input });
    }
    goHome() {
        console.log("go home");
        this.builder.loadJsonSmart({
            "smartObjects": [{
                "location": "https://3dbuilds.nyc3.cdn.digitaloceanspaces.com/smartObjects/loft_91/gltf.gltf",
                "userData": {
                    "moveToStartPosition": 0
                }
            }]
        });

    }

}

class KeyPad extends ObjectComponent {
    constructor(object, smart) {
        super(object);
        const userData = object.userData.keyPad;

        this.smart = smart;
        this.value = userData.value;
        this.keyType = userData.keyType;
        this.enableArray = userData.enable;
        this.disableArray = userData.disable;
    }

    onRaycastHit(userData) {
        switch (this.keyType) {
            case ("key"):
                this.smart.addInput(this.value);
                break;
            case ("submit"):
                this.smart.callSubmit();
                break;
            case ("switcher"):
                this.smart.getObjectsByIDs(this.enableArray).forEach(o => {
                    this.smart.toggleObject(o, true);
                });
                this.smart.getObjectsByIDs(this.disableArray).forEach(o => {
                    this.smart.toggleObject(o, false);
                });
                break;
            case ("delete"):
                this.smart.callDelete();
                break;
            case ("supreme"):
                this.smart.clearInput();
                break;
            case ("close"):
                this.smart.setActive(false);
                break;
            case ("exitvr"):
                this.smart.builder.exitVR();
                break;
            case ("home"):
                this.smart.goHome();
                break;

            default:
                console.log("unkown");
                break;

        }
    }
    onHoverEnter(customData) {
        this.object.visible = true;

    }
    onHoverExit(customData) {
        this.object.visible = false;
    }
}



export { meme_SmartKeyboard as default };