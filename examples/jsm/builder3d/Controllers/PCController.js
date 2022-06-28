import { EventDispatcher } from 'three';
import { Button, evtBtnTimes } from './Utilities/Button.js';
import { Axis, evtAxisTimes } from './Utilities/Axis.js'

const BUTTONS_DEFAULT = {
    MouseMainBtn: {
        positive: 'MouseMain',
    },
    MouseSecondaryBtn: {
        positive: 'MouseSecondary',
    },
    MouseMiddleBtn: {
        positive: 'MouseMiddle',
    },
    SpaceBtn: {
        'positive': 'Space',
    },
    ShiftBtn: {
        'positive': 'Shift',
    },
    ControlBtn: {
        'positive': 'Control',
    },
    AltBtn: {
        'positive': 'Alt',
    }
}

const AXES_DEFAULT = {
    MoveAxis: {
        negativeH: 'ArrowLeft',
        positiveH: 'ArrowRight',
        altNegativeH: 'a',
        altPositiveH: 'd',
        negativeV: 'ArrowDown',
        positiveV: 'ArrowUp',
        altNegativeV: 's',
        altPositiveV: 'w',
        gravity: 3,
        dead: 0.001,
        sensitivity: 3
    },
    ViewAxis: {
        positiveH: 'MouseX',
        positiveV: 'MouseY',
        gravity: 100,
        dead: 0.001,
        sensitivity: 1,
        addOnce: true,
        maxVal: 100
    },
}



class PCController extends EventDispatcher {
    constructor(container, customData) {
        super();
        const scope = this;
        customData = customData || {}

        this._containter = container;
        let clickTime = customData.clickTime || 0.06;

        const buttonsDef = {...BUTTONS_DEFAULT, ...customData.pcButtons };
        const axesDef = {...AXES_DEFAULT, ...customData.pcAxes };

        //this._buttonsDef = {...BUTTONS, ...customData.pcButtons };
        this._buttons = [];
        this._axes = [];


        for (const property in buttonsDef) {
            this._buttons[property] = new Button(property, {...buttonsDef[property], clickTime });
        }
        for (const property in axesDef) {
            this._axes[property] = new Axis(property, axesDef[property]);
        }

        this._initialize();

        for (const property in this._buttons) {
            const button = this._buttons[property]
            for (const property in evtBtnTimes) {
                button.addEventListener(evtBtnTimes[property], (e) => {
                    sendEvent(e, evtBtnTimes[property], button.event)
                });
            }
        }
        for (const property in this._axes) {
            const axis = this._axes[property]
            for (const property in evtAxisTimes) {
                axis.addEventListener(evtAxisTimes[property], (e) => {
                    sendEvent(e, evtAxisTimes[property], axis.event)
                });
            }
        }

        function sendEvent(event, eventTime, buttonName) {
            //console.log({...event, ... { type: 'on' + buttonName + eventTime } });
            scope.dispatchEvent({...event, ... { type: 'on' + buttonName + eventTime } })
        }
    }


    _initialize() {
        const scope = this;
        this._containter.addEventListener("mousemove", onMouseMove, false);
        document.addEventListener('mousedown', onMouseDown, false);
        document.addEventListener('mouseup', onMouseUp, false);
        document.addEventListener('keydown', onKeyDown, false);
        document.addEventListener('keyup', onKeyUp, false);

        //function updatePosition(e) {
        //console.log("tetet");
        //scope.current.mouseXDelta = e.movementX;
        //scope.current.mouseYDelta = e.movementY;

        //}

        function onMouseDown(e) {
            switch (e.button) {
                case 0:
                    keyButtonsInteract(scope._buttons['MouseMainBtn'].data.positive, true);
                    break;
                case 1:
                    keyButtonsInteract(scope._buttons['MouseMiddleBtn'].data.positive, true);

                case 2:
                    keyButtonsInteract(scope._buttons['MouseSecondaryBtn'].data.positive, true);
                    break;
            }
        }

        function onMouseUp(e) {
            switch (e.button) {
                case 0:
                    keyButtonsInteract(scope._buttons['MouseMainBtn'].data.positive, false);
                    break;
                case 1:
                    keyButtonsInteract(scope._buttons['MouseMiddleBtn'].data.positive, false);

                case 2:
                    keyButtonsInteract(scope._buttons['MouseSecondaryBtn'].data.positive, false);
                    break;
            }
        }

        function onMouseMove(e) {
            //g(e.movementX);
            //console.log(e.movementY);
            //this.dispatchEvent({ type: evtBtnTimes.buttonChange, value: this.value });
            //console.log(e.movementX);
            if (e.movementX !== 0)
                keyAxesInteract('MouseX', true, e.movementX);
            if (e.movementY !== 0)
                keyAxesInteract('MouseY', true, e.movementY);
        }

        function onKeyDown(e) {
            const key = e.key === ' ' ? 'Space' : e.key;
            keyButtonsInteract(key, true);
            keyAxesInteract(key, true, 1);
        }

        function onKeyUp(e) {
            const key = e.key === ' ' ? 'Space' : e.key;
            keyButtonsInteract(key, false);
            keyAxesInteract(key, false, 1);
        }

        function keyButtonsInteract(key, isInput) {
            if (isInput === true) {
                for (const property in scope._buttons) {
                    scope._buttons[property].inputIn(key);
                }
            } else {
                for (const property in scope._buttons) {
                    scope._buttons[property].inputOut(key);
                }
            }
        }

        function keyAxesInteract(key, isInput, addVal) {
            if (isInput === true) {
                for (const property in scope._axes) {
                    scope._axes[property].inputIn(key, addVal);
                }
            } else {
                for (const property in scope._axes) {
                    scope._axes[property].inputOut(key, addVal);
                }
            }
        }
    }

    // dispose() {
    //     //document.removeEventListener("mousemove", updatePosition, false);
    //     document.removeEventListener('mousedown', onMouseDown, false);
    //     document.removeEventListener('mouseup', onMouseUp, false);
    //     document.removeEventListener('keydown', onKeyDown, false);
    //     document.removeEventListener('keyup', onKeyUp, false);
    // }

    tick(clockDelta) {
        for (const property in this._buttons) {
            this._buttons[property].tick(clockDelta);
        }
        for (const property in this._axes) {
            this._axes[property].tick(clockDelta);
        }
    }

}


export { PCController }