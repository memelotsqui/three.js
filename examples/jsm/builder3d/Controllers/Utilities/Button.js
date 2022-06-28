import { EventDispatcher } from 'three';

const BUTTONS_DEFAULTS = {
    positive: null,
    negative: null,
    altPositive: null,
    altNegative: null,
    gravity: 1000,
    dead: 0.001,
    sensitivity: 1000
}

const evtBtnTimes = {
    buttonStart: 'Start',
    buttonRelease: 'Release',
    buttonClick: 'Click',
    buttonPress: 'Press',
    buttonChange: 'Change'
}


class Button extends EventDispatcher {
    constructor(evtName, data, manualClick = false) {
        super();
        const scope = this;

        this.event = evtName;
        this.data = {...BUTTONS_DEFAULTS, ...data };
        this.value = 0;
        this._lastValue = 0;
        this._manualClick = manualClick;

        this.addVal = 0;
        this.subVal = 0;

        // used for  click
        this._posCounter = 0;
        this._negCounter = 0;
        this._isPosCounter = false;
        this._isNegCounter = false;
        this._clickTime = data.clickTime || 0.1;

        console.log(this._clickTime);

        window.addEventListener("blur", () => {
            onblur();
        });

        function onblur() {
            if (scope.value !== 0) {
                scope.dispatchEvent({ type: evtBtnTimes.buttonRelease, isPositive: false });

                scope.value = 0;

                scope.addVal = 0;
                scope.subVal = 0;

                scope._posCounter = 0;
                scope._negCounter = 0;
                scope._isPosCounter = false;
                scope._isNegCounter = false;
            }
        }
    }
    manualClick(val) {
        if (val === this.data.positive || val === this.data.altPositive) {
            this.dispatchEvent({ type: evtBtnTimes.buttonClick, isPositive: true });
        }
        if (val === this.data.negative || val === this.data.altNegative) {
            this.dispatchEvent({ type: evtBtnTimes.buttonClick, isPositive: false });
        }
    }
    inputIn(val) {
        if (val === this.data.positive || val === this.data.altPositive) {
            if (this._isPosCounter === false) {
                this.addVal = this.data.sensitivity;
                this.dispatchEvent({ type: evtBtnTimes.buttonStart, isPositive: true });
                this._isPosCounter = true;
                this._posCounter = 0;
            }

        }
        if (val === this.data.negative || val === this.data.altNegative) {
            if (this._isNegCounter === false) {
                this.subVal = this.data.sensitivity;
                this.dispatchEvent({ type: evtBtnTimes.buttonStart, isPositive: false });
                this._isNegCounter = true;
                this._negCounter = 0;
            }

        }
    }
    inputOut(val) {
        if (val === this.data.positive || val === this.data.altPositive) {
            this.addVal = 0;
            this._isPosCounter = false;
            if (!this._manualClick)
                if (this._posCounter > this._clickTime)
                    this.dispatchEvent({ type: evtBtnTimes.buttonClick, isPositive: true });
            this._posCounter = 0;
            this.dispatchEvent({ type: evtBtnTimes.buttonRelease, isPositive: true });
        }
        if (val === this.data.negative || val === this.data.altNegative) {
            this.subVal = 0;
            this._isNegCounter = false;
            if (!this._manualClick)
                if (this._negCounter > this._clickTime)
                    this.dispatchEvent({ type: evtBtnTimes.buttonClick, isPositive: false });
            this._negCounter = 0;
            this.dispatchEvent({ type: evtBtnTimes.buttonRelease, isPositive: false });
        }
    }
    tick(clockDelta) {
        if (this._isPosCounter === true)
            this._posCounter += clockDelta;
        if (this._isNegCounter === true)
            this._negCounter += clockDelta;
        const fullValue = this.addVal - this.subVal;
        if (fullValue !== 0) {
            let value = this.value + (fullValue * clockDelta);
            if (value > 1)
                value = 1;
            if (value < -1)
                value = -1;

            this.value = value;
            this.dispatchEvent({ type: evtBtnTimes.buttonPress, value: this.value });
        } else {
            if (this.value !== 0) {
                if (this.value > this.data.dead) {
                    let value = this.value - (this.data.gravity * clockDelta)
                    if (value <= this.data.dead) {
                        value = 0;
                    }
                    this.value = value;
                }
                if (this.value < -this.data.dead) {
                    let value = this.value + (this.data.gravity * clockDelta)
                    if (value >= -this.data.dead) {
                        value = 0;
                    }
                    this.value = value;
                }

            }
        }
        if (this._lastValue !== this.value)
            this.dispatchEvent({ type: evtBtnTimes.buttonChange, value: this.value });
        this._lastValue = this.value;
    }
}

export { Button, evtBtnTimes }