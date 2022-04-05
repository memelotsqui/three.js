let object, smart;

animator: targetAnimator;

gameObject: targetObject;
string: value;
bool: enableArray;
t_KeyPad: disableArray;
string: keyType;
float: rotRad;



onRaycastHit

class KeyPad extends ObjectComponent {
    //constructor(object, smart) {
    // super(object);
    // const userData = object.userData.keyPad;

    // this.smart = smart;
    // this.value = userData.value;
    // this.keyType = userData.keyType;
    // this.enableArray = userData.enable;
    // this.disableArray = userData.disable;
    //}
    tick(clockDelta) {
        object.rotateX(rotRad);
    }
    onRaycastHit(customData) {
        switch (keyType) {
            case ("key"):
                smart.addInput(value);
                break;
            case ("submit"):
                smart.callSubmit();
                break;
            case ("switcher"):
                smart.getObjectsByIDs(enableArray).forEach(o => {
                    smart.toggleObject(o, true);
                });
                smart.getObjectsByIDs(disableArray).forEach(o => {
                    smart.toggleObject(o, false);
                });
                break;
            case ("delete"):
                smart.callDelete();
                break;
            case ("supreme"):
                smart.clearInput();
                break;
            case ("close"):
                smart.setActive(false);
                console.log("close");
                break;

            default:
                console.log("unkown");
                break;

        }
    }
    onHoverEnter(customData) {
        object.visible = true;

    }
    onHoverExit(customData) {
        object.visible = false;
    }
}