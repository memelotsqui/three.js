import { EventDispatcher } from 'three';

const AXIS_DEFAULTS = {
    positiveH: null,
    negativeH: null,
    altPositiveH: null,
    altNegativeH: null,
    positiveV: null,
    negativeV: null,
    altPositiveV: null,
    altNegativeV: null,
    gravity: 3,
    dead: 0.001,
    sensitivity: 3,
    addOnce: false, // NO GRAVITY, HAS VALUE OR HAS NOT
    maxVal: 1,
    sumValue: true // SHOULD INPUT BE ADDED OR JUST PLACED AS IT IS
}
const AXIS_VALS = [
    'positiveH',
    'negativeH',
    'altPositiveH',
    'altNegativeH',
    'positiveV',
    'negativeV',
    'altPositiveV',
    'altNegativeV'
]

const evtAxisTimes = {
    axisChange: 'Change'
}
class Axis extends EventDispatcher {
    constructor(evtName, data) {
        super();
        const scope = this;

        this.event = evtName;
        this.data = {...AXIS_DEFAULTS, ...data };

        this.horizontal = 0;
        this.vertical = 0;

        this._lastHorizontal = 0;
        this._lastVertical = 0;

        this._inputVals = [];

        AXIS_VALS.forEach(axisVal => {
            if (this.data[axisVal] != null) {
                this._inputVals.push(this.data[axisVal]);
            }
        });
        this.addVal = {
            horizontalAdd: 0,
            horizontalSub: 0,
            verticalAdd: 0,
            verticalSub: 0
        }
    }

    inputIn(val, addVal = 1) {
        if (this.data.addOnce === false) {
            if (val === this.data.positiveH || val === this.data.altPositiveH) {
                this.addVal.horizontalAdd = this.data.sensitivity * addVal;
            }
            if (val === this.data.negativeH || val === this.data.altNegativeH) {
                this.addVal.horizontalSub = this.data.sensitivity * addVal;
            }
            if (val === this.data.positiveV || val === this.data.altPositiveV) {
                this.addVal.verticalAdd = this.data.sensitivity * addVal;
            }
            if (val === this.data.negativeV || val === this.data.altNegativeV) {
                this.addVal.verticalSub = this.data.sensitivity * addVal;
            }
        } else {

            let horizontal = this.data.sensitivity;
            if (val === this.data.positiveH || val === this.data.altPositiveH)
                horizontal *= addVal;
            if (val === this.data.negativeH || val === this.data.altNegativeH)
                horizontal *= -addVal;

            if (horizontal > this.data.maxVal) {
                this.horizontal = this.data.maxVal;
            } else if (horizontal < -this.data.maxVal) {
                this.horizontal = -this.data.maxVal;
            } else {
                this.horizontal = horizontal;
            }

            let vertical = this.data.sensitivity;
            if (val === this.data.positiveV || val === this.data.altPositiveV)
                vertical *= addVal;
            if (val === this.data.negativeV || val === this.data.altNegativeV)
                vertical *= -addVal;

            this.vertical = vertical > this.data.maxVal ? this.data.maxVal : vertical;
            this.vertical = vertical < -this.data.maxVal ? -this.data.maxVal : vertical;
        }
    }
    inputOut(val) {
        if (this.data.addOnce === false) {
            if (val === this.data.positiveH || val === this.data.altPositiveH) {
                this.addVal.horizontalAdd = 0;
            }
            if (val === this.data.negativeH || val === this.data.altNegativeH) {
                this.addVal.horizontalSub = 0;
            }
            if (val === this.data.positiveV || val === this.data.altPositiveV) {
                this.addVal.verticalAdd = 0;
            }
            if (val === this.data.negativeV || val === this.data.altNegativeV) {
                this.addVal.verticalSub = 0;
            }
        }
    }

    tick(clockDelta) {
        const maxVal = this.data.maxVal;
        const horizontalVal = this.addVal.horizontalAdd - this.addVal.horizontalSub;
        if (horizontalVal !== 0) {


            let horizontal =
                this.data.sumValue === true ?
                this.horizontal + (horizontalVal * clockDelta) :
                horizontalVal; //JUST ADD THE VALUE AS IT IS


            horizontal = horizontal > maxVal ? maxVal : horizontal;
            horizontal = horizontal < -maxVal ? -maxVal : horizontal;

            this.horizontal = horizontal;
            //this.dispatchEvent({ type: evtBtnTimes.buttonPress, value: this.value });
        } else {
            if (this.horizontal !== 0) {
                if (this.horizontal > this.data.dead) {
                    let horizontal = this.horizontal - (this.data.gravity * clockDelta)
                    if (horizontal <= this.data.dead) {
                        horizontal = 0;
                    }
                    this.horizontal = horizontal;
                }
                if (this.horizontal < -this.data.dead) {
                    let horizontal = this.horizontal + (this.data.gravity * clockDelta)
                    if (horizontal >= -this.data.dead) {
                        horizontal = 0;
                    }
                    this.horizontal = horizontal;
                }

            }
        }


        const verticalVal = this.addVal.verticalAdd - this.addVal.verticalSub;

        if (verticalVal !== 0) {
            let vertical = this.vertical + (verticalVal * clockDelta);
            vertical = vertical > maxVal ? maxVal : vertical;
            vertical = vertical < -maxVal ? -maxVal : vertical;

            this.vertical = vertical;
            //this.dispatchEvent({ type: evtBtnTimes.buttonPress, value: this.value });
        } else {
            if (this.vertical !== 0) {
                if (this.vertical > this.data.dead) {
                    let vertical = this.vertical - (this.data.gravity * clockDelta)
                    if (vertical <= this.data.dead) {
                        vertical = 0;
                    }
                    this.vertical = vertical;
                }
                if (this.vertical < -this.data.dead) {
                    let vertical = this.vertical + (this.data.gravity * clockDelta)
                    if (vertical >= -this.data.dead) {
                        vertical = 0;
                    }
                    this.vertical = vertical;
                }

            }
        }

        if (this._lastHorizontal !== this.horizontal || this._lastVertical !== this.vertical) {
            this.dispatchEvent({ type: evtAxisTimes.axisChange, horizontal: this.horizontal, vertical: this.vertical });
        }
        this._lastHorizontal = this.horizontal;
        this._lastVertical = this.vertical;

    }

}

export { Axis, evtAxisTimes }