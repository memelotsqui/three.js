import { EventDispatcher } from 'three';
import { Button, evtBtnTimes } from './Utilities/Button.js'
import { Axis, evtAxisTimes } from './Utilities/Axis.js'
import '../../libs/hammer.min.js';

// FIRST VALUE = NUMBER OF FINGERS, SECOND VALUE = QUANTITY OF TAPS
const BUTTONS_DEFAULT = {
    PrimaryBtn: { // MOUSE MAIN IN PC
        positive: 'oneSingleTap'
    },
    SecondaryBtn: { // MOUSE SECONDARY IN PC
        positive: 'twoSingleTap'
    },
    TertiaryBtn: { //MOUSE MIDDLE IN PC
        positive: 'oneTripleTap'
    },
    QuaternaryBtn: { // SPACE IN PC
        positive: 'threeSingleTap'
    },
    QuinaryBtn: { //SHIFT IN PC
        positive: "oneDoubleTap"
    },
    SenaryBtn: { //CONTROL IN PC
        positive: 'twoDoubleTap'
    },
    SeptenaryBtn: { //ALT IN PC
        positive: 'twoTripleTap'
    }
}

// FIRST VALUE = SCREEN ORIENTATION, SECOND VALUE = AREA OF THE SCREEN, THIRD VALUE = PAN/PINCH/ZOOM, FOURTHVALUE = AXIS
const AXES_DEFAULT = {
    MoveAxis: {
        positiveH: 'horizontalLeftPanX',
        positiveV: 'horizontalLeftPanY',
        altNegativeH: 'verticalBottomPanX',
        altPositiveV: 'verticalBottomPanY',
        gravity: 3,
        dead: 0.001,
        sensitivity: 3,
        sumValue: false

    },
    ViewAxis: {
        positiveH: 'horizontalRightPanX',
        positiveV: 'horizontalRightPanY',
        altNegativeH: 'verticalTopPanX',
        altPositiveV: 'verticalTopPanY',
        gravity: 3,
        dead: 0.001,
        sensitivity: 3,
        sumValue: false
    },
}

//missing scroll  in

class TouchPosition {
    constructor(orientation, touchArea, touchPosition) {
        this.orientation = orientation;
        this.touchArea = touchArea;
        this.touchPosition = touchPosition; //vector2, screen position
        this._sensitiveMultiplier = 0.01;
    }

    getDelta(currentPosition) {
        return {
            x: (this.touchPosition.x - currentPosition.x) * this._sensitiveMultiplier,
            y: (this.touchPosition.y - currentPosition.y) * this._sensitiveMultiplier
        };
    }

    getTouchArea() {
        return this.orientation + this.touchArea;
    }
}

class MobileController extends EventDispatcher {
    constructor(container, customData) {
        super();
        const scope = this;
        customData = customData || {}

        this._fingerCount = 0; //the number of fingers that tapped the screen simultaneously

        this._activeFingers = 0; // the current Active touches in the screen, changes when a tap is called or when a finger is released, not when a finger is only placed
        this._currentTouches = 0; // the current amount of touched in the screen, constantly changes

        this._timeBetweenTaps = 0.25; // determine the maximum time required to consider a tap
        this._clickCount = 0; // the amount of times the user has tapped before the timeBetweenTaps has reached
        this._counter = 0; // counter to determine the timeBetweenTap

        this._currentPressedBtns = []; // buttons remain pressed as lons as there is a finger in the screen

        // for axis
        this._touchAreas = [];

        this._container = container;
        this._containerCenter = {
            x: 0,
            y: 0
        };
        this._orientation = "";
        this._updateOrientation();

        const buttonsDef = {...BUTTONS_DEFAULT, ...customData.mobButtons };
        const axesDef = {...AXES_DEFAULT, ...customData.mobAxes };

        this._buttons = [];
        this._axes = [];

        for (const property in buttonsDef) {
            this._buttons[property] = new Button(property, buttonsDef[property], true);
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

    _updateOrientation() {
        const orientation = (screen.orientation || {}).type || screen.mozOrientation || screen.msOrientation;
        this._orientation = orientation.includes('landscape') ? "horizontal" : "vertical";
        this._containerCenter = {
            x: this._container.clientWidth / 2,
            y: this._container.clientHeight / 2
        }

        //cancel all touches
    }
    _initialize() {
        const scope = this;
        this._container.addEventListener('touchstart', handleStart);
        this._container.addEventListener('touchend', handleEnd);
        this._container.addEventListener('touchcancel', handleCancel);
        this._container.addEventListener('touchmove', handleMove);

        window.addEventListener('resize', onScreenResize);

        function onScreenResize() {
            scope._updateOrientation();
        }

        function handleStart(e) {
            e.preventDefault();

            // buttons section
            scope._currentTouches = e.touches.length;
            scope._counter = 0;

            if (e.touches.length - scope._activeFingers === 1)
                scope._clickCount += 1;
            scope._fingerCount = e.touches.length - scope._activeFingers;

            // axis section
            for (var i = 0; i < e.changedTouches.length; i++) {
                let touchArea = ""
                if (scope._orientation == "horizontal")
                    touchArea = e.changedTouches[i].clientX < scope._containerCenter.x ? "Left" : "Right";
                else
                    touchArea = e.changedTouches[i].clientY > scope._containerCenter.y ? "Bottom" : "Top";


                scope._touchAreas[e.changedTouches[i].identifier] = new TouchPosition(
                    scope._orientation,
                    touchArea, {
                        x: e.changedTouches[i].clientX,
                        y: e.changedTouches[i].clientY,
                    }
                )
            }
        }

        function handleEnd(e) {
            scope._currentTouches = e.touches.length;
            if (e.touches.length < scope._activeFingers)
                scope._activeFingers = e.touches.length;
            releaseCurrentButtons();


            for (var i = 0; i < e.changedTouches.length; i++) {

                const touchAreaName = scope._touchAreas[e.changedTouches[i].identifier].getTouchArea();
                scope._touchAxesInteract(touchAreaName + "PanX", false);
                scope._touchAxesInteract(touchAreaName + "PanY", false);
                scope._touchAreas[e.changedTouches[i].identifier] = null;

            }

        }

        function handleMove(e) {
            for (var i = 0; i < e.changedTouches.length; i++) {
                const touchAreaName = scope._touchAreas[e.changedTouches[i].identifier].getTouchArea();
                const delta = scope._touchAreas[e.changedTouches[i].identifier].getDelta({
                    x: e.changedTouches[i].clientX,
                    y: e.changedTouches[i].clientY
                });
                scope._touchAxesInteract(touchAreaName + "PanX", true, delta.x);
                scope._touchAxesInteract(touchAreaName + "PanY", true, delta.y);
            }
        }

        function releaseCurrentButtons() {
            if (scope._currentTouches === 0 && scope._currentPressedBtns.length !== 0) {
                scope._currentPressedBtns.forEach(button => {
                    scope._touchesInteract(button, false)
                });
                scope._currentPressedBtns = [];
            }
        }

        function handleCancel(e) {
            scope._currentTouches = 0;
            releaseCurrentButtons();
            for (var i = 0; i < scope._touchAreas.length; i++) {
                if (scope._touchAreas[i] != null) {
                    const touchAreaName = scope._touchAreas[i].getTouchArea();
                    scope._touchAxesInteract(touchAreaName + "PanX", false);
                    scope._touchAxesInteract(touchAreaName + "PanY", false);
                    scope._touchAreas[i] = null;
                }
            };
            console.log("cancels");
        }



    }


    tick(clockDelta) {
        for (const property in this._buttons) {
            this._buttons[property].tick(clockDelta);
        }
        for (const property in this._axes) {
            this._axes[property].tick(clockDelta);
        }
        if (this._clickCount > 0) {
            this._counter += clockDelta;
            if (this._counter >= this._timeBetweenTaps) {
                this._getInputCall();
            }
        }
    }


    _getInputCall() {
        const result = this._getFingerCount() + this._getTapCount() + "Tap";

        if (this._activeFingers === this._currentTouches) {
            // call tap on button
            this._touchesTap(result);
        } else {
            // add result to the current pressed buttons if its not already in the list
            if (!this._currentPressedBtns.includes(result))
                this._currentPressedBtns.push(result);

            this._touchesInteract(result, true)
        }

        this._activeFingers = this._currentTouches;

        this._counter = 0;
        this._clickCount = 0;
        this._fingerCount = 0;
        return result;

    }
    _getFingerCount() {
        switch (this._fingerCount) {
            case 1:
                return "one"
            case 2:
                return "two"
            case 3:
                return "three"
            case 4:
                return "four"
            case 5:
                return "five"
        }
    }
    _getTapCount() {
        switch (this._clickCount) {
            case 1:
                return "Single"
            case 2:
                return "Double"
            case 3:
                return "Triple"
            case 4:
                return "Quadruple"
            case 5:
                return "Quintuple"
        }
    }

    _touchesTap(key) {
        for (const property in this._buttons) {
            this._buttons[property].manualClick(key);
        }
    }
    _touchesInteract(key, isInput) {
        if (isInput === true) {
            for (const property in this._buttons) {
                this._buttons[property].inputIn(key);
            }
        } else {
            for (const property in this._buttons) {
                this._buttons[property].inputOut(key);
            }
        }
    }

    _touchAxesInteract(key, isInput, addVal) {
        if (isInput === true) {
            for (const property in this._axes) {
                this._axes[property].inputIn(key, addVal);
            }
        } else {
            for (const property in this._axes) {
                this._axes[property].inputOut(key);
            }
        }
    }

}

export { MobileController }