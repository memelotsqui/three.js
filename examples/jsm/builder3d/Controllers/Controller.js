import * as THREE from 'three';
import { PCController } from './PCController.js';
import { MobileController } from './MobileController.js';

const eventAxisNames = ["Move", "View"];
const eventAxisTimes = ['Change'];

const eventPressNames = ['Fire', 'Jump', 'Grab', 'Toggle', 'Forward', 'Back', 'Neutral'];
const eventBtnTimes = ['Start', 'Release', 'Click', 'Press', 'Change'];


class Controller extends THREE.EventDispatcher {
    constructor(builder) {
        super();
        // start with "on" for example: onFireStart : onMove : onGrabPress...
        this._currentController = null;
        this._container = builder.container;

        const isMobile = navigator.userAgentData.mobile; //resolves true/false
        if (isMobile)
            this.setPlatform("Mobile");
        else
            this.setPlatform("PC");

    }

    setPlatform(target) {
        const scope = this;

        console.log(target);
        switch (target) {
            case "PC":
                this._setPCPlatform();
                break;
            case "Mobile":
                this._setMobilePlatform();
                break;
            case "XR":
                this.setXRPlatform();
                break;
            default:
                console.error("platform not supported");
                break;

        }
        // if current platform == webxr
        // this.currentController = new OculusController();
    }
    _setMobilePlatform() {
        //console.log(container)
        const scope = this;

        this._currentController = new MobileController(this._container);

        const mapButtons = {};
        mapButtons[eventPressNames[0]] = 'PrimaryBtn'; // left mouse
        mapButtons[eventPressNames[1]] = 'QuaternaryBtn'; // space
        mapButtons[eventPressNames[2]] = 'SecondaryBtn'; // right mouse
        mapButtons[eventPressNames[3]] = 'QuinaryBtn'; // shift
        mapButtons[eventPressNames[4]] = 'SeptenaryBtn'; //alt
        mapButtons[eventPressNames[5]] = 'SenaryBtn'; //ctrl
        mapButtons[eventPressNames[6]] = 'TertiaryBtn'; //middle mouse

        const mapAxis = {};
        mapAxis[eventAxisNames[0]] = 'MoveAxis'; // wasd
        mapAxis[eventAxisNames[1]] = 'ViewAxis'; // mouse position

        for (const property in mapButtons) {
            eventBtnTimes.forEach(st => {
                this._currentController.addEventListener('on' + mapButtons[property] + st, (e) => {
                    console.log({...e, type: 'on' + property + st });
                    scope.dispatchEvent({...e, type: 'on' + property + st })
                })
            });
        }
        for (const property in mapAxis) {
            eventAxisTimes.forEach(st => {
                this._currentController.addEventListener('on' + mapAxis[property] + st, (e) => {
                    console.log({...e, type: 'on' + property + st });
                    scope.dispatchEvent({...e, type: 'on' + property + st })
                })
            });
        }
    }

    _setPCPlatform() {
        const scope = this;

        this._currentController = new PCController(this._container);

        const mapButtons = {};
        mapButtons[eventPressNames[0]] = 'MouseMainBtn'; // left mouse
        mapButtons[eventPressNames[1]] = 'SpaceBtn'; // space
        mapButtons[eventPressNames[2]] = 'MouseSecondaryBtn'; // right mouse
        mapButtons[eventPressNames[3]] = 'ShiftBtn'; // shift
        mapButtons[eventPressNames[4]] = 'AltBtn'; //alt
        mapButtons[eventPressNames[5]] = 'ControlBtn'; //ctrl
        mapButtons[eventPressNames[6]] = 'MouseMiddleBtn'; //middle mouse

        const mapAxis = {};
        mapAxis[eventAxisNames[0]] = 'MoveAxis'; // wasd
        mapAxis[eventAxisNames[1]] = 'ViewAxis'; // mouse position

        for (const property in mapButtons) {
            eventBtnTimes.forEach(st => {
                this._currentController.addEventListener('on' + mapButtons[property] + st, (e) => {
                    //console.log({...e, type: 'on' + property + st });
                    scope.dispatchEvent({...e, type: 'on' + property + st })
                })
            });
        }
        for (const property in mapAxis) {
            eventAxisTimes.forEach(st => {
                this._currentController.addEventListener('on' + mapAxis[property] + st, (e) => {
                    //console.log({...e, type: 'on' + property + st });
                    scope.dispatchEvent({...e, type: 'on' + property + st })
                })
            });
        }
    }

    tick(clockDelta) {
        this._currentController.tick(clockDelta);
        for (const axis in this._Axes) {
            if (this._Axes[axis].hasChanged()) {
                this.dispatchEvent({ type: 'on' + axis })
            }
        }
    }

}



export { Controller }